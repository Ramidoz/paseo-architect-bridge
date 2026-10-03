import {createRemoteJWKSet, jwtVerify} from 'jose';

export function authConfig(env=process.env) {
 const issuer=env.PASEO_OAUTH_ISSUER, resource=env.PASEO_OAUTH_RESOURCE, subject=env.PASEO_OAUTH_SUBJECT;
 if(!issuer||!resource||!subject)throw Error('OAuth requires PASEO_OAUTH_ISSUER, PASEO_OAUTH_RESOURCE and PASEO_OAUTH_SUBJECT; access stays closed until all are configured.');
 const u=new URL(issuer), r=new URL(resource);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('OAuth issuer must be an HTTPS tenant root with trailing slash.');
 if(r.protocol!=='https:'||r.username||r.password||r.hash)throw Error('OAuth resource must be an HTTPS resource identifier.');
 const port=Number(env.PASEO_HTTP_PORT||18767);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid local HTTP port');
 return {issuer,resource,subject,port,scope:'paseo:read'};
}

export function tokenVerifier(config, keys=createRemoteJWKSet(new URL('.well-known/jwks.json',config.issuer))) {
 return async authorization=>{
  if(typeof authorization!=='string'||!/^Bearer [^\s]+$/i.test(authorization))throw Error('Missing bearer token');
  const {payload}=await jwtVerify(authorization.slice(7),keys,{issuer:config.issuer,audience:config.resource,algorithms:['RS256'],requiredClaims:['sub','exp','iat'],clockTolerance:5});
  if(payload.sub!==config.subject)throw Error('Identity not allowed');
  if(typeof payload.scope!=='string'||!payload.scope.split(' ').includes(config.scope))throw Error('Read scope required');
  return payload;
 };
}

export function protectedMetadata(config) {
 return {resource:config.resource,authorization_servers:[config.issuer],scopes_supported:[config.scope],bearer_methods_supported:['header'],resource_name:'Paseo read-only'};
}
