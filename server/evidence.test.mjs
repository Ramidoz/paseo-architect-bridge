import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {setImmediate as tick} from 'node:timers/promises';
import {createEvidence} from './evidence.mjs';
import {createApi} from './api.mjs';

const page=(entries=[],endCursor=null,hasNewer=false)=>({entries,endCursor,hasNewer,epoch:'fixture'});
const item=(seq,status='completed')=>({seqStart:seq,seqEnd:seq,timestamp:'2026-10-11T04:00:00Z',item:{type:'tool_call',name:'Write',status,detail:{type:'write',filePath:`/repo/file-${seq}.mjs`}}});
function fixture(options={}) {
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,key TEXT UNIQUE,repo TEXT,body TEXT); CREATE TABLE state(key TEXT PRIMARY KEY,body TEXT);');
 const save=(key,value)=>db.prepare('INSERT INTO state VALUES(?,?)').run(key,JSON.stringify(value));
 return {db,save,create:extra=>createEvidence({db,url:'ws://fixture',...options,...extra})};
}
function adapter(entries=[],refetch=async()=>page()) {
 return {client:{agents:{list:async()=>({entries,pageInfo:{hasMore:false}}),ref:id=>({timeline:{refetch:input=>refetch(id,input)}})}},checkout:{getLastServerInfoMessage:()=>({version:'0.10.3'}),getCheckoutStatus:async cwd=>({cwd,isGit:true,isDirty:true,currentBranch:'main',error:null}),getCheckoutDiff:()=>{throw Error('Background must not download a diff');}}};
}
const session=id=>({agent:{id,provider:'claude',cwd:'/repo',status:'idle',runtimeInfo:{sessionId:id}},project:{projectName:'Project'}});

test('cached reads and raw API stay responsive while ingestion is hung; late results cannot advance cursors',async()=>{
 const f=fixture({requestMs:30,budgetMs:100});let finish,disconnects=0;
 const a=adapter([session('a')],()=>new Promise(resolve=>{finish=resolve;}));
 f.db.prepare('INSERT INTO events(key,repo,body) VALUES(?,?,?)').run('retained','/repo',JSON.stringify({cli:'codex',changedFiles:[{path:'old.mjs',status:'M'}]}));
 const evidence=f.create({open:async()=>a,disconnect:async()=>{disconnects++;}});
 const api=createApi({db:f.db,open:async()=>({checkout:{ping:async()=>({rttMs:1})}})});
 try {
  const pending=evidence.sync();await tick();
  assert.equal(evidence.status().syncInProgress,true);
  assert.equal(evidence.updates().events[0].cli,'codex');
  assert.equal(evidence.context({repo:'/repo'}).events[0].changedFiles[0].path,'old.mjs');
  assert.equal(evidence.agents().agents[0].cli,'claude');
  assert.equal((await api.call({operation:'ping'},new Set(['paseo:read']),'read')).status,'returned');
  await pending;assert.equal(disconnects,1);assert.equal(evidence.status().connected,false);
  finish(page([item(1)],'cursor-1'));await tick();
  assert.equal(f.db.prepare('SELECT body FROM state WHERE key=?').get('cursor:a'),undefined);
  assert.equal(evidence.updates().events.length,1);
 }finally{await evidence.stop();f.db.close();}
});

test('bounded rotating ingestion covers every session, deduplicates edits and skips unchanged idle sessions',async()=>{
 const f=fixture({maxAgents:2});const visits=[];
 const a=adapter(['a','b','c','d','e'].map(session),async id=>{visits.push(id);return page([item(id.charCodeAt(0))],id);});
 const evidence=f.create({open:async()=>a,disconnect:async()=>{}});
 try {
  await evidence.sync();assert.equal(evidence.status().pendingAgents,3);
  await evidence.sync();await evidence.sync();
  assert.deepEqual([...new Set(visits)].sort(),['a','b','c','d','e']);
  assert.equal(evidence.updates().events.length,5);
  const total=visits.length;await evidence.sync();assert.equal(visits.length,total);
  const first=evidence.updates({limit:2});assert.equal(first.hasMore,true);
  assert.equal(evidence.updates({after:first.nextCursor,limit:10}).events.length,3);
 }finally{await evidence.stop();f.db.close();}
});

test('timeline catch-up resumes from persisted cursor and preserves lifecycle revisions',async()=>{
 const f=fixture();let tail=false;
 const a=adapter([session('a')],async(_id,input)=>{
  if(input.direction==='tail'&&tail)return page([item(3)],'3');
  const seq=Number(input.cursor||0)+1;
  if(seq===3)tail=true;
  return page([item(seq,seq===3?'running':'completed')],String(seq),seq<3);
 });
 const evidence=f.create({open:async()=>a,disconnect:async()=>{}});
 try {
  await evidence.sync();assert.equal(evidence.status().pendingAgents,1);
  await evidence.sync();const events=evidence.updates().events;
  assert.equal(events.length,4);
  assert.deepEqual(events.filter(e=>e.seqStart===3).map(e=>e.changedFiles.length),[0,1]);
  assert.equal(JSON.parse(f.db.prepare('SELECT body FROM state WHERE key=?').get('cursor:a').body),'3');
  assert.equal(evidence.status().pendingAgents,0);
 }finally{await evidence.stop();f.db.close();}
});

test('restart serves retained data with honest freshness; failed catalog refresh keeps the last complete catalog',async()=>{
 const f=fixture({requestMs:10});const timestamp='2026-10-11T04:00:00Z';
 f.save('cache:health',{connected:true,lastSync:timestamp,lastCatalogSync:timestamp});
 f.save('cache:agents',[{...session('saved'),fingerprint:'old'}]);
 f.save('repo:/repo',{files:[{path:'retained.mjs'}],filesObservedAt:timestamp});
 const evidence=f.create({open:async()=>{throw Error('offline');},disconnect:async()=>{}});
 try {
  assert.equal(evidence.status().connected,false);assert.equal(evidence.status().stale,true);
  await evidence.sync();assert.equal(evidence.agents().agents[0].id,'saved');
  assert.equal(evidence.status().lastSync,timestamp);
  assert.equal(evidence.context({repo:'/repo'}).snapshot.files[0].path,'retained.mjs');
 }finally{await evidence.stop();f.db.close();}
});

test('background status cannot replace a retained file list with a false empty diff',async()=>{
 const f=fixture();f.save('repo:/repo',{files:[{path:'retained.mjs'}],filesObservedAt:'old'});
 const evidence=f.create({open:async()=>adapter([session('a')]),disconnect:async()=>{}});
 try {
  await evidence.sync();const snapshot=evidence.context({repo:'/repo'}).snapshot;
  assert.equal(snapshot.files[0].path,'retained.mjs');assert.equal(snapshot.filesObservedAt,'old');assert.equal(snapshot.filesStale,true);
  evidence.rememberDiff('/repo',{files:[{path:'new.mjs',isNew:true,additions:2,deletions:0}]});
  assert.equal(evidence.context({repo:'/repo'}).snapshot.filesStale,false);
  assert.equal(evidence.updates().events[0].cli,'unknown');
 }finally{await evidence.stop();f.db.close();}
});
