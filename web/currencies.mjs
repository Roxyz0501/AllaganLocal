export function isCurrencyRecord(r){return r.category===12||[2502,22000].includes(r.container);}
export function currencyRows(slots,owners,catalog){
 const names=new Map(owners.map(o=>[o.id,o]));
 return slots.filter(r=>r.id&&isCurrencyRecord(r)).map(r=>({...r,name:catalog.get(r.id)?.name||(r.id===1?'ギル':r.id===80?'FCポイント':`通貨 #${r.id}`),ownerName:names.get(r.owner)?.name||r.owner,world:names.get(r.owner)?.world||'',ownerType:names.get(r.owner)?.type||'',kind:r.id===1?'ギル':r.container===2502?'FCポイント':r.category===13||r.container===22001?'クリスタル':'通貨・トークン'})).sort((a,b)=>a.name.localeCompare(b.name,'ja')||a.ownerName.localeCompare(b.ownerName,'ja')||a.owner.localeCompare(b.owner));
}
