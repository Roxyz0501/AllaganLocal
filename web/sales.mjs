import {parseCsv} from './inventory.mjs';
export function parseSoldItems(text){
  return parseCsv(text).map((r,index)=>{
    if(r.length!==8)throw new Error(`販売履歴 ${index+1}行目: 対応する8列形式ではありません。`);
    for(const n of [0,1,2,3,4,5,6])if(!/^\d+$/.test(r[n]))throw new Error(`販売履歴 ${index+1}行目: 数値が不正です。`);
    if(!['0','1'].includes(r[3]))throw new Error('販売履歴のHQ値が不正です。');
    const m=r[7].match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if(!m)throw new Error(`販売履歴 ${index+1}行目: 日時形式が不正です。`);
    const detectedAt=`${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}:${m[6]}`;
    const check=new Date(detectedAt+'Z');
    if(!Number.isFinite(check.getTime())||check.toISOString().slice(0,19)!==detectedAt)throw new Error('販売履歴の日時が範囲外です。');
    const quantity=Number(r[4]),unitPrice=Number(r[5]),gross=quantity*unitPrice;
    if(!Number.isSafeInteger(gross)||quantity<1||quantity>4294967295||unitPrice>4294967295)throw new Error('販売履歴の金額・個数が範囲外です。');
    return {id:index,retainerId:r[0],worldId:Number(r[1]),itemId:Number(r[2]),hq:r[3]==='1',quantity,unitPrice,gross,detectedAt};
  });
}
export function parseMarketCharacters(text){
  const json=JSON.parse(text,(_key,value,context)=>typeof value==='number'&&!Number.isSafeInteger(value)?context.source:value);
  if(!json.Characters||typeof json.Characters!=='object')throw new Error('AllaganMarketのCharactersが見つかりません。');
  return new Map(Object.entries(json.Characters).filter(([id,c])=>/^\d+$/.test(id)&&c&&typeof c==='object').map(([id,c])=>[id,{id,name:c.Name||id,parentIds:c.OwnerId&&String(c.OwnerId)!=='0'?[String(c.OwnerId)]:[],worldId:Number(c.WorldId)||0}]));
}
export function salesView(records,characters,marketCharacters,catalog,worlds,params){
  const people=new Map([...marketCharacters,...characters]);
  const all=records.map(r=>{
    const retainer=people.get(r.retainerId),ownerId=retainer?.parentIds?.[0]||'',owner=people.get(ownerId);
    return {...r,name:catalog.get(r.itemId)?.name||`アイテム #${r.itemId}`,retainerName:retainer?.name||`リテイナー ${r.retainerId}`,characterId:ownerId||`unknown:${r.retainerId}`,characterName:owner?.name||(ownerId?`キャラクター ${ownerId}`:'所有キャラクター不明'),world:worlds[r.worldId]||`World ${r.worldId}`};
  });
  const q=(params.get('q')||'').normalize('NFKC').toLocaleLowerCase('ja'),character=params.get('character')||'',retainer=params.get('retainer')||'',from=params.get('from')||'',to=params.get('to')||'';
  for(const d of [from,to])if(d&&!/^\d{4}-\d{2}-\d{2}$/.test(d))throw new Error('期間の日付が不正です。');
  if(from&&to&&from>to)throw new Error('開始日は終了日以前にしてください。');
  const options=[...new Map(all.map(r=>[r.characterId,{id:r.characterId,name:r.characterName,world:r.world}])).values()].sort((a,b)=>a.name.localeCompare(b.name,'ja')||a.world.localeCompare(b.world));
  const retainerOptions=[...new Map(all.filter(r=>!character||r.characterId===character).map(r=>[r.retainerId,{id:r.retainerId,name:character?r.retainerName:`${r.retainerName}　${r.characterName}`,world:r.world}])).values()];
  const filtered=all.filter(r=>(!character||r.characterId===character)&&(!retainer||r.retainerId===retainer)&&(!from||r.detectedAt.slice(0,10)>=from)&&(!to||r.detectedAt.slice(0,10)<=to)&&(!q||`${r.name} ${r.itemId} ${r.retainerName} ${r.characterName} ${r.world}`.normalize('NFKC').toLocaleLowerCase('ja').includes(q))).sort((a,b)=>b.detectedAt.localeCompare(a.detectedAt)||b.id-a.id);
  const groups=new Map();let gross=0,quantity=0;
  for(const r of filtered){gross+=r.gross;quantity+=r.quantity;let group=groups.get(r.characterId);if(!group){group={id:r.characterId,name:r.characterName,world:r.world,gross:0,count:0,retainers:new Map()};groups.set(r.characterId,group);}group.gross+=r.gross;group.count++;let ret=group.retainers.get(r.retainerId);if(!ret){ret={id:r.retainerId,name:r.retainerName,gross:0,count:0,quantity:0};group.retainers.set(r.retainerId,ret);}ret.gross+=r.gross;ret.count++;ret.quantity+=r.quantity;}
  const hourly=!!from&&from===to,trend=new Map();
  for(const r of filtered){const key=r.detectedAt.slice(0,hourly?13:10);const point=trend.get(key)||{date:key,gross:0,quantity:0,count:0};point.gross+=r.gross;point.quantity+=r.quantity;point.count++;trend.set(key,point);}
  const chart=[...trend.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const pages=Math.max(1,Math.ceil(filtered.length/60)),page=Math.max(1,Math.min(pages,Math.floor(Number(params.get('page')))||1));
  return {chart,chartUnit:hourly?'hour':'day',items:filtered.slice((page-1)*60,page*60),page,pages,total:filtered.length,summary:{gross,quantity,count:filtered.length},groups:[...groups.values()].map(g=>({...g,retainers:[...g.retainers.values()].sort((a,b)=>b.gross-a.gross)})).sort((a,b)=>b.gross-a.gross),characters:options,retainers:retainerOptions,range:all.length?{from:all.reduce((a,r)=>r.detectedAt<a?r.detectedAt:a,all[0].detectedAt),to:all.reduce((a,r)=>r.detectedAt>a?r.detectedAt:a,all[0].detectedAt)}:null};
}
