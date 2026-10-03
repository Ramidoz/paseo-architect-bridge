import ts from 'typescript';
import {readFile,writeFile} from 'node:fs/promises';
const path='node_modules/@getpaseo/client/dist/daemon-client.d.ts';
const program=ts.createProgram([path],{strictNullChecks:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,moduleResolution:ts.ModuleResolutionKind.NodeNext,module:ts.ModuleKind.NodeNext});
const checker=program.getTypeChecker(),source=program.getSourceFile(path);
const excluded=new Set(['connect','close','ensureConnected','getConnectionState','getLastLivenessRttMs','getLastServerInfoMessage','setReconnectEnabled','registerPushToken','unregisterPushToken','sendHeartbeat','registerBrowserHost','sendBrowserAutomationExecuteResponse']);
const sensitive=/DaemonConfig|DaemonPairing|Diagnostics|Plugin|AgentSkills|Hub|restartServer|shutdownServer|updateDaemon|readProjectConfig|writeProjectConfig|requestDownloadToken/i;
const reads=/^(fetch|list|get|inspect|search|suggest|validate|capture|buildAgentForkContext|waitForFinish|ping|measureLatency|readFile|readProjectConfig|requestProjectIcon)/;
function schema(type,depth=0,seen=new Set()) {
 if(['Uint8Array','Buffer','ArrayBuffer'].includes(type.symbol?.name))return {type:'object',properties:{$base64:{type:'string'}},required:['$base64'],additionalProperties:false};
 if(depth>7||seen.has(type))return {};
 const next=new Set(seen).add(type);
 if(type.isUnion())return {anyOf:type.types.filter(t=>!(t.flags&ts.TypeFlags.Undefined)).map(t=>schema(t,depth+1,next))};
 if(type.flags&ts.TypeFlags.StringLiteral)return {const:type.value};
 if(type.flags&ts.TypeFlags.NumberLiteral)return {const:type.value};
 if(type.flags&ts.TypeFlags.BooleanLiteral)return {const:type.intrinsicName==='true'};
 if(type.flags&ts.TypeFlags.StringLike)return {type:'string'};
 if(type.flags&ts.TypeFlags.NumberLike)return {type:'number'};
 if(type.flags&ts.TypeFlags.BooleanLike)return {type:'boolean'};
 if(type.flags&ts.TypeFlags.Null)return {type:'null'};
 if(checker.isArrayType(type)||checker.isTupleType(type))return {type:'array',items:schema(checker.getTypeArguments(type)[0],depth+1,next)};
 if(type.flags&ts.TypeFlags.Object) {
  const properties={},required=[];
  for(const prop of checker.getPropertiesOfType(type)) {
   if(['onEvent','signal','subscribe'].includes(prop.name))continue;
   const decl=prop.valueDeclaration||prop.declarations?.[0];if(!decl)continue;
   const t=checker.getTypeOfSymbolAtLocation(prop,decl);
   if(t.getCallSignatures().length)continue;
   properties[prop.name]=schema(t,depth+1,next);
   if(!(prop.flags&ts.SymbolFlags.Optional))required.push(prop.name);
  }
  const index=checker.getIndexTypeOfType(type,ts.IndexKind.String);
  return {type:'object',properties,required,additionalProperties:index?schema(index,depth+1,next):true};
 }
 return {};
}
const portableType=text=>text.replace(/import\("[^"]*\/node_modules\//g,'import("');
const operations=[],omitted=[];
for(const decl of source.statements)if(ts.isClassDeclaration(decl)&&decl.name?.text==='DaemonClient')for(const method of decl.members) {
 if(!ts.isMethodDeclaration(method)||method.modifiers?.some(m=>m.kind===ts.SyntaxKind.PrivateKeyword))continue;
 const name=method.name.getText(source),ret=method.type?.getText(source)||'';
 if(excluded.has(name)||/^(on|observe|subscribe)/.test(name)||/Subscription/.test(ret)||method.parameters.some(p=>checker.getTypeAtLocation(p).getCallSignatures().length)) {omitted.push({name,reason:'Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.'});continue;}
 if(operations.some(o=>o.name===name))continue;
 const parameters=method.parameters.map(p=>({name:p.name.getText(source),optional:!!p.questionToken||!!p.initializer,type:portableType(checker.typeToString(checker.getTypeAtLocation(p),p,ts.TypeFormatFlags.NoTruncation|ts.TypeFormatFlags.InTypeAlias)),schema:schema(checker.getTypeAtLocation(p))}));
 operations.push({name,scope:sensitive.test(name)?'admin':reads.test(name)?'read':'control',parameters,returns:ret,description:ts.displayPartsToString(checker.getSymbolAtLocation(method.name)?.getDocumentationComment(checker)||[])});
}
operations.sort((a,b)=>a.name.localeCompare(b.name));
const catalog={sdk:'@getpaseo/client',version:JSON.parse(await readFile('node_modules/@getpaseo/client/package.json')).version,operations,omitted};
await writeFile('server/catalog.json',JSON.stringify(catalog,null,2)+'\n');
await writeFile('docs/api-coverage.md',`# Paseo API coverage\n\nGenerated from the pinned SDK ${catalog.version}. ${operations.length} JSON-callable methods are exposed by a fixed allowlist; this is API coverage, not a claim that every operation was exercised live. Positional SDK arguments become named parameters in MCP. Use paseo_api for schemas before calls.\n\n| Operation | Scope | Parameters |\n|---|---|---|\n`+operations.map(o=>`| ${o.name} | ${o.scope} | ${o.parameters.map(p=>p.name+(p.optional?'?':'')).join(', ')} |`).join('\n')+'\n\n## Not represented as synchronous calls\n\n'+omitted.map(o=>`- ${o.name}: ${o.reason}`).join('\n')+'\n\nPersistent native audio/browser transports are not a ChatGPT voice/browser UI. Their JSON-callable controls are available, but native callbacks/subscriptions need a streaming adapter. Provider capabilities and daemon feature flags still determine whether an operation is supported. No architecture or cross-chat coordination policy lives in this catalog.\n');
console.log(`Generated ${operations.length} operations and ${omitted.length} explicit exclusions`);
