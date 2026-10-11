import {normalize,repoEvent,clean,hash} from './core.mjs';

const coverage='Initial timeline tail only; subsequent pages persisted. Outside-Paseo activity requires wrapper ingestion. Shared checkout changes have unknown CLI attribution. Background repository checks collect status only; full file metadata is refreshed by an explicit diff request.';
export function createEvidence({db,open,disconnect,url,pollMs=30000,requestMs=5000,budgetMs=15000,maxAgents=25,maxRepos=5,idleMs=300000,now=Date.now}) {
 db.exec('CREATE INDEX IF NOT EXISTS events_repo_id ON events(repo,id);');
 const state=key=>{const row=db.prepare('SELECT body FROM state WHERE key=?').get(key);return row?JSON.parse(row.body):null;};
 const save=(key,value)=>db.prepare('INSERT OR REPLACE INTO state VALUES(?,?)').run(key,JSON.stringify(value));
 const put=event=>db.prepare('INSERT OR IGNORE INTO events(key,repo,body) VALUES(?,?,?)').run(event.key,event.repo??null,JSON.stringify(event));
 const iso=()=>new Date(now()).toISOString();
 let health={lastSync:null,errors:[],...state('cache:health'),connected:false,url,coverage};
 let agents=state('cache:agents')||[],position=state('cache:position')||{agents:0,repos:0};
 let busy=null,stopped=false,deadline=0;
 const due=entry=>{const previous=state(`seen:${entry.agent.id}`);return !previous||previous.catchup||previous.fingerprint!==entry.fingerprint||entry.agent.status==='running'||now()-previous.checkedAt>=idleMs;};
 function status() {
  const cacheAgeMs=health.lastSync?Math.max(0,now()-Date.parse(health.lastSync)):null;
  const catalogAgeMs=health.lastCatalogSync?Math.max(0,now()-Date.parse(health.lastCatalogSync)):null;
  return {...health,connected:health.connected&&catalogAgeMs!==null&&catalogAgeMs<=Math.max(pollMs*2,budgetMs*2),agents:agents.length,cacheAgeMs,catalogAgeMs,stale:!health.connected||cacheAgeMs===null||cacheAgeMs>Math.max(pollMs*2,budgetMs*2),syncInProgress:!!busy};
 }
 async function request(fn,label) {
  if(stopped)throw Error('Evidence collector stopped');
  const remaining=deadline-now();
  if(remaining<=0)throw Object.assign(Error('Background refresh budget reached'),{deadline:true});
  let timer;
  try {
   const result=await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Object.assign(Error(`${label}: background request deadline reached`),{deadline:true})),Math.min(requestMs,remaining));
   })]);
   if(stopped)throw Error('Evidence collector stopped');
   return result;
  }finally{clearTimeout(timer);}
 }
 function persistPage(entry,page) {
  if(page.error)throw Error(typeof page.error==='string'?page.error:JSON.stringify(page.error));
  const {agent,project}=entry;
  if(page.gap||page.staleCursor||page.reset)put({key:`gap:${agent.id}:${page.epoch}:${hash(page.window??null)}`,repo:agent.cwd,cli:agent.provider,session:agent.id,timestamp:iso(),outcome:'Timeline gap or replacement; history may be incomplete',changedFiles:[],errors:['History gap'],tests:[],attribution:'coverage_notice'});
  for(const item of page.entries)put(normalize(agent,item,project,page.epoch));
 }
 async function timeline(client,entry) {
  const {agent}=entry,ref=client.agents.ref(agent.id);
  let cursor=state(`cursor:${agent.id}`),catchup=false;
  for(let pageNumber=0;pageNumber<2;pageNumber++) {
   const page=await request(()=>ref.timeline.refetch({projection:'projected',limit:100,...(cursor?{direction:'after',cursor}:{direction:'tail'})}),`Timeline ${agent.id}`);
   persistPage(entry,page);
   if(page.hasNewer&&(!page.endCursor||hash(page.endCursor)===hash(cursor)))throw Error('Timeline pagination did not advance');
   if(page.endCursor){cursor=page.endCursor;save(`cursor:${agent.id}`,cursor);}
   catchup=!!page.hasNewer;
   if(!catchup)break;
  }
  // An old sequence position may change from running to completed without a
  // new cursor. Revisit the projected tail even when no new entries arrived.
  if(!catchup&&now()<deadline)persistPage(entry,await request(()=>ref.timeline.refetch({projection:'projected',limit:20,direction:'tail'}),`Timeline tail ${agent.id}`));
  save(`seen:${agent.id}`,{fingerprint:entry.fingerprint,checkedAt:now(),catchup});
 }
 async function collect() {
  const errors=[];deadline=now()+budgetMs;health={...health,lastSyncStarted:iso()};
  try {
   const {client,checkout}=await request(open,'Daemon connection');
   health={...health,connected:true,daemon:checkout.getLastServerInfoMessage()?.version,lastConnectionCheck:iso()};
   const next=[],cursors=new Set();let cursor;
   do {
    const page=await request(()=>client.agents.list({limit:100,...(cursor?{cursor}:{})}),'Agent catalog');
    for(const {agent,project} of page.entries)next.push({agent:{id:agent.id,provider:agent.provider,cwd:agent.cwd,title:clean(agent.title),status:agent.status,runtimeInfo:{sessionId:agent.runtimeInfo?.sessionId},requiresAttention:agent.requiresAttention},project:{projectName:project?.projectName},fingerprint:hash({agent,project})});
    cursor=page.pageInfo.hasMore?page.pageInfo.nextCursor:null;
    if(page.pageInfo.hasMore&&(!cursor||cursors.has(JSON.stringify(cursor))))throw Error('Agent catalog pagination incomplete');
    if(cursor)cursors.add(JSON.stringify(cursor));
   }while(cursor);
   // Publish only a complete catalog. A failed refresh preserves the last
   // good catalog, repository snapshots, event history and timeline cursors.
   agents=next;save('cache:agents',agents);health.lastCatalogSync=iso();
   const ring=agents.map((_,index)=>({entry:agents[(index+position.agents)%agents.length],index:(index+position.agents)%agents.length}));
   const urgent=[],routine=[];
   for(const candidate of ring)if(due(candidate.entry)){
    const previous=state(`seen:${candidate.entry.agent.id}`);
    (candidate.entry.agent.status==='running'||(previous&&previous.fingerprint!==candidate.entry.fingerprint)?urgent:routine).push(candidate);
   }
   let count=0;
   while((urgent.length||routine.length)&&count<maxAgents&&now()<deadline) {
    const candidate=(urgent.length&&(count%3!==2||!routine.length)?urgent:routine.length?routine:urgent).shift();
    position.agents=(candidate.index+1)%agents.length;count++;
    try{await timeline(client,candidate.entry);}catch(error){errors.push(`${candidate.entry.agent.id}: ${clean(error.message)}`);if(error.deadline)throw error;}
   }
   const repos=[...new Set(agents.map(entry=>entry.agent.cwd).filter(Boolean))];
   for(let count=0;count<Math.min(maxRepos,repos.length)&&now()<deadline;count++) {
    const cwd=repos[position.repos%repos.length];position.repos=(position.repos+1)%repos.length;
    try {
     const result=await request(()=>checkout.getCheckoutStatus(cwd),`Repository status ${cwd}`);
     if(result.error&&result.error.code!=='NOT_GIT_REPO')throw Error(result.error.message||JSON.stringify(result.error));
     const previous=state(`repo:${cwd}`)||{};
     // SDK 0.10.3 status has no file list; do not misrepresent it as an empty
     // diff or repeatedly download large repository patches in the background.
     save(`repo:${cwd}`,{...previous,status:result,statusObservedAt:iso(),files:previous.files??null,filesObservedAt:previous.filesObservedAt??null,filesStale:true});
    }catch(error){errors.push(`${cwd}: ${clean(error.message)}`);if(error.deadline)throw error;}
   }
   health={...health,lastSync:iso(),pendingAgents:agents.filter(due).length};
  }catch(error) {
   errors.push(clean(error.message));health={...health,connected:false};
   await disconnect();
  }finally {
   if(!stopped){health={...health,errors,lastSyncFinished:iso()};save('cache:health',health);save('cache:position',position);}
  }
  return status();
 }
 function sync() {
  if(stopped)return Promise.resolve(status());
  if(busy)return busy;
  busy=collect().finally(()=>busy=null);return busy;
 }
 return {
  sync,status,
  agents:()=>({health:status(),agents:agents.map(({agent:a,project})=>({id:a.id,cli:a.provider,repo:a.cwd,project:project?.projectName,title:a.title,status:a.status,session:a.runtimeInfo?.sessionId,requiresAttention:a.requiresAttention}))}),
  hasRepo:repo=>agents.some(entry=>entry.agent.cwd===repo),
  updates({after=0,limit=50,repo}={}) {
   const rows=repo?db.prepare('SELECT id,body FROM events WHERE id>? AND repo=? ORDER BY id LIMIT ?').all(after,repo,limit):db.prepare('SELECT id,body FROM events WHERE id>? ORDER BY id LIMIT ?').all(after,limit);
   const nextCursor=rows.at(-1)?.id??after;
   return {health:status(),events:rows.map(row=>({id:row.id,...JSON.parse(row.body)})),nextCursor,hasMore:!!db.prepare(`SELECT id FROM events WHERE id>? ${repo?'AND repo=?':''} LIMIT 1`).get(...(repo?[nextCursor,repo]:[nextCursor]))};
  },
  context({repo,limit=30}) {return {health:status(),repo,snapshot:state(`repo:${repo}`),events:db.prepare('SELECT id,body FROM events WHERE repo=? ORDER BY id DESC LIMIT ?').all(repo,limit).reverse().map(row=>({id:row.id,...JSON.parse(row.body)}))};},
  rememberDiff(repo,diff) {
   const previous=state(`repo:${repo}`)||{},status=previous.status||{};
   if(diff.error)return;
   const event=repoEvent(repo,status,diff);
   save(`repo:${repo}`,{...previous,signature:event.key,files:event.changedFiles,filesObservedAt:iso(),filesStale:false,errors:event.errors});
   if(previous.signature!==event.key){event.key+=':'+event.timestamp;put(event);}
  },
  async stop() {stopped=true;await disconnect();if(busy)await busy;}
 };
}
