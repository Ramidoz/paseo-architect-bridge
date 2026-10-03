#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.mjs';
import {installService} from './service.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2),command=argv.shift();
function option(name,fallback){const i=argv.indexOf(name);if(i<0)return fallback;if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error(`Missing value for ${name}`);return argv[i+1];}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function run(env,tunnel) {
 const port=Number(env.PASEO_HTTP_PORT||18767),base=`http://127.0.0.1:${port}`;
 // Fail rather than quietly connecting the tunnel to somebody else's local listener.
 try{await fetch(base+'/.well-known/oauth-protected-resource',{signal:AbortSignal.timeout(1000)});throw Error(`Port ${port} is already occupied`);}catch(e){if(e.message?.includes('already occupied'))throw e;}
 let shutting=false,bridge,tunnelChild;
 const children=[];
 async function stop(code){
  if(shutting)return;shutting=true;
  for(const child of children)child.kill('SIGTERM');
  for(let i=0;i<50&&children.some(c=>c.exitCode===null&&c.signalCode===null);i++)await sleep(100);
  for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
  process.exit(code);
 }
 process.on('SIGTERM',()=>void stop(0));process.on('SIGINT',()=>void stop(0));
 function launch(exe,args,childEnv){
  const child=spawn(exe,args,{env:childEnv,stdio:'inherit'});children.push(child);
  child.on('error',()=>{console.error('A service child could not start');void stop(1);});
  child.on('exit',()=>{if(!shutting){console.error('A service child exited; stopping both for supervisor restart');void stop(1);}});
  return child;
 }
 // OAuth resource-server process does not receive the OpenAI runtime credential.
 const bridgeEnv={...process.env,...env};delete bridgeEnv.CONTROL_PLANE_API_KEY;
 bridge=launch(process.execPath,[join(root,'server/dist/bridge.mjs'),'--http'],bridgeEnv);
 let ready=false;
 for(let i=0;i<40&&!shutting;i++) {
  try {const response=await fetch(base+'/.well-known/oauth-protected-resource',{signal:AbortSignal.timeout(1000)});const metadata=await response.json();if(response.ok&&metadata.resource===env.PASEO_OAUTH_RESOURCE){ready=true;break;}}catch{}
  await sleep(250);
 }
 if(!ready){console.error('Protected bridge did not become ready');await stop(1);return;}
 tunnelChild=launch(tunnel,['run','--control-plane.tunnel-id',env.CONTROL_PLANE_TUNNEL_ID,'--control-plane.api-key','env:CONTROL_PLANE_API_KEY','--mcp.server-url',base+'/mcp','--harpoon.allow-plaintext-http','--health.listen-addr','127.0.0.1:18768','--mcp.startup-wait-timeout','10s'],{...process.env,CONTROL_PLANE_API_KEY:env.CONTROL_PLANE_API_KEY});
 console.log('Paseo bridge and outbound authenticated tunnel running; operator health on loopback port 18768');
}

try {
 const [major,minor]=process.versions.node.split('.').map(Number);
 if(major<22||(major===22&&minor<13))throw Error('Node.js 22.13 or newer is required');
 if(!command||['help','--help','-h'].includes(command))console.log(`Paseo architect bridge (Linux and macOS)\n\nrun      --config /private/bridge.env --tunnel-bin /path/tunnel-client\ninstall  --config /private/bridge.env --tunnel-bin /path/tunnel-client [--start] [--dry-run]\nprobe    --config /private/bridge.env\n\nInstall creates a user service. run requires the bundled server (npm run build).\nConfiguration is never interpreted as shell code. No project write tools exist.`);
 else {
  if(!['run','install','probe'].includes(command))throw Error('Unknown command; use --help');
  const config=resolve(option('--config',join(process.env.HOME,'.config/paseo-architect/bridge.env')));
  const env=await loadConfig(config);
  if(command==='probe') {
   const probeEnv={...process.env,...env};delete probeEnv.CONTROL_PLANE_API_KEY;
   const child=spawn(process.execPath,[join(root,'server/dist/bridge.mjs'),'--probe'],{env:probeEnv,stdio:'inherit'});
   child.on('error',()=>{console.error('Probe failed to start');process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
  } else {
   const tunnel=resolve(option('--tunnel-bin',join(process.env.HOME,'.local/bin/tunnel-client')));
   await access(tunnel,constants.X_OK);await access(join(root,'server/dist/bridge.mjs'));
   if(command==='install')await installService({node:process.execPath,cli:fileURLToPath(import.meta.url),config,tunnel},{start:argv.includes('--start'),dryRun:argv.includes('--dry-run')});
   else await run(env,tunnel);
  }
 }
}catch(e){console.error(e.message);process.exitCode=1;}
