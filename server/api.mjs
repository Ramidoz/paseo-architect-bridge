import Ajv from 'ajv';
import {randomUUID,createHash} from 'node:crypto';
import catalog from './catalog.json' with {type:'json'};
export {catalog};
const ajv=new Ajv({strict:false,allErrors:true});
const entries=new Map(catalog.operations.map(o=>[o.name,{...o,validate:ajv.compile({type:'object',properties:Object.fromEntries(o.parameters.map(p=>[p.name,p.schema])),required:o.parameters.filter(p=>!p.optional).map(p=>p.name),additionalProperties:false})}]));
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const forbiddenKeys=new Set(['onEvent','signal','subscribe','predicate','__proto__','prototype','constructor']);
const decode=x=>x&&typeof x==='object'?(Object.keys(x).length===1&&typeof x.$base64==='string'?new Uint8Array(Buffer.from(x.$base64,'base64')):Array.isArray(x)?x.map(decode):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))):x;
function checkJson(value){if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){if(forbiddenKeys.has(key))throw Error(`Non-JSON transport option ${key} is not exposed`);checkJson(v);}}
function serialize(value) {
 return JSON.stringify(value??null,(_key,v)=>{
  if(typeof v==='bigint')return v.toString();
  if(v instanceof ArrayBuffer)return {encoding:'base64',data:Buffer.from(v).toString('base64')};
  if(ArrayBuffer.isView(v))return {encoding:'base64',data:Buffer.from(v.buffer,v.byteOffset,v.byteLength).toString('base64')};
  return v;
 });
}
export function createApi({db,open,enabled=['read']}) {
 db.exec('CREATE TABLE IF NOT EXISTS api_requests (key TEXT PRIMARY KEY, operation TEXT, fingerprint TEXT, scope TEXT, status TEXT, body TEXT, timestamp TEXT);');
 const get=key=>db.prepare('SELECT * FROM api_requests WHERE key=?').get(key);
 const result=(row,offset=0,limit=32000)=>({requestKey:row.key,operation:row.operation,status:row.status,timestamp:row.timestamp,...(row.body.length<=limit&&offset===0?{result:JSON.parse(row.body)}:{serializedResult:row.body.slice(offset,offset+limit),offset,nextOffset:offset+limit<row.body.length?offset+limit:null,totalChars:row.body.length}),note:'RPC return is not proof that an agent task or terminal command finished.'});
 function permit(scope,scopes){if(!enabled.includes(scope)||!scopes.has(`paseo:${scope}`))throw Error(`Requires enabled paseo:${scope} access`);}
 return {
  describe(operation){if(operation){const item=entries.get(operation);if(!item)throw Error('Operation not in pinned API catalog');const {validate,...data}=item;return data;}return {sdk:catalog.sdk,version:catalog.version,enabledScopes:enabled,operations:catalog.operations.map(({name,scope})=>({name,scope})),omitted:catalog.omitted};},
  result({requestKey,offset=0,limit=32000},scopes){const row=get(requestKey);if(!row)throw Error('Unknown request key');permit(row.scope,scopes);return result(row,offset,limit);},
  async call({operation,parameters={},idempotencyKey},scopes,expectedScope) {
   const item=entries.get(operation);if(!item||item.scope!==expectedScope)throw Error('Operation is not allowed by this tool');
   permit(item.scope,scopes);checkJson(parameters);
   if(!item.validate(parameters))throw Error('Invalid parameters: '+ajv.errorsText(item.validate.errors));
   const mutating=item.scope!=='read';
   if(mutating&&(!idempotencyKey||!/^[-a-zA-Z0-9_.:]{8,128}$/.test(idempotencyKey)))throw Error('Mutations require a unique idempotencyKey (8–128 safe characters)');
   const key=mutating?idempotencyKey:randomUUID();
   const fingerprint=createHash('sha256').update(JSON.stringify(canonical({operation,parameters}))).digest('hex');
   const existing=get(key);
   if(existing){if(existing.fingerprint!==fingerprint)throw Error('Idempotency key already used for different parameters');return result(existing);}
   db.prepare('INSERT INTO api_requests VALUES (?,?,?,?,?,?,?)').run(key,operation,fingerprint,item.scope,'pending','null',new Date().toISOString());
   try {
    const {checkout}=await open();if(typeof checkout[operation]!=='function')throw Error('Pinned daemon adapter method unavailable');
    const args=item.parameters.map(p=>decode(parameters[p.name]));
    const raw=await checkout[operation](...args);
    db.prepare('UPDATE api_requests SET status=?,body=? WHERE key=?').run('returned',serialize(raw),key);
   }catch(e){
    // A lost acknowledgement cannot tell us whether the daemon executed a write.
    // Persist uncertainty and never resend that key, including after restart.
    db.prepare('UPDATE api_requests SET status=?,body=? WHERE key=?').run(mutating?'indeterminate':'error',serialize({error:String(e.message),code:e.code??null}),key);
   }
   return result(get(key));
  }
 };
}
