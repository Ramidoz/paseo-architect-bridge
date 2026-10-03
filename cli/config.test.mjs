import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConfig,validateConfig} from './config.mjs';
import {renderService} from './service.mjs';
const env={PASEO_OAUTH_ISSUER:'https://tenant.example/',PASEO_OAUTH_RESOURCE:'https://api.example/mcp',PASEO_OAUTH_SUBJECT:'google-oauth2|owner',CONTROL_PLANE_TUNNEL_ID:'tunnel_example',CONTROL_PLANE_API_KEY:'test-placeholder'};
test('configuration cannot execute shell code and rejects unknown or duplicate settings',()=>{
 assert.equal(parseConfig('PASEO_PASSWORD="$(touch /tmp/never)"').PASEO_PASSWORD,'$(touch /tmp/never)');
 assert.throws(()=>parseConfig('NODE_OPTIONS=--require bad'));
 assert.throws(()=>parseConfig('PASEO_URL=a\nPASEO_URL=b'));
 assert.throws(()=>parseConfig('PASEO_PASSWORD="unclosed'));
 assert.equal(validateConfig(env).subject,env.PASEO_OAUTH_SUBJECT);
 assert.throws(()=>validateConfig({...env,PASEO_URL:'ws://public.example/ws'}));
 assert.throws(()=>validateConfig({...env,PASEO_POLL_MS:'-1'}));
});
test('Linux and macOS services use absolute paths safely and do not embed credentials',()=>{
 const paths={node:'/usr/bin/node',cli:'/home/example/a b/cli/index.mjs',config:'/home/example/private/config.env',tunnel:'/home/example/bin/tunnel-client',home:'/home/example'};
 const linux=renderService('linux',paths),mac=renderService('darwin',paths);
 assert.match(linux,/Restart=on-failure/);assert.match(linux,/UMask=0077/);assert.match(linux,/"\/home\/example\/a b\/cli\/index.mjs"/);
 assert.match(mac,/<key>RunAtLoad<\/key><true\/>/);assert.match(mac,/<key>SuccessfulExit<\/key><false\/>/);
 assert.ok(!linux.includes(env.CONTROL_PLANE_API_KEY));assert.ok(!mac.includes(env.CONTROL_PLANE_API_KEY));
 assert.throws(()=>renderService('linux',{...paths,cli:'/bad\npath'}));
});
