import {setTimeout as delay} from 'node:timers/promises';
import {openPriceCache} from './price-cache.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function quote(row,scope,worlds,ownerWorld=''){const result={};for(const quality of ['nq','hq']){const q=row[quality]?.minListing?.[scope];result[quality]=q&&Number.isFinite(q.price)&&q.price>0?{price:q.price,world:worlds[q.worldId]||ownerWorld||String(q.worldId||''),at:row.worldUploadTimes?.find(w=>q.worldId?w.worldId===q.worldId:worlds[w.worldId]===ownerWorld)?.timestamp||null}:null;}return result;}
export async function createMarketPrices(file,fetcher=fetch){
 const storage=await openPriceCache(file),cache=storage.cache;let closing=false;const operations=new Set(),controller=new AbortController();
 function track(p){operations.add(p);p.finally(()=>operations.delete(p)).catch(()=>{});return p;}
 function apply(row,scope,worlds){const item=cache.items[row.itemId]||{worlds:{}};const region=quote(row,'region',worlds),local=scope!=='Japan'?quote(row,'world',worlds,scope):undefined;if(JSON.stringify(item.region)===JSON.stringify(region)&&(scope==='Japan'||JSON.stringify(item.worlds?.[scope])===JSON.stringify(local)))return;item.region=region;item.worlds||={};if(scope!=='Japan')item.worlds[scope]=local;item.updatedAt=new Date().toISOString();cache.items[row.itemId]=item;storage.item(row.itemId);cache.updatedAt=item.updatedAt;revision++;}
 let marketableSet=new Set(cache.marketable);
 let job={running:false,done:0,total:0,errors:0,message:''},revision=0;
 let activeRequests=0;const requestQueue=[];async function limitedFetch(url,options){if(activeRequests>=4)await new Promise(resolve=>requestQueue.push(resolve));else activeRequests++;try{return await fetcher(url,options);}finally{const next=requestQueue.shift();if(next)next();else activeRequests--;}}
 let cooldownUntil=0,saveQueue=Promise.resolve(),saveFailures=0;const wait=ms=>delay(ms,undefined,{signal:controller.signal});
 async function get(url){let last;for(let i=0;i<3;i++){if(closing)throw Error('Price update stopped');try{if(cooldownUntil>Date.now())await wait(Math.min(60000,cooldownUntil-Date.now()));const r=await limitedFetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});if(r.status===429){const raw=r.headers.get('retry-after'),seconds=Number(raw),until=raw?(Number.isFinite(seconds)?Date.now()+seconds*1000:Date.parse(raw)):0;cooldownUntil=Math.max(cooldownUntil,Number.isFinite(until)&&until>Date.now()?until:Date.now()+5000*(i+1));}if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}catch(e){last=e;if(closing)throw e;if(i<2)await wait(1000*(i+1));}}throw last;}
 function persist(){if(saveFailures>=3)throw Error('Price saving paused');try{storage.meta();storage.flush();saveFailures=0;return Promise.resolve();}catch(e){saveFailures++;throw e;}}

 return {metrics:storage.metrics,async close(){closing=true;controller.abort();await Promise.allSettled([...operations]);await saveQueue;storage.close();},status:()=>({...job,updatedAt:cache.updatedAt,revision}),item:(id,world)=>({marketable:cache.marketable.length?marketableSet.has(id):null,region:cache.items[id]?.region||null,local:cache.items[id]?.worlds?.[world]||null,world,updatedAt:cache.items[id]?.updatedAt||null}),
 updateItems(ids,scopes,worlds){if(closing)return Promise.reject(Error('Price cache closed'));return track((async()=>{
 const unique=[...new Set(ids)].filter(id=>!marketableSet.size||marketableSet.has(id));let errors=0;
 for(let offset=0;offset<unique.length;offset+=100){const batch=unique.slice(offset,offset+100);await Promise.all([...new Set(['Japan',...scopes.filter(Boolean)])].map(async scope=>{try{const result=await get('https://universalis.app/api/v2/aggregated/'+encodeURIComponent(scope)+'/'+batch.join(','));if(!Array.isArray(result.results))throw new Error('Invalid response');errors+=(result.failedItems||[]).length;for(const row of result.results)apply(row,scope,worlds);}catch{errors+=batch.length;}}));}
 await persist();return {items:unique.length,errors};
 })());},
 start(catalog,records,owners,worlds){if(closing||job.running)return;saveFailures=0;job={running:true,done:0,total:0,errors:0,message:'対象アイテムを確認中'};
 return track((async()=>{try{
 const marketable=await get('https://universalis.app/api/v2/marketable');if(!Array.isArray(marketable))throw new Error('Invalid item list');cache.marketable=marketable;marketableSet=new Set(marketable);const valid=marketableSet;
 const all=[...catalog.keys()].filter(id=>valid.has(id)),tasks=[],byWorld=new Map(),ownerMap=new Map(owners.map(o=>[o.id,o]));
 for(const r of records){const world=ownerMap.get(r.owner)?.world;if(!world||world.startsWith('World ')||!valid.has(r.id))continue;if(!byWorld.has(world))byWorld.set(world,new Set());byWorld.get(world).add(r.id);}
 const add=(scope,ids)=>{for(let i=0;i<ids.length;i+=100)tasks.push({scope,ids:ids.slice(i,i+100)});};
 // Owned items are fetched first, so useful valuations appear before the full catalogue finishes.
 for(const [world,ids] of byWorld)add(world,[...ids]);add('Japan',all);job.total=tasks.length;
 let nextTask=0;async function worker(){while(!closing&&nextTask<tasks.length){const task=tasks[nextTask++];job.message='4件並列 · '+task.scope+' の最安価格を取得中';try{const data=await get('https://universalis.app/api/v2/aggregated/'+encodeURIComponent(task.scope)+'/'+task.ids.join(','));if(!Array.isArray(data.results))throw new Error('Invalid market response');job.errors+=(data.failedItems||[]).length;
 for(const row of data.results)apply(row,task.scope,worlds);
 }catch{job.errors+=task.ids.length;}job.done++;if(job.done%10===0)await persist();await pause(100);}}
 const results=await Promise.allSettled(Array.from({length:Math.min(4,tasks.length)},()=>worker()));const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
 await persist();job.message=job.errors?'更新完了（一部取得できませんでした。前回価格を保持）':'更新完了';
 }catch(e){job.message='更新失敗：'+e.message;}finally{job.running=false;revision++;}})());
 }};
}
