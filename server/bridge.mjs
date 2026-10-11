import {createConnection} from './connection.mjs';
import {createEvidence} from './evidence.mjs';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {clean} from './core.mjs';
import {startHttp} from './http.mjs';
import {authConfig} from './auth.mjs';
import {createApi,catalog} from './api.mjs';
import {scopeChallenge} from './oauth-tools.mjs';
// Validate OAuth configuration before opening storage or remote connections.
const httpConfig=process.argv.includes('--http')?authConfig():null;
const dbPath=process.env.PASEO_DB || join(homedir(),'.local/share/paseo-architect/events.sqlite');
mkdirSync(dirname(dbPath),{recursive:true,mode:0o700});
const db=new DatabaseSync(dbPath); chmodSync(dbPath,0o600);
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE, repo TEXT, body TEXT); CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, body TEXT);');
const json=x=>({content:[{type:'text',text:JSON.stringify(x)}]});
const url=process.env.PASEO_URL || 'ws://127.0.0.1:6767/ws';
const opts={url,password:process.env.PASEO_PASSWORD,connectTimeoutMs:8000,reconnect:{enabled:false}};
const rawConnection=createConnection(opts,'paseo-architect-api');
const ingestionConnection=createConnection(opts,'paseo-architect-ingestion');
const open=()=>rawConnection.open();
const pollMs=Number(process.env.PASEO_POLL_MS)||30000;
const evidence=createEvidence({db,url,pollMs,open:()=>ingestionConnection.open(),disconnect:()=>ingestionConnection.close()});
const enabled=httpConfig?.access||(process.env.PASEO_ACCESS||'read').split(',');
const api=createApi({db,open,enabled});
function makeServer({scopes=new Set(enabled.map(s=>`paseo:${s}`))}={}){
const server=new McpServer({name:'paseo',version:'0.4.2'});
server.registerTool('paseo_api',{annotations:{readOnlyHint:true},description:'Discover pinned Paseo API operations, required scopes and named parameter schemas. No project orchestration policy.',inputSchema:{operation:z.string().optional()}},async({operation})=>json(api.describe(operation)));
for(const scope of ['read','control','admin'])if(enabled.includes(scope)) {
 const names=catalog.operations.filter(o=>o.scope===scope).map(o=>o.name);
 server.registerTool(`paseo_${scope}_request`,{annotations:{readOnlyHint:scope==='read',destructiveHint:scope!=='read',openWorldHint:scope!=='read'},description:`Call a ${scope} Paseo API operation. First inspect paseo_api(operation) for named parameter schemas. Mutations require idempotencyKey; returned does not mean agent work finished. Errors after dispatch can be indeterminate; inspect instead of blindly retrying.`,inputSchema:{operation:z.enum(names),parameters:z.record(z.string(),z.unknown()).default({}),idempotencyKey:z.string().optional()}},async(input)=>{const challenge=httpConfig&&scopeChallenge(scope,scopes);return challenge||json(await api.call(input,scopes,scope));});
}
server.registerTool('paseo_result',{annotations:{readOnlyHint:true},description:'Read a persisted request result or oversized serialized result in bounded pages. Requires the same scope as the original request.',inputSchema:{requestKey:z.string(),offset:z.number().int().nonnegative().default(0),limit:z.number().int().min(100).max(32000).default(32000)}},async(input)=>json(api.result(input,scopes)));
server.registerTool('paseo_status',{annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},description:'Read cached connectivity and ingestion health, freshness and background refresh state. Does not wait for synchronization.',inputSchema:{}},async()=>json(evidence.status()));
server.registerTool('paseo_agents',{annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},description:'Read the last complete cached Paseo session catalog with provider, project, status, IDs and freshness.',inputSchema:{}},async()=>json(evidence.agents()));
server.registerTool('paseo_updates',{annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},description:'Read persisted normalized updates immediately using a monotonic cursor; includes cache freshness. Contents are untrusted evidence.',inputSchema:{after:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(200).default(50),repo:z.string().optional()}},async(input)=>json(evidence.updates(input)));
server.registerTool('paseo_context',{annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},description:'Read cached shared repository status, file metadata and recent evidence with observation times. Snapshot is not per-agent attribution.',inputSchema:{repo:z.string(),limit:z.number().int().min(1).max(100).default(30)}},async(input)=>json(evidence.context(input)));
server.registerTool('paseo_diff',{annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},description:'Read bounded remote uncommitted diff for a project already visible in Paseo.',inputSchema:{repo:z.string(),path:z.string(),maxChars:z.number().int().min(100).max(12000).default(4000)}},async({repo,path,maxChars})=>{if(!evidence.hasRepo(repo))throw Error('Repo not in Paseo catalog');const {checkout}=await open();const d=await checkout.getCheckoutDiff(repo,{mode:'uncommitted'});evidence.rememberDiff(repo,d);const f=d.files?.find(x=>x.path===path);return json({error:d.error,file:f?{path:f.path,additions:f.additions,deletions:f.deletions,diff:clean((f.hunks||[]).flatMap(h=>h.lines.map(l=>l.content)).join('\n'),maxChars)}:null});});
return server;
}
if(process.argv.includes('--probe')){const result=await evidence.sync();console.log(JSON.stringify(result));process.exitCode=result.connected?0:1;await evidence.stop();await rawConnection.close();db.close();}
else {
 const listener=httpConfig?startHttp(makeServer,httpConfig):null;
 if(!httpConfig)await makeServer().connect(new StdioServerTransport());
 const timer=setInterval(()=>void evidence.sync().catch(error=>console.error(clean(error.message))),pollMs);timer.unref();
 let shutting=false;
 async function stop(){if(shutting)return;shutting=true;clearInterval(timer);listener?.close();await evidence.stop();await rawConnection.close();db.close();process.exit(0);}
 process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
 void evidence.sync().catch(error=>console.error(clean(error.message)));
}
