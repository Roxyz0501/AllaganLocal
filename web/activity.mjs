import {createHash} from 'node:crypto';
export const WEEK_MS=7*24*60*60*1000;
export function updateActivity(previous,slots,now=new Date().toISOString(),knownOwners=[]){
 const entries={...previous.entries};let changed=false;
 const groups=Map.groupBy(slots,r=>r.owner);for(const id of knownOwners)if(!groups.has(id))groups.set(id,[]);
 for(const [owner,rows] of groups){
  const hash=createHash('sha256').update(JSON.stringify(rows.map(r=>[r.container,r.slot,r.id,r.quantity,r.hq,r.collectable]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]))).digest('hex');
  const old=entries[owner];if(!old){entries[owner]={hash,firstObservedAt:now,lastChangedAt:null};changed=true;}else if(old.hash!==hash){entries[owner]={...old,hash,lastChangedAt:now};changed=true;}
 }
 return {state:{version:1,entries},changed};
}
export function withActivity(owners,activity,now=Date.now()){
 return owners.map(o=>{
  const ids=o.type==='キャラクター'?[o.id,...owners.filter(r=>r.type==='リテイナー'&&r.parentIds?.includes(o.id)).map(r=>r.id)]:[o.id];
  const dates=ids.map(id=>activity.entries[id]?.lastChangedAt).filter(d=>Number.isFinite(Date.parse(d))).sort();
  const lastChangedAt=dates.at(-1)||null;
  const observed=ids.map(id=>activity.entries[id]).filter(Boolean).map(e=>e.lastChangedAt||e.firstObservedAt).filter(d=>Number.isFinite(Date.parse(d))).sort();
  const observedSince=observed.at(-1)||null;
  return {...o,lastChangedAt,observedSince,stale:observedSince!==null&&now-Date.parse(observedSince)>=WEEK_MS};
 });
}
