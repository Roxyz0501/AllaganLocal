export function marketValue(item,prices,tagged=false,marketable=null){
 if(tagged||marketable===false||!item.quantity)return {value:0,unknown:0};let value=0,unknown=0;
 const eligible=item.locations?item.locations.filter(l=>Number(l.category)!==5&&!l.excluded).reduce((a,l)=>{for(const k of ['nq','hq','collectable'])a[k]+=(l[k]||0);return a;},{nq:0,hq:0,collectable:0}):item;
 for(const [quality,quantity] of [['nq',(eligible.nq||0)+(eligible.collectable||0)],['hq',eligible.hq||0]]){if(!quantity)continue;const price=prices?.[quality]?.price;if(price==null)unknown+=quantity;else value+=price*quantity;}return {value,unknown};
}
export function marketSummary(items,market,tagged=[]){const tags=new Set(tagged);let cash=0,cashUnknown=0,value=0,unknown=0;for(const item of items){if(tags.has(item.id)){if(item.sell==null)cashUnknown+=item.quantity;else cash+=item.quantity*item.sell;}const price=market.item(item.id,''),sum=marketValue(item,price.region,tags.has(item.id),price.marketable);value+=sum.value;unknown+=sum.unknown;}return {cash,cashUnknown,value,unknown};}
