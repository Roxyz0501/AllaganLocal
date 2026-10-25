import {readFile,open,rename,copyFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
export async function loadSettings(file,validate){
 let primary,invalid=false;for(let i=0;i<4;i++){const p=i?file+'.bak'+i:file;try{const text=await readFile(p,'utf8'),value=JSON.parse(text);validate(value);if(i){try{await rename(file,file+'.corrupt-'+randomUUID());}catch(e){if(e.code!=='ENOENT')throw e;}await copyFile(p,file);}return {value,text,recovered:!!i};}catch(e){if(!i)primary=e;if(e.code!=='ENOENT')invalid=true;}}
 if(primary?.code==='ENOENT'&&!invalid)return null;throw Error('No valid settings generation; originals preserved');
}
export class SettingsWriter{
 constructor(file,value,validate,{fault=()=>{}}={}){this.fault=fault;this.file=file;this.validate=validate;this.saved=JSON.stringify(value);this.pending=this.saved;this.promotions=null;this.queue=Promise.resolve();this.failures=0;this.error=null;this.closed=false;this.metrics={writes:0,logicalBytes:0,backupBytes:0,temporaryPayloadBytes:0};this.timer=setInterval(()=>this.flush().catch(()=>{}),60000);this.timer.unref();}
 set(value){if(this.closed)throw Error('Settings closed');this.validate(value);this.pending=JSON.stringify(value);}
 async finishBackups(){if(!this.promotions)return;while(this.promotions.corrupt.length){const file=this.promotions.corrupt[0];await rename(file,file+'.corrupt-'+randomUUID());this.promotions.corrupt.shift();}while(this.promotions.staged.length){const target=this.promotions.staged[0];await rename(target+'.tmp',target);this.promotions.staged.shift();}this.promotions=null;}
 flush(){const job=this.queue.then(async()=>{if(this.saved===this.pending&&!this.promotions)return;if(this.failures>=3)throw Error('Settings saving paused');const text=this.pending,temp=this.file+'.tmp';try{await this.finishBackups();if(this.saved===this.pending){this.failures=0;this.error=null;return;}await mkdir(path.dirname(this.file),{recursive:true});const h=await open(temp,'w');try{await h.writeFile(text);this.metrics.temporaryPayloadBytes+=Buffer.byteLength(text);await h.sync();}finally{await h.close();}this.validate(JSON.parse(await readFile(temp,'utf8')));
 const valid=[],corrupt=[],staged=[];for(let i=0;i<4;i++){const source=i?this.file+'.bak'+i:this.file;let old;try{old=await readFile(source,'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}try{this.validate(JSON.parse(old));}catch(e){if(!i)throw e;corrupt.push(source);continue;}if(valid.length<3)valid.push({source,old});}
 for(let i=0;i<valid.length;i++){const {source,old}=valid[i],target=this.file+'.bak'+(i+1);await copyFile(source,target+'.tmp');this.metrics.backupBytes+=Buffer.byteLength(old);const backup=await open(target+'.tmp','r+');try{await backup.sync();}finally{await backup.close();}staged.push(target);}
 this.fault('beforePrimaryReplace');await rename(temp,this.file);this.saved=text;this.failures=0;this.error=null;this.metrics.writes++;this.metrics.logicalBytes+=Buffer.byteLength(text);this.promotions={corrupt,staged};this.fault('afterPrimaryReplace');await this.finishBackups();
 }catch(e){this.failures++;this.error=e.message;throw e;}});this.queue=job.catch(()=>{});return job;}
 async close(){clearInterval(this.timer);this.closed=true;await this.flush();}
 retry(){this.failures=0;return this.flush();}
}
