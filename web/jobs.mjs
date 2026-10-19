import {findProfilePortrait} from './portraits.mjs';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
const battle=new Set('ナイト 戦士 暗黒騎士 ガンブレイカー 白魔道士 学者 占星術師 賢者 モンク 竜騎士 忍者 侍 リーパー ヴァイパー 吟遊詩人 機工士 踊り子 黒魔道士 召喚士 赤魔道士 ピクトマンサー 青魔道士'.split(' '));
const plain=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
export function parseJobs(html){
 const jobs=[];
 for(const [,block] of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)){
  const name=block.match(/class="character__job__name[^\"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1],level=block.match(/class="character__job__level"[^>]*>([\s\S]*?)<\/div>/)?.[1],exp=block.match(/class="character__job__exp"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  if(!name||level==null)continue;const n=plain(name).slice(0,80),l=Number(plain(level));
  jobs.push({name:n,level:Number.isInteger(l)&&l>0&&l<1000?l:null,battle:battle.has(n),capped:battle.has(n)&&l>0&&/^--\s*\/\s*--$/.test(plain(exp||''))});
 }
 if(!jobs.length||jobs.length>50)throw new Error('ジョブ情報を取得できませんでした。');
 return jobs;
}
export function createJobCache(dir,profile,fetcher=fetch){
 const file=path.join(dir,'jobs.json');let entries={},revision=0,persist=Promise.resolve();const pending=new Map();
 const ready=(async()=>{try{const text=await readFile(file,'utf8');if(text.length<2000000)entries=Object.fromEntries(Object.entries(JSON.parse(text)).slice(-200));}catch{}})();
 const snapshot=o=>{const e=entries[o.id];return e?.identity===o.name+'@'+o.world?e:null;};
 async function refresh(o){await ready;if(o.type!=='キャラクター')return;if(pending.has(o.id))return pending.get(o.id);
 const task=(async()=>{try{const url=await profile(o),r=await fetcher(url+'class_job/',{signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok)throw new Error('Unavailable');const html=await r.text();if(html.length>2000000)throw new Error('Too large');if(!findProfilePortrait(html,o.name,o.world,url.split('/').filter(Boolean).at(-1)))throw new Error('Identity mismatch');const jobs=parseJobs(html);entries[o.id]={identity:o.name+'@'+o.world,jobs,capped:jobs.filter(j=>j.capped).length,updatedAt:new Date().toISOString()};revision++;
 const all=Object.entries(entries);if(all.length>200)entries=Object.fromEntries(all.slice(-200));const text=JSON.stringify(entries);persist=persist.catch(()=>{}).then(async()=>{await mkdir(dir,{recursive:true});await writeFile(file+'.tmp',text);await rename(file+'.tmp',file);});await persist;
 }catch{const old=snapshot(o);entries[o.id]={...old,identity:o.name+'@'+o.world,error:'ジョブ情報を取得できませんでした。'};revision++;}})().finally(()=>pending.delete(o.id));pending.set(o.id,task);return task;}
 return {ready,snapshot,refresh,revision:()=>revision};
}
