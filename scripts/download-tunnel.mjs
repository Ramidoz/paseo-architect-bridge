import {mkdtemp,writeFile,mkdir,copyFile,chmod,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const version='0.0.15';
const hashes={
 'darwin-x64':'9dcae1e2fb121287e73271edb7b853dda52aa86b7bfca1df91bc275371261bdb',
 'darwin-arm64':'b2cae3aa9df45b4c2fe9b1d700ebacce39f9feb6a6b46b86e6499f9a51bf72ff',
 'linux-x64':'8c836dc5d68d68b663d9a5c5b28ff9fa780d9f7a3fffb1c306880b8f32fab5f1',
 'linux-arm64':'c51bfd883fc22e3445494a03c0179875176564bde470661b308fd83af5d01abb'
};
const key=`${process.platform}-${process.arch}`,hash=hashes[key];
if(!hash)throw Error('Supported tunnel platforms: Linux and macOS, x64 or arm64');
const asset=`tunnel-client-v${version}-${process.platform}-${process.arch==='x64'?'amd64':'arm64'}.zip`;
const base=`https://github.com/openai/tunnel-client/releases/download/v${version}/`;
const directory=resolve(process.argv[2]||join(homedir(),'.local/bin'));
const temp=await mkdtemp(join(tmpdir(),'paseo-tunnel-'));
try {
 const response=await fetch(base+asset);if(!response.ok)throw Error(`Download failed: ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Official tunnel archive checksum mismatch');
 const archive=join(temp,asset);await writeFile(archive,bytes);
 const result=spawnSync('unzip',['-q',archive,'-d',join(temp,'unpacked')],{stdio:'inherit'});
 if(result.error||result.status!==0)throw Error('Install unzip and retry');
 await mkdir(directory,{recursive:true,mode:0o700});
 // Release archives contain a single directory named for the platform asset.
 const {readdir}=await import('node:fs/promises');
 async function locate(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isFile()&&entry.name==='tunnel-client')return path;if(entry.isDirectory()){const found=await locate(path);if(found)return found;}}}
 const binary=await locate(join(temp,'unpacked'));if(!binary)throw Error('No tunnel-client in verified archive');
 await copyFile(binary,join(directory,'tunnel-client'));await chmod(join(directory,'tunnel-client'),0o700);
 const notices=await fetch(base+`tunnel-client-v${version}-${process.platform}-${process.arch==='x64'?'amd64':'arm64'}-licenses.txt`);
 if(!notices.ok)throw Error('Could not download tunnel license notices');
 await writeFile(join(directory,'tunnel-client-LICENSES.txt'),await notices.text(),{mode:0o600});
 console.log(`Installed verified official tunnel-client ${version}: ${join(directory,'tunnel-client')}`);
}finally{await rm(temp,{recursive:true,force:true});}
