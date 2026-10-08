import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
export const fallback=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="8" fill="#e9eee8"/><path d="m40 18 22 12v25L40 67 18 55V30zM18 30l22 12 22-12M40 42v25" fill="none" stroke="#819784" stroke-width="3"/></svg>');
export function createIconCache(dir,fetcher=fetch){
  const memory=new Map();
  function remember(id,value){if(memory.size>=512)memory.delete(memory.keys().next().value);memory.set(id,value);return value;}
  const pending=new Map(),failed=new Map();let active=0;const queue=[];
  async function download(id){
    if(active>=4)await new Promise(resolve=>queue.push(resolve));else active++;
    try{
      const meta=await fetcher(`https://v2.xivapi.com/api/sheet/Item/${id}?fields=Icon`,{signal:AbortSignal.timeout(15000)});
      if(!meta.ok)throw new Error('Icon metadata unavailable');
      const icon=(await meta.json()).fields?.Icon,asset=icon?.path_hr1||icon?.path;
      if(!/^ui\/icon\/\d{6}\/\d{6}(?:_hr1)?\.tex$/.test(asset||''))throw new Error('Invalid icon path');
      const res=await fetcher(`https://v2.xivapi.com/api/asset?path=${encodeURIComponent(asset)}&format=png`,{signal:AbortSignal.timeout(15000)});
      if(!res.ok||!res.headers.get('content-type')?.startsWith('image/png'))throw new Error('Icon unavailable');
      const chunks=[];let size=0;
      for await(const chunk of res.body){size+=chunk.length;if(size>1024*1024)throw new Error('Icon too large');chunks.push(chunk);}
      const bytes=Buffer.concat(chunks);
      if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Invalid PNG');
      await mkdir(dir,{recursive:true});const file=path.join(dir,`${id}.png`);
      await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file);return remember(id,{bytes,type:'image/png'});
    }finally{const next=queue.shift();if(next)next();else active--;}
  }
  return async id=>{
    if(!Number.isSafeInteger(id)||id<=0)throw new Error('Invalid item ID');
    if(memory.has(id))return memory.get(id);
    try{return remember(id,{bytes:await readFile(path.join(dir,`${id}.png`)),type:'image/png'});}catch(e){if(e.code!=='ENOENT')return {bytes:fallback,type:'image/svg+xml'};}
    if((failed.get(id)||0)>Date.now())return {bytes:fallback,type:'image/svg+xml'};
    if(!pending.has(id))pending.set(id,download(id).catch(()=>{failed.set(id,Date.now()+60000);return {bytes:fallback,type:'image/svg+xml'};}).finally(()=>pending.delete(id)));
    return pending.get(id);
  };
}
