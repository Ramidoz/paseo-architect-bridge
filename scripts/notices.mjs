import {execFileSync} from 'node:child_process';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const paths=execFileSync('npm',['ls','--omit=dev','--all','--parseable','--json=false'],{encoding:'utf8'}).trim().split('\n');
const packages=await Promise.all(paths.map(async path=>({...JSON.parse(await readFile(join(path,'package.json'),'utf8')),path})));
let out='Third-party runtime notices\n\nThe integration is MIT licensed. Dependencies retain their own licenses.\n\n';
for(const pkg of packages.sort((a,b)=>a.name.localeCompare(b.name))) {
 if(pkg.name==='paseo-architect-bridge')continue;
 const dir=pkg.path;const names=(await readdir(dir)).filter(n=>/^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(n));
 let texts=[];
 for(const name of names){try{texts.push(await readFile(join(dir,name),'utf8'));}catch{}}
 if(!texts.length&&pkg.name.startsWith('@getpaseo/'))texts=[await readFile('licenses/Paseo-Apache-2.0.txt','utf8')];
 if(!texts.length)throw Error(`Missing license text for ${pkg.name}; inspect before distribution`);
 out+=`\n===== ${pkg.name}@${pkg.version} (${pkg.license||'see license text'}) =====\n${texts.join('\n')}\n`;
}
await writeFile('THIRD_PARTY_NOTICES.txt',out);
