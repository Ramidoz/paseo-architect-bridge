import {readFile,stat} from 'node:fs/promises';
import {authConfig} from '../server/auth.mjs';

const allowed=new Set(['PASEO_URL','PASEO_PASSWORD','PASEO_DB','PASEO_POLL_MS','PASEO_OAUTH_ISSUER','PASEO_OAUTH_RESOURCE','PASEO_OAUTH_SUBJECT','PASEO_HTTP_PORT','CONTROL_PLANE_API_KEY','CONTROL_PLANE_TUNNEL_ID']);

// Deliberately does not evaluate shell expressions, interpolation or escapes.
export function parseConfig(text) {
 const env={};
 for(const [index,line] of text.split(/\r?\n/).entries()) {
  if(!line.trim()||line.trimStart().startsWith('#'))continue;
  const match=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if(!match||!allowed.has(match[1]))throw Error(`Unsupported configuration at line ${index+1}`);
  let value=match[2].trim();
  if(value.startsWith('"')||value.startsWith("'")) {
   if(value.at(-1)!==value[0])throw Error(`Unclosed quote at line ${index+1}`);
   value=value.slice(1,-1);
  }
  if(Object.hasOwn(env,match[1]))throw Error(`Duplicate setting ${match[1]}`);
  env[match[1]]=value;
 }
 return env;
}

export function validateConfig(env) {
 const auth=authConfig(env);
 const daemon=new URL(env.PASEO_URL||'ws://127.0.0.1:6767/ws');
 if(!['ws:','wss:'].includes(daemon.protocol)||daemon.username||daemon.password)throw Error('PASEO_URL must be ws:// or wss:// without embedded credentials');
 if(daemon.protocol==='ws:'&&!['127.0.0.1','localhost','[::1]'].includes(daemon.hostname))throw Error('Use wss:// for a non-loopback Paseo daemon, or an SSH loopback forward');
 if(!/^tunnel_[a-zA-Z0-9]+$/.test(env.CONTROL_PLANE_TUNNEL_ID||''))throw Error('Set CONTROL_PLANE_TUNNEL_ID');
 if(!env.CONTROL_PLANE_API_KEY||env.CONTROL_PLANE_API_KEY.includes('REPLACE'))throw Error('Set the restricted tunnel runtime API key');
 if(env.PASEO_POLL_MS&&(!/^\d+$/.test(env.PASEO_POLL_MS)||Number(env.PASEO_POLL_MS)<1000))throw Error('PASEO_POLL_MS must be at least 1000');
 return auth;
}

export async function loadConfig(path) {
 const info=await stat(path);
 if(!info.isFile()||(info.mode&0o077))throw Error('Configuration must be a regular file readable only by its owner (chmod 600)');
 if(process.getuid&&info.uid!==process.getuid())throw Error('Configuration must belong to the current user');
 const env=parseConfig(await readFile(path,'utf8'));
 validateConfig(env);
 return env;
}
