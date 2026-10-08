import {isCurrencyRecord,currencyRows} from './currencies.mjs';
import {categories} from './inventory.mjs';
import {valueItem} from './valuation.mjs';

// SortedContainer / SortedSlotIndex are the saved display order, not physical memory slots.
const named={1000:['装備中',14],2000:['通貨',0],2001:['クリスタル',18],2500:['愛蔵品キャビネット',0],2501:['ミラージュドレッサー',0],2502:['FCポイント',0],3200:['アーマリー / 副道具',35],3201:['アーマリー / 頭',35],3202:['アーマリー / 胴',35],3203:['アーマリー / 手',35],3204:['アーマリー / 帯',35],3205:['アーマリー / 脚',35],3206:['アーマリー / 足',35],3207:['アーマリー / 耳',35],3208:['アーマリー / 首',35],3209:['アーマリー / 腕',35],3300:['アーマリー / 指',50],3400:['アーマリー / ソウルクリスタル',35],3500:['アーマリー / 主道具',50],11000:['リテイナー装備',14],12000:['リテイナー所持ギル',0],12001:['リテイナークリスタル',18],12002:['マーケット出品中',20],22000:['FCチェストのギル',0],22001:['FCクリスタル',18]};
export function containerInfo(id,category){
  let info=named[id];
  if(id>=0&&id<=3)info=[`所持品 ${id+1}`,35];
  if(id>=4000&&id<=4001)info=[`チョコボかばん ${id-3999}`,35];
  if(id>=4100&&id<=4101)info=[`プレミアムかばん ${id-4099}`,35];
  if(id>=10000&&id<=10006)info=[`リテイナー所持品 ${id-9999}`,35];
  if(id>=20000&&id<=20010)info=[`FCチェスト ${id-19999}`,50];
  return {name:info?.[0]||`${categories[category]||'その他'} / ${id}`,capacity:info?.[1]||0,grid:!!info?.[1],columns:5};
}
export function ownerDirectory(slots,characters,aliases={}){
  const byOwner=Map.groupBy(slots,r=>r.owner);
  const result=[...new Set([...characters.keys(),...byOwner.keys()])].map(id=>{
    const c=characters.get(id)||{id,name:`保管者 · ${id.slice(-6)}`,type:id.startsWith('9')?'FC':id.startsWith('3')?'リテイナー':'キャラクター',parentIds:[],parentNames:[]};
    const rows=byOwner.get(id)||[],gilContainer=c.type==='FC'?22000:c.type==='リテイナー'?12000:2000;
    const balance=(container,item)=>{const found=rows.filter(r=>r.container===container&&r.id===item);return found.length?found.reduce((n,r)=>n+r.quantity,0):null;};
    const listed=rows.filter(r=>(r.category===9||r.container===12002)&&r.id&&r.quantity>0);
    return {...c,listedStacks:listed.length,listedQuantity:listed.reduce((n,r)=>n+r.quantity,0),name:aliases[id]||c.name,gil:balance(gilContainer,1)??(c.type==='リテイナー'?c.retainerGilSnapshot??null:null),points:c.type==='FC'?balance(2502,80):null,stacks:rows.filter(r=>r.id&&r.quantity).length};
  }).sort((a,b)=>a.name.localeCompare(b.name,'ja')||a.id.localeCompare(b.id));
  return result.map(o=>{if(o.type!=='キャラクター')return o;const children=result.filter(r=>r.type==='リテイナー'&&r.parentIds?.includes(o.id)),unknown=children.filter(r=>r.gil==null).length,known=children.reduce((n,r)=>n+(r.gil??0),0);return {...o,retainerGil:unknown?null:known,retainerKnownGil:known,retainerUnknown:unknown,totalGil:o.gil==null?null:o.gil+known};});
}
export function storageView(slots,owners,catalog,params){
  const owner=params.get('owner')||'',highlight=Number(params.get('highlight'))||0,category=Number(params.get('category'))||0;
  const selected=owners.find(o=>o.id===owner);
  const children=params.get('children')==='1'&&selected?.type==='キャラクター';
  const scope=owner?owners.filter(o=>o.id===owner||(children&&o.type==='リテイナー'&&o.parentIds?.includes(owner))):highlight?owners.filter(o=>slots.some(r=>r.owner===o.id&&r.id===highlight&&r.quantity)):[];
  const ids=new Set(scope.map(o=>o.id));
  const ownedSlots=slots.filter(r=>ids.has(r.owner));
  const filtered=ownedSlots.filter(r=>!isCurrencyRecord(r)&&(!category||r.category===category));
  const groups=Map.groupBy(filtered,r=>`${r.owner}:${r.container}`);
  const containers=[...groups.values()].map(rows=>{
    const first=rows[0],info=containerInfo(first.container,first.category);
    const items=rows.filter(r=>r.id&&r.quantity).map(r=>({...r,name:catalog.get(r.id)?.name||`アイテム #${r.id}`,itemCategory:catalog.get(r.id)?.category||'分類不明',highlighted:r.id===highlight})).sort((a,b)=>a.slot-b.slot);
    return {...info,owner:first.owner,id:first.container,category:first.category,size:Math.max(info.capacity,...rows.map(r=>r.slot+1)),items,matches:items.filter(r=>r.highlighted).length};
  }).filter(c=>!highlight||c.matches).sort((a,b)=>a.owner.localeCompare(b.owner)||a.category-b.category||a.id-b.id);
  const displayed=params.get('paged')==='1'?containers.map(c=>[2500,2501].includes(c.id)?dresserPage(c,params.get(c.id===2500?'cabinetPage':'dresserPage')):c):containers;
  return {owners:scope,currencies:currencyRows(ownedSlots,scope,catalog),containers:displayed,highlight,highlightName:catalog.get(highlight)?.name||`アイテム #${highlight}`,matches:containers.reduce((n,c)=>n+c.matches,0),quantity:containers.reduce((n,c)=>n+c.items.filter(r=>r.highlighted).reduce((s,r)=>s+r.quantity,0),0),categories:[...new Set(ownedSlots.filter(r=>!isCurrencyRecord(r)).map(r=>r.category))].map(id=>({id,name:categories[id]||'その他'}))};
}
export function splitLocations(items){
  return items.flatMap(item=>item.locations.length?item.locations.map(l=>valueItem({...item,itemDetail:item,targetQuantity:item.quantity,quantity:l.excluded?0:l.quantity,nq:l.excluded?0:l.nq,hq:l.excluded?0:l.hq,collectable:l.excluded?0:l.collectable,locations:[l],excludedQuantity:l.excluded?l.quantity:0})): [item]);
}

export function dresserPage(container,requested){
 const pageSize=50,total=container.items.length,pages=Math.max(1,Math.ceil(total/pageSize));
 const matchPages=[...new Set(container.items.flatMap((r,i)=>r.highlighted?[Math.floor(i/pageSize)+1]:[]))];
 const wanted=requested===null||requested===undefined?matchPages[0]||1:Number(requested);
 const page=Math.max(1,Math.min(pages,Number.isFinite(wanted)?Math.floor(wanted):1));
 return {...container,paged:true,page,pageSize,pages,total,matchPages,items:container.items.slice((page-1)*pageSize,page*pageSize)};
}
