import {japanDay} from './ledger.mjs';
import {categories} from './inventory.mjs';
// Only attribute changes backed by consecutive saved observations.
export function historyOrigins(view,ledger,owners,omitted,key,metric='count',character='',pricing=new Map()){
 const byId=new Map(owners.map(o=>[o.id,o])),events=new Map();
 const label=id=>{const o=byId.get(id);return o?o.name+(o.world?' @ '+o.world:''):id;};
 const add=(at,id,place,delta,itemName='',quantityDelta=null)=>{if(delta===0||delta==null||omitted.has(id))return;const o=byId.get(id);const row={itemName,quantityDelta,owner:label(id),character:o?.type==='リテイナー'?(o.parentNames||[]).join('・'):'',place,delta};if(!events.has(at))events.set(at,[]);events.get(at).push(row);};
 const itemMode=key.startsWith('item:')||key==='all:items',listMode=key.startsWith('list:')||key==='all:lists';
 const field=a=>metric==='total'?(a.cash==null||a.market==null?null:a.cash+a.market):metric==='cash'?a.cash:metric==='market'?a.market:metric==='price'?a.price:a.value;
 const family=new Set(owners.filter(o=>o.id===key.slice(10)||o.parentIds?.includes(key.slice(10))).map(o=>o.id));
 for(const [source,s] of Object.entries(ledger.series)){
  const [type,id]=source.split(':');if(omitted.has(id))continue;
  if(itemMode){if(type!=='item-owner'||(key==='all:items'?source.split(':')[2]==='all':source.split(':')[2]!==key.slice(5))||(character&&id!==character))continue;}
  else if(listMode){if(type!=='list'||(key!=='all:lists'&&source!==key))continue;}
  else {const allowed=key===source||key==='all:gil'&&['character','retainer','fc'].includes(type)||key==='all:characters'&&['character','retainer'].includes(type)||key==='all:retainers'&&type==='retainer'||key==='all:fc'&&type==='fc'||key==='all:points'&&type==='points'||key.startsWith('character:')&&family.has(id)&&['character','retainer'].includes(type);if(!allowed)continue;}
  s.changes.forEach((p,i)=>{if(!i)return;const before=s.changes[i-1].amounts,after=p.amounts;
   if((itemMode||listMode)&&before.locations&&after.locations&&(!listMode||[...before.locations,...after.locations].every(l=>l.itemId))){const old=new Map(before.locations.map(l=>[l.owner+':'+l.category+':'+(l.itemId||''),l])),next=new Map(after.locations.map(l=>[l.owner+':'+l.category+':'+(l.itemId||''),l]));for(const k of new Set([...old.keys(),...next.keys()])){const a=old.get(k),b=next.get(k),av=a?(listMode?a[metric==='count'?'quantity':pricing.get(source)==='market'?'market':'value']:field(a)):0,bv=b?(listMode?b[metric==='count'?'quantity':pricing.get(source)==='market'?'market':'value']:field(b)):0,l=b||a;add(p.at,l.owner,(categories[l.category]||'その他')+(listMode?' / '+s.label:''),av==null||bv==null?null:bv-av,itemMode?s.label:l.itemName||'',((b?.[listMode?'quantity':'value'])??0)-((a?.[listMode?'quantity':'value'])??0));}return;}
   if(listMode){if(!before.owners||!after.owners)return;for(const owner of new Set([...Object.keys(before.owners),...Object.keys(after.owners)])){const f=metric==='count'?'quantity':pricing.get(source)==='market'?'market':'value',a=before.owners[owner]?before.owners[owner][f]:0,b=after.owners[owner]?after.owners[owner][f]:0;add(p.at,owner,'マイリスト：'+s.label,a==null||b==null?null:b-a);}return;}
   const a=itemMode?field(before):type==='character'?before.personal:before.value,b=itemMode?field(after):type==='character'?after.personal:after.value;
   add(p.at,id,itemMode?'保管場所の記録なし':type==='retainer'?'リテイナー所持金':type==='fc'?'FCチェスト':type==='points'?'FCポイント':'キャラクター所持金',a==null||b==null?null:b-a,itemMode?s.label:'',itemMode&&before.value!=null&&after.value!=null?after.value-before.value:null);
  });
 }
 const days=(view.days||[]).map(day=>{const rows=new Map();for(const [at,origins] of events){if(japanDay(new Date(at))!==day.date)continue;for(const o of origins){const id=o.owner+'|'+o.place+'|'+o.itemName,old=rows.get(id);rows.set(id,{...o,delta:(old?.delta||0)+o.delta,quantityDelta:o.quantityDelta==null||(old&&old.quantityDelta==null)?null:(old?.quantityDelta||0)+o.quantityDelta});}}return {...day,origins:[...rows.values()].filter(o=>o.delta!==0)};});
 return {...view,days,changes:view.changes.map(p=>({...p,origins:events.get(p.at)||[]}))};
}
