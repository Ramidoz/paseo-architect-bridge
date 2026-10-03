import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,exportJWK,createLocalJWKSet} from 'jose';
import {authConfig,tokenVerifier} from './auth.mjs';
import {startHttp} from './http.mjs';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {scopeChallenge} from './oauth-tools.mjs';
const config=authConfig({PASEO_OAUTH_ISSUER:'https://tenant.example/',PASEO_OAUTH_RESOURCE:'https://api.example/mcp',PASEO_OAUTH_SUBJECT:'google-oauth2|owner',PASEO_HTTP_PORT:'18768'});
const pair=await generateKeyPair('RS256');
const key=await exportJWK(pair.publicKey);key.kid='test';key.alg='RS256';
const verify=tokenVerifier(config,createLocalJWKSet({keys:[key]}));
async function sign(overrides={},privateKey=pair.privateKey){return new SignJWT({scope:'paseo:read',sub:config.subject,iss:config.issuer,aud:config.resource,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60,...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(privateKey);}
test('only the exact owner with a valid Paseo access token is accepted',async()=>{
 assert.equal((await verify('Bearer '+await sign())).sub,config.subject);
 for(const changes of [{sub:'google-oauth2|other'},{iss:'https://attacker.example/'},{aud:'https://other-api.example/'},{scope:'openid profile'},{scope:''},{exp:1},{iat:undefined},{exp:undefined}])await assert.rejects(verify('Bearer '+await sign(changes)));
 const stranger=await generateKeyPair('RS256');await assert.rejects(verify('Bearer '+await sign({},stranger.privateKey)));
 for(const header of [undefined,'','Basic secret','Bearer a b','Bearer garbage'])await assert.rejects(verify(header));
});
test('HTTP endpoints never instantiate MCP or expose project data before authorization',async()=>{
 let calls=0;const listener=startHttp(()=>{calls++;throw Error('must not reach MCP');},{...config,port:0});
 await new Promise(resolve=>listener.once('listening',resolve));
 try {
  const base=`http://127.0.0.1:${listener.address().port}`;
  for(const method of ['POST','GET','DELETE'])assert.equal((await fetch(base+'/mcp',{method})).status,401);
  assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer invalid'}})).status,401);
  assert.equal((await fetch(base+'/mcp',{headers:{Origin:'https://attacker.example'}})).status,403);
  const response=await fetch(base+'/.well-known/oauth-protected-resource');assert.equal(response.status,200);
  assert.deepEqual((await response.json()).authorization_servers,[config.issuer]);assert.equal(calls,0);
 }finally{await new Promise(resolve=>listener.close(resolve));}
});
test('missing identity configuration and insecure issuers fail closed',()=>{
 assert.throws(()=>authConfig({}));
 assert.throws(()=>authConfig({PASEO_OAUTH_ISSUER:'http://tenant.example/',PASEO_OAUTH_RESOURCE:config.resource,PASEO_OAUTH_SUBJECT:config.subject}));
});
test('authenticated stateless MCP initializes, discovers and calls tools; a different owner is rejected',async()=>{
 let controls=0;
 const listener=startHttp(({scopes})=>{
  const server=new McpServer({name:'fixture',version:'1.0.0'});
  server.registerTool('fixture_read',{description:'Synthetic read',annotations:{readOnlyHint:true},inputSchema:{}},async()=>({content:[{type:'text',text:'synthetic result'}]}));
  server.registerTool('paseo_control_request',{description:'Synthetic control',annotations:{readOnlyHint:false},inputSchema:{}},async()=>{const challenge=scopeChallenge('control',scopes);if(challenge)return challenge;controls++;return {content:[{type:'text',text:'accepted'}]};});
  return server;
 },{...config,port:0},verify);
 await new Promise(resolve=>listener.once('listening',resolve));
 const base=`http://127.0.0.1:${listener.address().port}/mcp`;
 const headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+await sign()};
 async function rpc(id,method,params){const response=await fetch(base,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id,method,params})});assert.equal(response.status,200);return response.json();}
 try {
  assert.equal((await rpc(1,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'fixture',version:'1'}})).result.serverInfo.name,'fixture');
  const tools=(await rpc(2,'tools/list',{})).result.tools;assert.equal(tools.length,2);assert.equal(tools[0].annotations.readOnlyHint,true);
  assert.equal((await rpc(3,'tools/call',{name:'fixture_read',arguments:{}})).result.content[0].text,'synthetic result');
  assert.equal((await rpc(4,'tools/call',{name:'paseo_control_request',arguments:{}})).result.isError,true);assert.equal(controls,0);
  assert.deepEqual(tools.find(t=>t.name==='paseo_control_request').securitySchemes,[{type:'oauth2',scopes:['paseo:read','paseo:control']}]);
  assert.match((await rpc(41,'tools/call',{name:'paseo_control_request',arguments:{}})).result._meta['mcp/www_authenticate'][0],/insufficient_scope/);
  headers.Authorization='Bearer '+await sign({scope:'paseo:read paseo:control'});
  assert.equal((await rpc(5,'tools/call',{name:'paseo_control_request',arguments:{}})).result.content[0].text,'accepted');assert.equal(controls,1);
  assert.equal((await fetch(base,{method:'POST',headers:{...headers,Authorization:'Bearer '+await sign({sub:'google-oauth2|other'})},body:'{}'})).status,401);
 }finally{await new Promise(resolve=>listener.close(resolve));}
});
