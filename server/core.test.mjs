import {test} from 'node:test';import assert from 'node:assert/strict';import {normalize,repoEvent,clean} from './core.mjs';
const a={id:'a',provider:'claude',cwd:'/repo',runtimeInfo:{sessionId:'s'}};
const entry=status=>({timestamp:'2026-10-03T17:00:00Z',seqStart:1,seqEnd:2,item:{type:'tool_call',name:'Write',status,detail:{type:'write',filePath:'/repo/a'}}});
test('only completed edit tools imply file writes',()=>{assert.deepEqual(normalize(a,entry('running'),null,'e').changedFiles,[]);assert.equal(normalize(a,entry('completed'),null,'e').changedFiles[0].status,'written');assert.notEqual(normalize(a,entry('running'),null,'e').key,normalize(a,entry('completed'),null,'e').key);});
test('shared diff attribution and stats',()=>{const e=repoEvent('/repo',{}, {files:[{path:'a',isNew:true,additions:3,deletions:0},{path:'b',isDeleted:true,additions:0,deletions:2}]});assert.equal(e.cli,'unknown');assert.equal(e.stat.additions,3);assert.equal(e.changedFiles[1].status,'D');});
test('common secrets redacted and bounded',()=>{assert.equal(clean('token=secret password=hunter2'),'token=[REDACTED] password=[REDACTED]');assert.equal(clean('a'.repeat(5000)).length,2000);});
