import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';import path from 'node:path';
const fallback={bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="8" fill="#e5ece5"/><path d="M32 8 54 32 32 56 10 32Z" fill="none" stroke="#537963" stroke-width="3"/></svg>'),type:'image/svg+xml'};
const plain=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').trim();
export function findCrest(html,owner){
 const entry=[...html.matchAll(/<a\b[^>]*href="\/lodestone\/freecompany\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/g)].find(m=>m[1]===owner.id&&m[2].includes('entry__freecompany__crest'))?.[2];if(!entry)return null;
 const name=entry.match(/<p class="entry__freecompany__name">([\s\S]*?)<\/p>/)?.[1];
 const worlds=[...entry.matchAll(/<p class="entry__freecompany__gc">([\s\S]*?)<\/p>/g)].map(m=>plain(m[1]).replace(/\s*\[.*\]$/,''));
 if(!name||plain(name)!==owner.name||!worlds.includes(owner.world))return null;
 const layers=[...entry.matchAll(/<img[^>]*src="(https:\/\/img\d*\.finalfantasyxiv\.com\/c\/[^"<>]+\.png)"/g)].map(m=>m[1]);return layers.length===3?layers:null;
}
export function createCrestCache(dir,fetcher=fetch){
 const pending=new Map(),failed=new Map();let active=0;const queue=[];
 return async (owner,force=false)=>{
  if(!/^\d+$/.test(owner.id))return fallback;const file=path.join(dir,owner.id+'.svg');let cached;
  try{cached={bytes:await readFile(file),type:'image/svg+xml'};if(!force&&Date.now()-(await stat(file)).mtimeMs<7*86400000)return cached;}catch{}
  if(!force&&(failed.get(owner.id)||0)>Date.now())return cached||fallback;
  if(!pending.has(owner.id))pending.set(owner.id,(async()=>{
   if(active>=2)await new Promise(resolve=>queue.push(resolve));else active++;
   try{const response=await fetcher(`https://jp.finalfantasyxiv.com/lodestone/freecompany/${owner.id}/`,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw new Error('FC unavailable');const layers=findCrest(await response.text(),owner);if(!layers)throw new Error('FC mismatch');
    const images=[];for(const url of layers){const res=await fetcher(url,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!res.ok||!res.headers.get('content-type')?.startsWith('image/png'))throw new Error('Invalid crest');let size=0;const chunks=[];for await(const chunk of res.body){size+=chunk.length;if(size>1048576)throw new Error('Crest too large');chunks.push(chunk);}const bytes=Buffer.concat(chunks);if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Invalid PNG');images.push(`<image width="64" height="64" href="data:image/png;base64,${bytes.toString('base64')}"/>`);}
    const bytes=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${images.join('')}</svg>`);await mkdir(dir,{recursive:true});await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file);return {bytes,type:'image/svg+xml'};
   }catch{failed.set(owner.id,Date.now()+3600000);return cached||fallback;}finally{const next=queue.shift();if(next)next();else active--;}
  })().finally(()=>pending.delete(owner.id)));
  return force?pending.get(owner.id):cached||pending.get(owner.id);
 };
}
