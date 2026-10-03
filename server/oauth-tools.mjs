// The pinned MCP SDK retains _meta but omits top-level securitySchemes.
// Decorate outbound tool discovery without relying on private SDK fields.
export function toolScopes(name) {
 const scope=name==='paseo_control_request'?'control':name==='paseo_admin_request'?'admin':'read';
 return scope==='read'?['paseo:read']:['paseo:read',`paseo:${scope}`];
}
export function decorateOAuthTools(transport) {
 const send=transport.send.bind(transport);
 transport.send=(message,...args)=>{
  if(message.result?.tools)message={...message,result:{...message.result,tools:message.result.tools.map(tool=>{
   const securitySchemes=[{type:'oauth2',scopes:toolScopes(tool.name)}];
   return {...tool,securitySchemes,_meta:{...tool._meta,securitySchemes}};
  })}};
  return send(message,...args);
 };
 return transport;
}
export function scopeChallenge(scope,scopes) {
 const needed=scope==='read'?['paseo:read']:['paseo:read',`paseo:${scope}`];
 if(needed.every(s=>scopes.has(s)))return null;
 return {isError:true,content:[{type:'text',text:`Reconnect Paseo to authorize ${needed.join(' ')}.`}],_meta:{'mcp/www_authenticate':[`Bearer error="insufficient_scope", error_description="Reconnect Paseo to authorize the requested operation", scope="${needed.join(' ')}"`]}};
}
