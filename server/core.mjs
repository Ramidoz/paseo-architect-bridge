import {createHash} from 'node:crypto';
export const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function clean(x, limit=2000) {
 return String(x ?? '').replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,})\b/g,'[REDACTED]').replace(/((?:password|token|api[_-]?key|secret)\s*[:=]\s*)[^\s,;]+/gi,'$1[REDACTED]').slice(0,limit);
}
export function normalize(agent, entry, project, epoch) {
 const i=entry.item, d=i.detail || {}, terminal=i.status === 'completed';
 const output=clean(d.output,4000), command=d.type==='shell'?clean(d.command):null;
 const changed=terminal && ['edit','write'].includes(d.type) ? [{path:d.filePath,status:d.type==='write'?'written':'modified',evidence:'provider_tool_completed'}]:[];
 return {key:`timeline:${agent.id}:${epoch}:${entry.seqStart}:${hash(entry)}`,source:'paseo',cli:agent.provider,project:project?.projectName || agent.cwd?.split('/').pop(),repo:agent.cwd,session:agent.runtimeInfo?.sessionId || agent.id,agentId:agent.id,turnId:entry.turnId || null,command,timestamp:entry.timestamp,observedAt:new Date().toISOString(),outcome:clean(i.text || `${i.name || i.type}: ${i.status || 'observed'}`),changedFiles:changed,diff:d.unifiedDiff?clean(d.unifiedDiff,4000):null,stat:null,errors:i.error?[clean(typeof i.error==='string'?i.error:JSON.stringify(i.error))]:[],tests:command && /\b(pytest|jest|vitest|test|cargo test|go test)\b/.test(command)?[{command,status:i.status,exitCode:d.exitCode??null,reportedOutput:output,evidence:'provider_reported'}]:[],output:output || null,attribution:'provider_timeline',seqStart:entry.seqStart,seqEnd:entry.seqEnd};
}
export function repoEvent(cwd, status, diff) {
 const files=(diff.files || []).map(f=>({path:f.path,status:f.isNew?'A':f.isDeleted?'D':'M',additions:f.additions ?? null,deletions:f.deletions ?? null}));
 return {key:`repo:${cwd}:${hash({status:{branch:status.currentBranch,dirty:status.isDirty},files,diff:diff.files})}`,source:'paseo_checkout',cli:'unknown',project:cwd.split('/').pop(),repo:cwd,session:null,agentId:null,command:null,timestamp:new Date().toISOString(),outcome:`Repository snapshot: ${files.length} changed files`,changedFiles:files,stat:{files:files.length,additions:files.reduce((a,f)=>a+(f.additions||0),0),deletions:files.reduce((a,f)=>a+(f.deletions||0),0)},diff:null,errors:[status.error,diff.error].filter(Boolean).map(x=>clean(x)),tests:[],attribution:'shared_checkout_unattributed',branch:status.currentBranch,remoteUrl:status.remoteUrl || null};
}
