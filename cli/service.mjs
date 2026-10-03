import {mkdir,writeFile,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';

export const label='com.paseo.architect-bridge';
export const unit='paseo-architect-bridge.service';
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const systemd=value=>'"'+String(value).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('%','%%').replaceAll('$','$$')+'"';

export function renderService(platform,{node,cli,config,tunnel,home=homedir()}) {
 const args=[node,cli,'run','--config',config,'--tunnel-bin',tunnel];
 if(args.some(x=>/[\r\n\0]/.test(x)))throw Error('Service paths cannot contain newlines or null bytes');
 if(platform==='linux')return `[Unit]\nDescription=Paseo read-only architect bridge and authenticated tunnel\nWants=network-online.target\nAfter=network-online.target\n\n[Service]\nType=simple\nExecStart=${args.map(systemd).join(' ')}\nRestart=on-failure\nRestartSec=5\nTimeoutStopSec=20\nUMask=0077\nNoNewPrivileges=true\n\n[Install]\nWantedBy=default.target\n`;
 if(platform==='darwin')return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${label}</string>\n<key>ProgramArguments</key><array>${args.map(x=>`<string>${xml(x)}</string>`).join('')}</array>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>\n<key>ThrottleInterval</key><integer>5</integer>\n<key>Umask</key><integer>63</integer>\n<key>StandardOutPath</key><string>${xml(join(home,'.local/state/paseo-architect/service.log'))}</string>\n<key>StandardErrorPath</key><string>${xml(join(home,'.local/state/paseo-architect/service.log'))}</string>\n</dict></plist>\n`;
 throw Error('Service installation supports Linux systemd and macOS launchd');
}

export function execute(command,args) {
 const r=spawnSync(command,args,{stdio:'inherit'});
 if(r.error)throw r.error;
 if(r.status!==0)throw Error(`${command} failed (${r.status}); inspect its output`);
}

export async function installService(options,{start=false,dryRun=false}={}) {
 const platform=process.platform, home=homedir();
 const text=renderService(platform,{...options,home});
 if(dryRun){console.log(text);return;}
 const path=platform==='linux'?join(home,'.config/systemd/user',unit):join(home,'Library/LaunchAgents',label+'.plist');
 await mkdir(join(home,'.local/state/paseo-architect'),{recursive:true,mode:0o700});
 await chmod(join(home,'.local/state/paseo-architect'),0o700);
 await mkdir(platform==='linux'?join(home,'.config/systemd/user'):join(home,'Library/LaunchAgents'),{recursive:true});
 await writeFile(path,text,{mode:0o600});await chmod(path,0o600);
 if(platform==='linux') {
  execute('systemctl',['--user','daemon-reload']);
  execute('systemctl',['--user','enable',unit]);
  if(start)execute('systemctl',['--user','restart',unit]);
 }else if(start)execute('launchctl',['bootstrap',`gui/${process.getuid()}`,path]);
 console.log(`Installed ${path}${start?' and started service':' (not started)'}`);
 if(platform==='linux')console.log('For startup before login, an administrator must enable loginctl linger for this user.');
}
