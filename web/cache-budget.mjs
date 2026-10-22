import {readdir,stat,unlink} from 'node:fs/promises';import path from 'node:path';
const states=new Map();
// Disposable media/link caches only; never used for histories, settings or exports.
export function trimCache(dir,{maxFiles=10000,maxBytes=256*1024*1024,age=90*86400000}={}){
 const previous=states.get(dir);if(previous?.pending)return previous.pending;if(previous?.until>Date.now())return Promise.resolve();
 const entry={until:Date.now()+3600000};entry.pending=(async()=>{const files=[];for(const row of await readdir(dir,{withFileTypes:true})){if(!row.isFile()||! /^(?:[0-9]+|[a-f0-9]{64})(?:\.profile)?\.(?:png|jpg|json)$/.test(row.name))continue;const file=path.join(dir,row.name),s=await stat(file);files.push({file,bytes:s.size,at:s.mtimeMs});}files.sort((a,b)=>a.at-b.at);let bytes=files.reduce((n,f)=>n+f.bytes,0),count=files.length;for(const f of files){if(count<=maxFiles&&bytes<=maxBytes&&f.at>=Date.now()-age)break;await unlink(f.file);bytes-=f.bytes;count--;}})().finally(()=>entry.pending=null);states.set(dir,entry);return entry.pending;
}
