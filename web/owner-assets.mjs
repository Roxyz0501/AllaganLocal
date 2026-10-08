import {isCurrencyRecord} from './currencies.mjs';
const empty=()=>({quantity:0,cashQuantity:0,cashValue:0,cashUnknown:0,marketQuantity:0,marketValue:0,marketUnknown:0});
export function withOwnerAssets(owners,records,catalog,tagged,market){
 const tags=new Set(tagged),byOwner=new Map(),map=new Map(owners.map(o=>[o.id,o]));
 for(const r of records){if(!r.id||r.quantity<=0||isCurrencyRecord(r)||r.id===1||r.id===80)continue;const a=byOwner.get(r.owner)||empty();a.quantity+=r.quantity;
 if(tags.has(r.id)){a.cashQuantity+=r.quantity;const sell=catalog.get(r.id)?.sell;if(sell==null)a.cashUnknown+=r.quantity;else a.cashValue+=sell*r.quantity;}
 else if(r.category!==5){a.marketQuantity+=r.quantity;const prices=market.item(r.id,map.get(r.owner)?.world||''),q=prices.local?.[r.hq?'hq':'nq'];if(q)a.marketValue+=q.price*r.quantity;else if(prices.marketable!==false)a.marketUnknown+=r.quantity;}
 byOwner.set(r.owner,a);}
 const plus=values=>values.reduce((sum,a)=>{for(const key of Object.keys(sum))sum[key]+=a[key]||0;return sum;},empty());
 return owners.map(o=>{const personal=byOwner.get(o.id)||empty(),retainers=plus(owners.filter(r=>r.type==='リテイナー'&&r.parentIds?.includes(o.id)).map(r=>byOwner.get(r.id)||empty()));return {...o,assets:{personal,retainers,total:plus([personal,retainers])}};});
}
