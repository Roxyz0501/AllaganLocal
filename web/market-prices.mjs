import {readFile,writeFile,rename} from 'node:fs/promises';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function quote(row,scope,worlds,ownerWorld=''){const result={};for(const quality of ['nq','hq']){const q=row[quality]?.minListing?.[scope];result[quality]=q&&Number.isFinite(q.price)&&q.price>0?{price:q.price,world:worlds[q.worldId]||ownerWorld||String(q.worldId||''),at:row.worldUploadTimes?.find(w=>q.worldId?w.worldId===q.worldId:worlds[w.worldId]===ownerWorld)?.timestamp||null}:null;}return result;}
export async function createMarketPrices(file,fetcher=fetch){
 let cache={items:{},updatedAt:null,marketable:[]};try{cache=JSON.parse(await readFile(file,'utf8'));}catch{}
 let marketableSet=new Set(cache.marketable);
 let job={running:false,done:0,total:0,errors:0,message:''},revision=0;
 let activeRequests=0;const requestQueue=[];async function limitedFetch(url,options){if(activeRequests>=4)await new Promise(resolve=>requestQueue.push(resolve));else activeRequests++;try{return await fetcher(url,options);}finally{const next=requestQueue.shift();if(next)next();else activeRequests--;}}
 let cooldownUntil=0,saveQueue=Promise.resolve();
 async function get(url){let last;for(let i=0;i<3;i++){try{if(cooldownUntil>Date.now())await pause(cooldownUntil-Date.now());const r=await limitedFetch(url,{signal:AbortSignal.timeout(20000)});if(r.status===429){const raw=r.headers.get('retry-after'),seconds=Number(raw),until=raw?(Number.isFinite(seconds)?Date.now()+seconds*1000:Date.parse(raw)):0;cooldownUntil=Math.max(cooldownUntil,Number.isFinite(until)&&until>Date.now()?until:Date.now()+5000*(i+1));}if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}catch(e){last=e;if(i<2)await pause(1000*(i+1));}}throw last;}
 function persist(){const contents=JSON.stringify(cache);const saving=saveQueue.then(async()=>{await writeFile(file+'.tmp',contents);await rename(file+'.tmp',file);});saveQueue=saving.catch(()=>{});return saving;}

 return {status:()=>({...job,updatedAt:cache.updatedAt,revision}),item:(id,world)=>({marketable:cache.marketable.length?marketableSet.has(id):null,region:cache.items[id]?.region||null,local:cache.items[id]?.worlds?.[world]||null,world,updatedAt:cache.items[id]?.updatedAt||null}),
 async updateItems(ids,scopes,worlds){
 const unique=[...new Set(ids)].filter(id=>!marketableSet.size||marketableSet.has(id));let errors=0;
 for(let offset=0;offset<unique.length;offset+=100){const batch=unique.slice(offset,offset+100);await Promise.all([...new Set(['Japan',...scopes.filter(Boolean)])].map(async scope=>{try{const result=await get('https://universalis.app/api/v2/aggregated/'+encodeURIComponent(scope)+'/'+batch.join(','));if(!Array.isArray(result.results))throw new Error('Invalid response');errors+=(result.failedItems||[]).length;for(const row of result.results){const item=cache.items[row.itemId]||{worlds:{}};item.region=quote(row,'region',worlds);if(scope!=='Japan')item.worlds[scope]=quote(row,'world',worlds,scope);item.updatedAt=new Date().toISOString();cache.items[row.itemId]=item;}}catch{errors+=batch.length;}}));}
 cache.updatedAt=new Date().toISOString();revision++;await persist();return {items:unique.length,errors};
 },
 start(catalog,records,owners,worlds){if(job.running)return;job={running:true,done:0,total:0,errors:0,message:'対象アイテムを確認中'};
 return (async()=>{try{
 const marketable=await get('https://universalis.app/api/v2/marketable');if(!Array.isArray(marketable))throw new Error('Invalid item list');cache.marketable=marketable;marketableSet=new Set(marketable);const valid=marketableSet;
 const all=[...catalog.keys()].filter(id=>valid.has(id)),tasks=[],byWorld=new Map(),ownerMap=new Map(owners.map(o=>[o.id,o]));
 for(const r of records){const world=ownerMap.get(r.owner)?.world;if(!world||world.startsWith('World ')||!valid.has(r.id))continue;if(!byWorld.has(world))byWorld.set(world,new Set());byWorld.get(world).add(r.id);}
 const add=(scope,ids)=>{for(let i=0;i<ids.length;i+=100)tasks.push({scope,ids:ids.slice(i,i+100)});};
 // Owned items are fetched first, so useful valuations appear before the full catalogue finishes.
 for(const [world,ids] of byWorld)add(world,[...ids]);add('Japan',all);job.total=tasks.length;
 let nextTask=0;async function worker(){while(nextTask<tasks.length){const task=tasks[nextTask++];job.message='4件並列 · '+task.scope+' の最安価格を取得中';try{const data=await get('https://universalis.app/api/v2/aggregated/'+encodeURIComponent(task.scope)+'/'+task.ids.join(','));if(!Array.isArray(data.results))throw new Error('Invalid market response');job.errors+=(data.failedItems||[]).length;
 for(const row of data.results){const item=cache.items[row.itemId]||{worlds:{}};item.worlds||={};const region=quote(row,'region',worlds);item.region=region;if(task.scope!=='Japan')item.worlds[task.scope]=quote(row,'world',worlds,task.scope);item.updatedAt=new Date().toISOString();cache.items[row.itemId]=item;}revision++;
 }catch{job.errors+=task.ids.length;}job.done++;if(job.done%10===0)await persist();await pause(100);}}
 await Promise.all(Array.from({length:Math.min(4,tasks.length)},()=>worker()));
 cache.updatedAt=new Date().toISOString();await persist();job.message=job.errors?'更新完了（一部取得できませんでした。前回価格を保持）':'更新完了';
 }catch(e){job.message='更新失敗：'+e.message;}finally{job.running=false;revision++;}})();
 }};
}
