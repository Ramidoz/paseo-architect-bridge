import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createApi,catalog} from './api.mjs';
const all=new Set(['paseo:read','paseo:control','paseo:admin']),read=new Set(['paseo:read']);
function fixture(adapter,enabled=['read','control','admin']){const db=new DatabaseSync(':memory:');const api=createApi({db,open:async()=>({checkout:adapter}),enabled});return {api,db};}
test('catalog schema validation and fixed allowlist prevent unknown method or wrong-scope dispatch',async()=>{
 let calls=0;const {api,db}=fixture({cancelAgent:async()=>{calls++;}});
 try {
  await assert.rejects(api.call({operation:'cancelAgent',parameters:{agentId:'a'},idempotencyKey:'fixture-01'},read,'control'));
  await assert.rejects(api.call({operation:'cancelAgent',parameters:{agentId:5},idempotencyKey:'fixture-01'},all,'control'));
  await assert.rejects(api.call({operation:'cancelAgent',parameters:{agentId:'a'},idempotencyKey:'fixture-01'},all,'read'));
  await assert.rejects(api.call({operation:'constructor',parameters:{}},all,'admin'));
  await assert.rejects(api.call({operation:'cancelAgent',parameters:{agentId:'a'}},all,'control'));
  assert.equal(calls,0);
  assert.equal(api.describe('cancelAgent').parameters[0].name,'agentId');
  assert.ok(catalog.operations.length>150);
 }finally{db.close();}
});
test('mutation key prevents duplicate writes, conflicting reuse and exposure through weaker read scope',async()=>{
 let calls=0;const {api,db}=fixture({cancelAgent:async id=>{calls++;assert.equal(id,'a');return {cancelled:true};}});
 const input={operation:'cancelAgent',parameters:{agentId:'a'},idempotencyKey:'fixture-02'};
 try {
  const first=await api.call(input,all,'control'),second=await api.call(input,all,'control');
  assert.equal(calls,1);assert.deepEqual(first,second);assert.equal(first.status,'returned');
  await assert.rejects(api.call({...input,parameters:{agentId:'b'}},all,'control'));
  assert.throws(()=>api.result({requestKey:input.idempotencyKey},read));
 }finally{db.close();}
});
test('lost acknowledgement is persisted as indeterminate and is never automatically retried',async()=>{
 let calls=0;const {api,db}=fixture({cancelAgent:async()=>{calls++;throw Error('connection lost after dispatch');}});
 const input={operation:'cancelAgent',parameters:{agentId:'a'},idempotencyKey:'fixture-03'};
 try {
  assert.equal((await api.call(input,all,'control')).status,'indeterminate');
  assert.equal((await api.call(input,all,'control')).status,'indeterminate');assert.equal(calls,1);
  const restored=createApi({db,open:async()=>{throw Error('must not reconnect');},enabled:['read','control']});
  assert.equal((await restored.call(input,all,'control')).status,'indeterminate');
 }finally{db.close();}
});
test('oversized raw results preserve complete data through scoped pagination',async()=>{
 const {api,db}=fixture({getDaemonStatus:async()=>({text:'a'.repeat(40000)})});
 try {
  const first=await api.call({operation:'getDaemonStatus'},read,'read');
  assert.equal(first.nextOffset,32000);
  const second=api.result({requestKey:first.requestKey,offset:first.nextOffset},read);
  assert.equal(JSON.parse(first.serializedResult+second.serializedResult).text.length,40000);
 }finally{db.close();}
});
