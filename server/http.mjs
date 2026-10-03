import {createServer} from 'node:http';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {authConfig,tokenVerifier,protectedMetadata} from './auth.mjs';
import {decorateOAuthTools} from './oauth-tools.mjs';

export function startHttp(makeServer,config=authConfig(),verify=tokenVerifier(config)) {
 const listener=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  // Reject browser cross-origin requests; this loopback service is for tunnel-client.
  if(req.headers.origin){res.writeHead(403).end();return;}
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method==='GET'&&['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'].includes(path)) {
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(protectedMetadata(config)));return;
  }
  if(path!=='/mcp'){res.writeHead(404).end();return;}
  let identity;
  try{identity=await verify(req.headers.authorization);}catch {
   res.setHeader('WWW-Authenticate',`Bearer resource_metadata="http://127.0.0.1:${config.port}/.well-known/oauth-protected-resource", scope="${config.scope}"`);
   res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Unauthorized'}));return;
  }
  if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'}).end();return;}
  if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415).end();return;}
  let body='';
  try {
   for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1048576){res.writeHead(413).end();return;}}
   const parsed=JSON.parse(body);
   const server=makeServer({scopes:new Set(identity.scope.split(' '))}),transport=decorateOAuthTools(new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true}));
   res.on('close',()=>void server.close());
   await server.connect(transport);await transport.handleRequest(req,res,parsed);
  }catch {
   if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Invalid MCP request'}));
   else res.end();
  }
 });
 listener.requestTimeout=30000;listener.headersTimeout=10000;
 listener.listen(config.port,'127.0.0.1',()=>console.error(`OAuth-protected Paseo listening on loopback port ${config.port}`));
 return listener;
}
