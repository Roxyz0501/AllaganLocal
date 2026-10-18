import {readFile,open,rename,link,copyFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export function parseHistory(text){
 let value;try{value=JSON.parse(text);}catch{throw new Error('Invalid history JSON');}
 if(value?.version!==1||!value.series||typeof value.series!=='object'||Array.isArray(value.series))throw new Error('Invalid history');
 for(const s of Object.values(value.series))if(!s||!s.days||typeof s.days!=='object'||!Array.isArray(s.changes))throw new Error('Invalid history series');
 return value;
}

// A flushed immutable snapshot, plus one previous snapshot. Hard links avoid
// rewriting the previous large file on local NTFS; copy is a fallback only.
export async function saveHistory(file,ledger){
 const temp=file+'.'+randomUUID()+'.tmp',backupTemp=temp+'.bak';
 try{
  const handle=await open(temp,'wx');
  try{await handle.writeFile(JSON.stringify(ledger));await handle.sync();}finally{await handle.close();}
  try{
   try{await link(file,backupTemp);}catch(e){if(e.code==='ENOENT')throw e;await copyFile(file,backupTemp);const h=await open(backupTemp,'r+');try{await h.sync();}finally{await h.close();}}
   await rename(backupTemp,file+'.bak');
  }catch(e){if(e.code!=='ENOENT')throw e;}
  await rename(temp,file);
 }finally{await unlink(temp).catch(()=>{});await unlink(backupTemp).catch(()=>{});}
}

export async function loadHistory(file){
 try{return {ledger:parseHistory(await readFile(file,'utf8')),recovered:false};}
 catch(primary){
  try{
   const ledger=parseHistory(await readFile(file+'.bak','utf8'));
   // Preserve the damaged file before restoring; never rotate it over the backup.
   try{await rename(file,file+'.corrupt-'+randomUUID());}catch(e){if(e.code!=='ENOENT')throw e;}
   await saveHistory(file,ledger);return {ledger,recovered:true};
  }catch(backup){if(primary.code==='ENOENT'&&backup.code==='ENOENT')return {ledger:{version:1,series:{}},recovered:false};throw new Error('History cannot be loaded; originals preserved');}
 }
}

// Explicit offline recovery only: accept complete series before a damaged tail.
// Incomplete entities are not guessed, and older valid backups can fill gaps.
export function recoverHistoryPrefix(text,baseline={version:1,series:{}}){
 const marker=/^\s*\{"version":1,"startedAt":("[^"\\]+"),"series":\{/ .exec(text);
 if(!marker)throw new Error('Unrecognized history header');
 const series={...baseline.series};let start=marker[0].length,depth=0,string=false,escape=false,count=0;
 for(let i=start;i<text.length;i++){
  const c=text[i];if(c==='\0')break;
  if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue;}
  if(c==='"'){string=true;continue;}if(c==='{'||c==='[')depth++;
  else if(c==='}'||c===']'){
   depth--;if(depth===0){
    let entry;try{entry=JSON.parse('{'+text.slice(start,i+1)+'}');parseHistory(JSON.stringify({version:1,series:entry}));}catch{break;}
    const [key,s]=Object.entries(entry)[0],old=series[key];
    const changes=new Map((old?.changes||[]).map(p=>[p.at,p]));for(const p of s.changes)changes.set(p.at,p);
    series[key]={...s,days:{...old?.days,...s.days},changes:[...changes.values()].sort((a,b)=>a.at.localeCompare(b.at))};count++;
    if(text[i+1]!==',')break;start=i+2;i++;
   }else if(depth<0)break;
  }
 }
 if(!count)throw new Error('No complete history series');
 return {ledger:{version:1,startedAt:baseline.startedAt||JSON.parse(marker[1]),series},recoveredSeries:count};
}
