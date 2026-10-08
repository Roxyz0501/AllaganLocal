// Estimates use the displayed NQ base unit price for every recorded unit.
export function valueItem(item) {
  const known=Number.isFinite(item.sell)&&item.sell>=0;
  return {...item,sellTotal:item.quantity===0?0:known?item.quantity*item.sell:null};
}
export function summarize(items) {
  return items.reduce((s,x)=>{
    s.kinds++;s.quantity+=x.quantity;s.shortage+=Math.max(0,(x.target||0)-x.quantity);s.excludedQuantity+=x.excludedQuantity||0;
    if(x.sellTotal==null)s.unknownPrices++;else s.sellTotal+=x.sellTotal;
    return s;
  },{kinds:0,quantity:0,shortage:0,sellTotal:0,unknownPrices:0,excludedQuantity:0});
}
export function applyExclusions(item,exclusions=[]) {
  const keys=new Set(exclusions.map(x=>`${x.owner}:${x.category}`));
  const locations=(item.locations||[]).map(l=>({...l,excluded:keys.has(`${l.owner}:${l.category}`)}));
  // Retain a saved exclusion even when its inventory entry disappears, so it can be reset.
  for(const x of exclusions)if(!locations.some(l=>l.owner===x.owner&&l.category===x.category))locations.push({...x,quantity:0,nq:0,hq:0,collectable:0,excluded:true});
  const result={...item,quantity:0,nq:0,hq:0,collectable:0,excludedQuantity:0,locations};
  for(const l of locations){if(l.excluded){result.excludedQuantity+=l.quantity;continue;}for(const key of ['quantity','nq','hq','collectable'])result[key]+=l[key]||0;}
  return result;
}
