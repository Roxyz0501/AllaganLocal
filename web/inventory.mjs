// Independently implemented reader for the documented Allagan Tools CSV layout.
export const categories = {1:'所持品',2:'チョコボかばん',3:'プレミアムかばん',4:'リテイナー',5:'アーマリーチェスト',6:'装備中',7:'リテイナー装備',8:'FCチェスト',9:'マーケット出品中',10:'ミラージュドレッサー',11:'愛蔵品キャビネット',12:'通貨',13:'クリスタル',14:'室内調度品',15:'室内倉庫',16:'内装',17:'庭具',18:'庭具倉庫',19:'外装',99:'その他'};
export function parseCsv(text) {
  const rows=[]; let row=[], field='', quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){field+='"';i++;}else quoted=!quoted; }
    else if(c===',' && !quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw new Error('CSVの末尾が不完全です。次回の保存後に再読込してください。');
  if(field||row.length){row.push(field);rows.push(row);}
  return rows;
}
export function parseInventory(text,includeEmpty=false) {
  const result=[]; const slots=new Set();
  for(const [i,r] of parseCsv(text).entries()) {
    if(r.length!==27)throw new Error(`CSV ${i+1}行目: 対応する27列形式ではありません (${r.length}列)。`);
    for(const n of [0,1,2,3,6,20,21,22,23])if(!/^\d+$/.test(r[n]))throw new Error(`CSV ${i+1}行目: 数値が不正です。`);
    const id=Number(r[2]),quantity=Number(r[3]),flags=Number(r[6]);
    if(!Number.isSafeInteger(id)||!Number.isSafeInteger(quantity)||quantity>4294967295)throw new Error('CSV数値が範囲外です。');
    if((!id||!quantity)&&!includeEmpty)continue;
    // Owner identifiers intentionally remain strings: they exceed JS safe integers.
    const slot=`${r[23]}:${r[20]}:${r[22]}`;
    if(slots.has(slot))throw new Error(`CSV ${i+1}行目: 保管スロットが重複しています。`);
    slots.add(slot);
    const container=Number(r[20]),slotIndex=Number(r[22]);
    if(!Number.isSafeInteger(container)||!Number.isSafeInteger(slotIndex)||slotIndex>100000)throw new Error('保管スロットが範囲外です。');
    result.push({id,quantity,hq:(flags&1)!==0,collectable:(flags&8)!==0,owner:r[23],category:Number(r[21]),container,slot:slotIndex});
  }
  return result;
}
export function aggregate(records,owner='',category='') {
  const items=new Map();
  for(const r of records) {
    if(owner&&r.owner!==owner || category&&r.category!==Number(category))continue;
    let item=items.get(r.id);
    if(!item){item={id:r.id,quantity:0,nq:0,hq:0,collectable:0,locations:[]};items.set(r.id,item);}
    item.quantity+=r.quantity;
    item[r.collectable?'collectable':r.hq?'hq':'nq']+=r.quantity;
    let location=item.locations.find(x=>x.owner===r.owner&&x.category===r.category);
    if(!location){location={owner:r.owner,category:r.category,quantity:0,nq:0,hq:0,collectable:0};item.locations.push(location);}
    location.quantity+=r.quantity;
    location[r.collectable?'collectable':r.hq?'hq':'nq']+=r.quantity;
  }
  return items;
}
export function parseCharacters(text,worlds={}) {
  // Reviver source preserves 64-bit IDs in JSON numbers (Node 22+).
  const config=JSON.parse(text,(key,value,context)=>typeof value==='number'&&!Number.isSafeInteger(value)?context.source:value);
  const saved=config.SavedCharacters;
  if(!saved||typeof saved!=='object')throw new Error('SavedCharacters が見つかりません。');
  const entries=Object.entries(saved);
  const names=new Map(entries.map(([id,c])=>[id,c.AlternativeName||c.Name||c.FreeCompanyName||'']));
  const result=new Map();
  for(const [id,c] of entries){
    const isHouse=c.HouseId&&String(c.HouseId)!=='0';
    const ownerIds=[...new Set([c.OwnerId,...(c.Owners||[])].filter(x=>x&&String(x)!=='0').map(String))];
    const houseName=Number(c.PlotId)>=0?`ハウス ${Number(c.WardId)+1}区 ${Number(c.PlotId)+1}番地`:`アパルトメント ${Number(c.WardId)+1}区 · ${id.slice(-6)}`;
    const name=names.get(id)||(isHouse?houseName:`保管者 · ${id.slice(-6)}`);
    result.set(id,{id,name,retainerGilSnapshot:id.startsWith('3')&&Object.hasOwn(c,'Gil')&&Number.isSafeInteger(c.Gil)&&c.Gil>=0&&c.Gil<=4294967295?c.Gil:null,world:worlds[c.WorldId]||(c.WorldId?`World ${c.WorldId}`:''),parentNames:ownerIds.map(x=>names.get(x)).filter(Boolean),parentIds:ownerIds,type:isHouse?'ハウス':id.startsWith('3')?'リテイナー':id.startsWith('9')?'FC':'キャラクター'});
  }
  return result;
}
