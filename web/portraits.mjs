import {createCrestCache} from './crests.mjs';
import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
export const portraitFallback=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#e5ece5"/><circle cx="40" cy="29" r="14" fill="#8b9f91"/><path d="M13 72c0-29 54-29 54 0" fill="#8b9f91"/></svg>');
const plain=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
export function findPortrait(html,name,world){
 const matches=[];
 for(const m of html.matchAll(/<a\b[^>]*href="\/lodestone\/character\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/g)){
  const block=m[2],n=block.match(/<p class="entry__name">([\s\S]*?)<\/p>/),w=block.match(/<p class="entry__world">([\s\S]*?)<\/p>/),image=block.match(/entry__chara__face[^>]*>\s*<img[^>]*src="([^"]+)"/);
  if(n&&w&&image&&plain(n[1])===name&&plain(w[1]).replace(/\s*\[.*\]$/,'')===world){const url=new URL(plain(image[1]));if(url.protocol==='https:'&&/^img\d*\.finalfantasyxiv\.com$/.test(url.hostname)&&url.pathname.startsWith('/f/'))matches.push({url:url.href,id:m[1]});}
 }
 return matches.length===1?matches[0]:null;
}
export function findProfilePortrait(html,name,world,id){
 const n=html.match(/<p class="frame__chara__name">([\s\S]*?)<\/p>/),w=html.match(/<p class="frame__chara__world">([\s\S]*?)<\/p>/),image=html.match(/frame__chara__face[^>]*>\s*<img[^>]*src="([^"]+)"/);
 if(!n||!w||!image||plain(n[1])!==name||plain(w[1]).replace(/\s*\[.*\]$/,'')!==world)return null;
 try{const url=new URL(plain(image[1]));return url.protocol==='https:'&&/^img\d*\.finalfantasyxiv\.com$/.test(url.hostname)&&url.pathname.startsWith('/f/')?{url:url.href,id}:null;}catch{return null;}
}
export function portraitRetryState(entry,now=Date.now()){
 if(!entry?.firstFailure)return {excluded:false,stopped:false,nextRetry:null};
 const stopped=now-entry.firstFailure>=36*3600000;
 return {excluded:true,stopped,firstFailure:entry.firstFailure,lastAttempt:entry.lastAttempt,nextRetry:stopped?null:entry.lastAttempt+6*3600000};
}
export function createPortraitCache(dir,fetcher=fetch,clock=Date.now){
 let states={},revision=0,persist=Promise.resolve();const stateFile=path.join(dir,'status.json');
 const ready=readFile(stateFile,'utf8').then(s=>{states=JSON.parse(s);}).catch(()=>{});
 function save(){revision++;const contents=JSON.stringify(states);persist=persist.then(async()=>{await mkdir(dir,{recursive:true});await writeFile(stateFile+'.tmp',contents);await rename(stateFile+'.tmp',stateFile);}).catch(()=>{});return persist;}

 const getCrest=createCrestCache(path.join(dir,'fc'),fetcher);
 const pending=new Map(),queue=[];let active=0;
 const get=async (owner,force=false)=>{
  await ready;
  if(owner?.type==='FC')return getCrest(owner,force);
  if(!owner||owner.type!=='キャラクター'||!owner.world||owner.world.startsWith('World '))return {bytes:portraitFallback,type:'image/svg+xml'};
  const key=createHash('sha256').update(owner.name+'@'+owner.world).digest('hex'),file=path.join(dir,key+'.jpg');
  const stateKey=owner.id||key,entry=states[stateKey],retryState=portraitRetryState(entry,clock());
  if(!force&&retryState.excluded&&(retryState.stopped||retryState.nextRetry>clock()))return {bytes:portraitFallback,type:'image/svg+xml'};
  let cached;try{cached={bytes:await readFile(file),type:'image/jpeg'};if(!force&&!retryState.excluded&&clock()-(await stat(file)).mtimeMs<7*86400000)return cached;}catch{}
  if(!pending.has(key))pending.set(key,(async()=>{
   if(active>=2)await new Promise(resolve=>queue.push(resolve));else active++;
   try{
    let portrait=null;
    try{
     const profile=JSON.parse(await readFile(path.join(dir,key+'.profile.json'),'utf8'));
     if(/^\d+$/.test(profile.id)){
      const response=await fetcher('https://jp.finalfantasyxiv.com/lodestone/character/'+profile.id+'/',{signal:AbortSignal.timeout(15000),redirect:'error'});
      if(response.ok)portrait=findProfilePortrait(await response.text(),owner.name,owner.world,profile.id);
     }
    }catch{}
    if(!portrait){
    const url=new URL('https://jp.finalfantasyxiv.com/lodestone/character/');url.searchParams.set('q',owner.name);url.searchParams.set('worldname',owner.world);
    const response=await fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw new Error('Search unavailable');
    portrait=findPortrait(await response.text(),owner.name,owner.world);if(!portrait)throw new Error('No unique match');
    }
    const image=await fetcher(portrait.url,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!image.ok||!image.headers.get('content-type')?.startsWith('image/jpeg'))throw new Error('Image unavailable');
    const chunks=[];let size=0;for await(const chunk of image.body){size+=chunk.length;if(size>1024*1024)throw new Error('Image too large');chunks.push(chunk);}const bytes=Buffer.concat(chunks);if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error('Invalid JPEG');
    await mkdir(dir,{recursive:true});await writeFile(path.join(dir,key+'.profile.json'),JSON.stringify({id:portrait.id}));await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file);revision++;if(states[stateKey]){delete states[stateKey];await save();}return {bytes,type:'image/jpeg'};
   }catch{states[stateKey]={firstFailure:states[stateKey]?.firstFailure||clock(),lastAttempt:clock()};await save();return{bytes:portraitFallback,type:'image/svg+xml'};}finally{const next=queue.shift();if(next)next();else active--;}
  })().finally(()=>pending.delete(key)));
  return pending.get(key);
 };
 get.profile=async owner=>{
  const key=createHash('sha256').update(owner.name+'@'+owner.world).digest('hex'),file=path.join(dir,key+'.profile.json');
  try{const cached=JSON.parse(await readFile(file,'utf8'));if(/^\d+$/.test(cached.id))return 'https://jp.finalfantasyxiv.com/lodestone/character/'+cached.id+'/';}catch{}
  const url=new URL('https://jp.finalfantasyxiv.com/lodestone/character/');url.searchParams.set('q',owner.name);url.searchParams.set('worldname',owner.world);
  const response=await fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw new Error('ロドストに接続できませんでした。');
  const match=findPortrait(await response.text(),owner.name,owner.world);if(!match)throw new Error('一致するキャラクターの個別ページを確認できませんでした。');
  await mkdir(dir,{recursive:true});await writeFile(file,JSON.stringify({id:match.id}));return 'https://jp.finalfantasyxiv.com/lodestone/character/'+match.id+'/';
 };
 get.ready=ready;get.status=owner=>portraitRetryState(states[owner.id],clock());get.revision=()=>revision+':'+Object.values(states).filter(entry=>portraitRetryState(entry,clock()).stopped).length;return get;
}
