import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {WebSocketServer} from 'ws';

test('actual MCP summary tools return retained evidence promptly while the daemon connection hangs',async()=>{
 const daemon=new WebSocketServer({host:'127.0.0.1',port:0});
 await new Promise(resolve=>daemon.once('listening',resolve));
 // Accept the sockets but send no daemon handshake or RPC acknowledgement.
 const url=`ws://127.0.0.1:${daemon.address().port}/ws`;
 const dir=mkdtempSync(join(tmpdir(),'paseo-cache-test-')),dbPath=join(dir,'events.sqlite');
 const db=new DatabaseSync(dbPath);
 db.exec('CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,key TEXT UNIQUE,repo TEXT,body TEXT); CREATE TABLE state(key TEXT PRIMARY KEY,body TEXT);');
 db.prepare('INSERT INTO events(key,repo,body) VALUES(?,?,?)').run('fixture','/fixture',JSON.stringify({cli:'claude',outcome:'Updated fixture',changedFiles:[{path:'fixture.mjs',status:'M'}]}));
 db.prepare('INSERT INTO state VALUES(?,?)').run('cache:agents',JSON.stringify([{agent:{id:'fixture',provider:'claude',cwd:'/fixture',status:'idle'},project:{projectName:'Fixture'}}]));
 db.close();
 const client=new Client({name:'cache-regression',version:'1.0.0'});
 const entryPoint=process.env.PASEO_TEST_BUNDLE?'./dist/bridge.mjs':'./bridge.mjs';
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL(entryPoint,import.meta.url))],env:{...process.env,PASEO_DB:dbPath,PASEO_URL:url,PASEO_ACCESS:'read',PASEO_POLL_MS:'30000'},stderr:'pipe'});
 try {
  await client.connect(transport);
  const {tools}=await client.listTools();
  for(const name of ['paseo_status','paseo_agents','paseo_updates','paseo_context']) {
   assert.match(tools.find(tool=>tool.name===name).description,/immediately/);
  }
  assert.match(tools.find(tool=>tool.name==='paseo_diff').description,/on demand/);
  assert.match(tools.find(tool=>tool.name==='paseo_context').description,/filesStale/);
  const timings={};
  for(const [name,args] of [['paseo_status',{}],['paseo_agents',{}],['paseo_updates',{repo:'/fixture'}],['paseo_context',{repo:'/fixture'}]]) {
   const start=performance.now();const result=await client.callTool({name,arguments:args},undefined,{timeout:1000});timings[name]=Math.round(performance.now()-start);
   assert.equal(result.isError,undefined);const payload=JSON.parse(result.content[0].text);
   assert.equal((payload.health||payload).syncInProgress,true);
   if(name==='paseo_updates'||name==='paseo_context')assert.equal(payload.events[0].changedFiles[0].path,'fixture.mjs');
   if(name==='paseo_agents')assert.equal(payload.agents[0].cli,'claude');
  }
  console.log('Cached MCP response times (ms):',JSON.stringify(timings));
 }finally{for(const socket of daemon.clients)socket.terminate();await new Promise(resolve=>daemon.close(resolve));await client.close();rmSync(dir,{recursive:true,force:true});}
});
