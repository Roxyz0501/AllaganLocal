import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
export function exactItemLink(html,name){
 const decode=s=>s.replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim();
 const matches=new Set();
 for(const m of html.matchAll(/<a\b[^>]*href="(\/lodestone\/playguide\/db\/item\/[a-f0-9]+\/)"[^>]*>([\s\S]*?)<\/a>/gi))if(decode(m[2])===name)matches.add(m[1]);
 return matches.size===1?'https://jp.finalfantasyxiv.com'+[...matches][0]:null;
}
export function createItemLinkCache(directory){
 const pending=new Map();
 return async(id,name)=>{
  if(pending.has(id))return pending.get(id);
  const job=(async()=>{
   const file=path.join(directory,id+'.json');
   try{const cached=JSON.parse(await readFile(file,'utf8'));if(cached.name===name&&/^https:\/\/jp\.finalfantasyxiv\.com\/lodestone\/playguide\/db\/item\/[a-f0-9]+\/$/.test(cached.url))return cached.url;}catch{}
   const res=await fetch('https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/?q='+encodeURIComponent(name),{signal:AbortSignal.timeout(12000)});
   if(!res.ok)throw new Error('公式サイトに接続できませんでした。時間をおいて再度お試しください。');
   const url=exactItemLink(await res.text(),name);
   if(!url)throw new Error('このアイテムの公式個別ページを特定できませんでした。');
   await mkdir(directory,{recursive:true});await writeFile(file,JSON.stringify({name,url}));return url;
  })();pending.set(id,job);try{return await job;}finally{pending.delete(id);}
 };
}
