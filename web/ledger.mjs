const japanDateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'});
export function japanDay(date=new Date()){return japanDateFormat.format(date);}
export function previousDay(day){return new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);}
function combinedTimeline(sources,sum){
 const events=new Map();
 sources.forEach((s,i)=>{for(const p of [...s.changes,...Object.values(s.days)]){if(!events.has(p.at))events.set(p.at,new Map());events.get(p.at).set(i,p);}});
 const latest=new Map(),changes=[];let day='';
 for(const at of [...events.keys()].sort()){
  const nextDay=japanDay(new Date(at));
  if(nextDay!==day){for(const i of latest.keys())if(!sources[i].days[nextDay])latest.delete(i);day=nextDay;}
  for(const [i,p] of events.get(at))latest.set(i,p);
  const amounts=sum(sources.map((_,i)=>latest.get(i)));
  if(!changes.length||japanDay(new Date(changes.at(-1).at))!==day||JSON.stringify(changes.at(-1).amounts)!==JSON.stringify(amounts))changes.push({at,amounts});
 }
 return changes;
}
export function recordMoney(ledger,observations,now=new Date()){
 const day=japanDay(now),at=now.toISOString();let changed=false;const patches=[];const series={...ledger.series};
 for(const observation of observations){
  const {key,label,...amounts}=observation;const old=series[key];const previous=old?.changes.findLast(p=>p.at<=at);
  const signature=JSON.stringify(amounts),different=!previous||JSON.stringify(previous.amounts)!==signature;
  if(!old||!old.days[day]||different||old.label!==label){
   const point={at,amounts};const daily=!old?.days[day]||old.days[day].at<=at;patches.push({key,label,point,changed:different,daily});series[key]={label,days:daily?{...old?.days,[day]:point}:old.days,changes:different?[...(old?.changes||[]),point].sort((a,b)=>a.at.localeCompare(b.at)):old.changes};changed=true;
  }
 }
 return {changed,patches,ledger:{version:1,startedAt:ledger.startedAt||at,series}};
}
export function moneySummary(ledger,key,day=japanDay()){
 const s=ledger.series[key],today=s?.days[day],prior=s?.days[previousDay(day)];const value=today?.amounts.value??null,previous=prior?.amounts.value??null;
 return {value,previous,change:value==null||previous==null?null:value-previous,at:today?.at||null};
}
export function moneyView(ledger,key,day=japanDay(),from='',to=''){
 const inRange=d=>from||to?(!from||d>=from)&&(!to||d<=to):d===day;
 const s=ledger.series[key];return {key,label:s?.label||'',startedAt:(key.startsWith('points:')||key==='all:points'||key.startsWith('item:')||key==='all:items'||key.startsWith('retainer:')||key==='all:retainers'?s?.changes[0]?.at:ledger.startedAt)||null,day,...moneySummary(ledger,key,day),amounts:s?.days[day]?.amounts||null,days:Object.entries(s?.days||{}).filter(([date])=>inRange(date)).sort(([a],[b])=>b.localeCompare(a)).map(([date,point])=>({date,...point,...moneySummary(ledger,key,date)})),changes:(s?.changes||[]).map((p,i,all)=>({...p,delta:i&&p.amounts.value!=null&&all[i-1].amounts.value!=null?p.amounts.value-all[i-1].amounts.value:null})).filter(p=>inRange(japanDay(new Date(p.at)))).toReversed()};
}

// Derive totals from recorded entities; never invent balances for missing dates.
export function withMoneyTotals(ledger,excludedKeys=new Set()){
 const series={...ledger.series};
 for(const [key,label,prefixes] of [['all:retainers','全リテイナー所持ギル',['retainer:']],['all:points','全FCポイント',['points:']],['all:gil','全体（キャラクター＋FC所持ギル）',['character:','fc:']],['all:characters','全キャラクター（本人＋リテイナー）',['character:']],['all:fc','全FCチェスト',['fc:']],['all:lists','全マイリスト参考価格（重複含む）',['list:']]]){
  const sources=Object.entries(ledger.series).filter(([k])=>!excludedKeys.has(k)&&prefixes.some(p=>k.startsWith(p))).map(([,s])=>s);
  const dates=[...new Set(sources.flatMap(s=>Object.keys(s.days)))].sort();
  const sum=points=>{const known=points.filter(p=>p?.amounts.value!=null);return {value:known.length?known.reduce((n,p)=>n+p.amounts.value,0):null,personal:null,retainers:null,missing:points.length-known.length,total:points.length};};
  const days=Object.fromEntries(dates.map(date=>{const points=sources.map(s=>s.days[date]);return [date,{at:points.filter(Boolean).map(p=>p.at).sort().at(-1),amounts:sum(points)}];}));
  const changes=combinedTimeline(sources,sum);
  series[key]={label,days,changes};
 }
 return {...ledger,series};
}

export function itemMetricLedger(ledger,metric){
 const series={};for(const [key,s] of Object.entries(ledger.series)){if(!key.startsWith('item:')&&key!=='all:items')continue;const point=p=>({...p,amounts:{...p.amounts,value:metric==='total'?(p.amounts.market==null||p.amounts.cash==null?null:p.amounts.market+p.amounts.cash):metric==='cash'?p.amounts.cash??null:metric==='market'?p.amounts.market??null:metric==='price'?p.amounts.price??null:p.amounts.value}});series[key]={...s,days:Object.fromEntries(Object.entries(s.days).map(([day,p])=>[day,point(p)])),changes:s.changes.map(point)};}return {...ledger,series};
}

export function listMetricLedger(ledger,metric){
 if(metric!=='count')return ledger;const series={...ledger.series};
 for(const [key,s] of Object.entries(series)){if(!key.startsWith('list:'))continue;const point=p=>({...p,amounts:{...p.amounts,value:p.amounts.quantity??null}});series[key]={...s,days:Object.fromEntries(Object.entries(s.days).map(([day,p])=>[day,point(p)])),changes:s.changes.map(point)};}return {...ledger,series};
}

export function characterItemLedger(ledger,character){
 if(!character)return ledger;
 const prefix='item-owner:'+character+':';
 return {...ledger,series:Object.fromEntries(Object.entries(ledger.series).filter(([key])=>key.startsWith(prefix)).map(([key,s])=>[key.slice(prefix.length)==='all'?'all:items':'item:'+key.slice(prefix.length),s]))};
}

export function scopedItems(ledger,character,omitted=new Set(),selectedKey=''){
 if(character)return omitted.has(character)?{...ledger,series:{}}:characterItemLedger(ledger,character);
 const grouped=new Map();for(const [key,s] of Object.entries(ledger.series)){const m=key.match(/^item-owner:(\d+):(\d+|all)$/);if(!m||omitted.has(m[1])||(selectedKey&&m[2]!== (selectedKey==='all:items'?'all':selectedKey.slice(5))))continue;const target=m[2]==='all'?'all:items':'item:'+m[2];if(!grouped.has(target))grouped.set(target,[]);grouped.get(target).push(s);}
 const series={};for(const [key,sources] of grouped){const dates=[...new Set(sources.flatMap(s=>Object.keys(s.days)))].sort(),days={},changes=[];for(const day of dates){const points=sources.map(s=>s.days[day]).filter(Boolean),amounts={personal:null,retainers:null};for(const field of ['value','price','market','cash','marketUnknown'])amounts[field]=points.some(p=>p.amounts[field]==null)?null:points.reduce((n,p)=>n+p.amounts[field],0);const point={at:points.map(p=>p.at).sort().at(-1),amounts};days[day]=point;changes.push(point);}const timeline=combinedTimeline(sources,rows=>{const points=rows.filter(Boolean),amounts={personal:null,retainers:null};for(const field of ['value','price','market','cash','marketUnknown'])amounts[field]=points.some(p=>p.amounts[field]==null)?null:points.reduce((n,p)=>n+p.amounts[field],0);return amounts;});series[key]={label:sources[0].label,days,changes:timeline};}return {...ledger,series};
}

// Filter at read time so restoring a character also restores its recorded history.
export function visibleHistory(ledger,excluded,pricing=new Map()){
 const omitted=new Set([...excluded].map(k=>k.split(':')[1]));
 const series={};
 for(const [key,s] of Object.entries(ledger.series)){
  if(excluded.has(key))continue;
  if(!key.startsWith('list:')){series[key]=s;continue;}
  const point=p=>{const market=pricing.get(key)==='market';if(!p.amounts.owners)return omitted.size||market?{...p,amounts:{...p.amounts,value:null,quantity:null,unscoped:true}}:p;
   const rows=Object.entries(p.amounts.owners).filter(([id])=>!omitted.has(id)).map(([,v])=>v);
   return {...p,amounts:{...p.amounts,value:rows.some(r=>r[market?'market':'value']==null)?null:rows.reduce((n,r)=>n+r[market?'market':'value'],0),quantity:rows.reduce((n,r)=>n+r.quantity,0)}};
  };
  series[key]={...s,days:Object.fromEntries(Object.entries(s.days).map(([d,p])=>[d,point(p)])),changes:s.changes.map(point)};
 }
 return {...ledger,series};
}
