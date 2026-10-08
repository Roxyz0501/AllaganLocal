import {historyOrigins} from './history-origins.mjs';
import {marketValue,marketSummary} from './market-valuation.mjs';
import {createMarketPrices} from './market-prices.mjs';
import {withOwnerAssets} from './owner-assets.mjs';
import {withCashItems} from './cash-items.mjs';
import {createItemLinkCache} from './item-links.mjs';
import {visibleHistory,recordMoney,moneySummary,moneyView,japanDay,previousDay,withMoneyTotals,itemMetricLedger,listMetricLedger,characterItemLedger,scopedItems} from './ledger.mjs';
import {isCurrencyRecord,currencyRows} from './currencies.mjs';
import {createPortraitCache} from './portraits.mjs';
import {updateActivity,withActivity} from './activity.mjs';
import {ownerDirectory,storageView,splitLocations} from './storage.mjs';
import {createIconCache} from './icons.mjs';
import http from 'node:http';
import {readFile,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {parseInventory,aggregate,categories,parseCharacters} from './inventory.mjs';
import {updateCatalog} from './update-catalog.mjs';
import {valueItem,summarize,applyExclusions} from './valuation.mjs';
import {parseSoldItems,parseMarketCharacters,salesView} from './sales.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),data=process.env.ALLAGAN_DATA_DIR||path.join(root,'data');
await mkdir(data,{recursive:true});
// Seed only public catalog data on a new installation; never overwrite existing data.
if(process.env.ALLAGAN_SEED_DIR)for(const name of ['catalog.json','worlds.json']){
 try{await writeFile(path.join(data,name),await readFile(path.join(process.env.ALLAGAN_SEED_DIR,name)),{flag:'wx'});}catch(e){if(!['EEXIST','ENOENT'].includes(e.code))throw e;}
}
const getPortrait=createPortraitCache(path.join(data,'portraits'));
const getIcon=createIconCache(path.join(data,'icons'));
const getItemLink=createItemLinkCache(path.join(data,'item-links'));
const marketPrices=await createMarketPrices(path.join(data,'market-prices.json'));
const statePath=path.join(data,'state.json');
const ledgerPath=path.join(data,'money-history.json');let ledger={version:1,series:{}},ledgerError='';
try{ledger=JSON.parse(await readFile(ledgerPath,'utf8'));if(ledger.version!==1||!ledger.series)throw new Error('Invalid history');}catch(e){ledger={version:1,series:{}};if(e.code!=='ENOENT')ledgerError='金額履歴を読み込めません。元ファイルを保持し、追記を停止しています。';}
let moneyQueue=Promise.resolve(),moneyStamp='',moneyState;
function captureMoney(){const job=moneyQueue.then(captureMoneyNow);moneyQueue=job.catch(()=>{});return job;}
async function captureMoneyNow(){
 if(ledgerError||!savedSlots.length)return;
 const stamp=sourceStamp+charactersStamp+(catalog.updatedAt||'')+japanDay()+marketPrices.status().updatedAt+getPortrait.revision();if(stamp===moneyStamp&&moneyState===state)return;
 const owners=ownerDirectory(savedSlots,characters,state.owners),all=aggregate(records),observations=owners.filter(o=>['キャラクター','FC'].includes(o.type)).map(o=>({key:(o.type==='FC'?'fc:':o.type==='リテイナー'?'retainer:':'character:')+o.id,label:o.name+' @ '+o.world,value:o.type==='FC'?o.gil:o.totalGil,personal:o.gil,retainers:o.type==='FC'?null:o.retainerGil}));
 for(const o of owners.filter(o=>o.type==='リテイナー'))observations.push({key:'retainer:'+o.id,label:o.name+' / '+(o.parentNames?.join('・')||'所有者不明')+' @ '+(o.world||''),value:o.gil,personal:null,retainers:o.gil});
 for(const o of owners.filter(o=>o.type==='FC'))observations.push({key:'points:'+o.id,label:o.name+' @ '+o.world,value:o.points,personal:null,retainers:null});
 const currencyIds=new Set([1,80,...savedSlots.filter(isCurrencyRecord).map(r=>r.id)]);
 let itemCount=0,itemPrice=0,unknownItemPrices=0;
 const cashTags=new Set(state.cashItems||[]),ownerMap=new Map(owners.map(o=>[o.id,o])),marketValues=new Map();
 for(const r of records){if(currencyIds.has(r.id))continue;const key=r.owner+':'+r.id,v=marketValues.get(key)||{value:0,unknown:0};if(!cashTags.has(r.id)&&r.category!==5){const p=marketPrices.item(r.id,ownerMap.get(r.owner)?.world||''),q=p.local?.[r.hq?'hq':'nq'];if(q)v.value+=q.price*r.quantity;else if(p.marketable!==false)v.unknown+=r.quantity;}marketValues.set(key,v);}
 const marketAmount=(id,scope)=>{let value=0,unknown=0;for(const owner of scope){const v=marketValues.get(owner+':'+id);if(v){value+=v.value;unknown+=v.unknown;}}return value;};
 const marketMissing=(id,scope)=>[...scope].reduce((n,owner)=>n+(marketValues.get(owner+':'+id)?.unknown||0),0);
 const historyIds=new Set([...all.keys(),...Object.keys(ledger.series).filter(k=>k.startsWith('item:')).map(k=>Number(k.slice(5)))]);
 for(const id of historyIds){if(currencyIds.has(id))continue;const quantity=all.get(id)?.quantity||0,entry=catalogMap.get(id),price=quantity===0?0:entry?.sell==null?null:quantity*entry.sell;itemCount+=quantity;if(price==null)unknownItemPrices++;else itemPrice+=price;observations.push({key:'item:'+id,label:entry?.name||`アイテム #${id}`,value:quantity,price,cash:cashTags.has(id)?price:0,market:marketAmount(id,owners.map(o=>o.id)),marketUnknown:marketMissing(id,owners.map(o=>o.id)),personal:null,retainers:null});}
 const locationItems=new Map();for(const r of records){if(currencyIds.has(r.id))continue;const key=r.owner+':'+r.id;if(!locationItems.has(key))locationItems.set(key,new Map());const places=locationItems.get(key),l=places.get(r.category)||{owner:r.owner,category:r.category,value:0,price:0,cash:0,market:0};l.value+=r.quantity;const sell=catalogMap.get(r.id)?.sell;if(sell==null)l.price=null;else if(l.price!=null)l.price+=sell*r.quantity;if(cashTags.has(r.id))l.cash=l.price;else if(r.category!==5){const q=marketPrices.item(r.id,ownerMap.get(r.owner)?.world||'').local?.[r.hq?'hq':'nq'];if(q)l.market+=q.price*r.quantity;}places.set(r.category,l);}
 for(const owner of owners.filter(o=>o.type==='キャラクター'||o.type==='FC')){
  const ids=new Set([owner.id,...owners.filter(o=>o.type==='リテイナー'&&o.parentIds?.includes(owner.id)).map(o=>o.id)]),counts=aggregate(records.filter(r=>ids.has(r.owner)&&!currencyIds.has(r.id)));
  const prefix='item-owner:'+owner.id+':',prior=Object.keys(ledger.series).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length));
  let count=0,total=0,unknown=false;
  for(const id of new Set([...counts.keys(),...prior.filter(k=>k!=='all').map(Number)])){
   const quantity=counts.get(id)?.quantity||0,entry=catalogMap.get(id),price=quantity===0?0:entry?.sell==null?null:quantity*entry.sell;
   count+=quantity;if(price==null)unknown=true;else total+=price;
   observations.push({locations:[...ids].flatMap(owner=>[...(locationItems.get(owner+':'+id)?.values()||[])]),key:prefix+id,label:entry?.name||`アイテム #${id}`,value:quantity,price,cash:cashTags.has(id)?price:0,market:marketAmount(id,ids),marketUnknown:marketMissing(id,ids),personal:null,retainers:null});
  }
  const marketPoints=observations.filter(p=>p.key.startsWith(prefix)&&p.key!==prefix+'all'),marketTotal=marketPoints.some(p=>p.market==null)?null:marketPoints.reduce((n,p)=>n+p.market,0);
  const combined=new Map();for(const p of marketPoints)for(const l of p.locations){const k=l.owner+':'+l.category,a=combined.get(k)||{owner:l.owner,category:l.category,value:0,price:0,cash:0,market:0};for(const f of ['value','price','cash','market'])a[f]=a[f]==null||l[f]==null?null:a[f]+l[f];combined.set(k,a);}observations.push({locations:[...combined.values()],key:prefix+'all',label:'全アイテム',value:count,price:unknown?null:total,cash:marketPoints.some(p=>p.cash==null)?null:marketPoints.reduce((n,p)=>n+p.cash,0),market:marketTotal,marketUnknown:marketPoints.reduce((n,p)=>n+(p.marketUnknown||0),0),personal:null,retainers:null});
 }
 for(const o of withOwnerAssets(withCashItems(owners,records,catalogMap,state.cashItems||[]),records,catalogMap,state.cashItems||[],marketPrices)){
 if(!['キャラクター','リテイナー'].includes(o.type))continue;
 const a=o.type==='キャラクター'?o.assets.total:o.assets.personal;
 observations.push({key:'asset-summary:'+o.id,label:o.name,...a,value:a.quantity,listedStacks:o.type==='キャラクター'?o.retainerListedStacks:o.listedStacks,listedQuantity:o.type==='キャラクター'?o.retainerListedQuantity:o.listedQuantity});
 }
 observations.push({key:'all:items',label:'全アイテム',value:itemCount,price:unknownItemPrices?null:itemPrice,personal:null,retainers:null});
 const listInventory=aggregate(records);
 for(const list of state.lists){const valued=list.items.filter(i=>!currencyIds.has(i.id)).map(i=>valueItem(applyExclusions({...catalogMap.get(i.id),...i,...(listInventory.get(i.id)||{quantity:0,locations:[]})},i.excludedLocations)));const summary=summarize(valued),byOwner={},byPlace={};for(const item of valued)for(const l of item.locations||[]){if(l.excluded)continue;const placeKey=l.owner+':'+l.category+':'+item.id,z=byPlace[placeKey]||(byPlace[placeKey]={market:0,itemId:item.id,itemName:item.name||`アイテム #${item.id}`,owner:l.owner,category:l.category,quantity:0,value:0});z.quantity+=l.quantity;const mv=marketValue({...l,locations:[l]},marketPrices.item(item.id,'').region,cashTags.has(item.id),marketPrices.item(item.id,'').marketable).value;z.market+=mv;if(l.quantity&&item.sell==null)z.value=null;else if(z.value!=null)z.value+=l.quantity*(item.sell||0);const a=byOwner[l.owner]||(byOwner[l.owner]={value:0,quantity:0,market:0});a.quantity+=l.quantity;a.market+=mv;if(l.quantity&&item.sell==null)a.value=null;else if(a.value!=null)a.value+=l.quantity*(item.sell||0);}observations.push({locations:Object.values(byPlace),owners:byOwner,key:'list:'+list.id,label:list.name,quantity:summary.quantity,value:summary.unknownPrices?null:summary.sellTotal,personal:null,retainers:null});}
 moneyStamp=stamp;moneyState=state;const next=recordMoney(ledger,observations);if(next.changed){try{await writeFile(ledgerPath+'.tmp',JSON.stringify(next.ledger));await rename(ledgerPath+'.tmp',ledgerPath);ledger=next.ledger;}catch{ledgerError='金額履歴を保存できません。保存先を確認してください。';}}
}

function assetDayChanges(o){
 const day=previousDay(japanDay()),prior=ledger.series['asset-summary:'+o.id]?.days[day]?.amounts,a=o.type==='キャラクター'?o.assets?.total:o.assets?.personal;
 const legacy=ledger.series['item-owner:'+o.id+':all']?.days[day]?.amounts;
 const diff=(now,before)=>now==null||before==null?null:now-before;
 return {quantity:diff(a?.quantity,prior?.quantity??legacy?.value),cashValue:diff(a?.cashValue,prior?.cashValue??legacy?.cash),cashQuantity:diff(a?.cashQuantity,prior?.cashQuantity),marketValue:diff(a?.marketValue,prior?.marketValue??legacy?.market),marketQuantity:diff(a?.marketQuantity,prior?.marketQuantity),listedStacks:diff(o.type==='キャラクター'?o.retainerListedStacks:o.listedStacks,prior?.listedStacks),listedQuantity:diff(o.type==='キャラクター'?o.retainerListedQuantity:o.listedQuantity,prior?.listedQuantity)};
}
const activityPath=path.join(data,'activity.json');let activity={version:1,entries:{}},activityError='';
try{activity=JSON.parse(await readFile(activityPath,'utf8'));if(activity.version!==1||!activity.entries||typeof activity.entries!=='object')throw new Error('変更履歴の形式が不正です');}catch(e){activity={version:1,entries:{}};if(e.code!=='ENOENT')activityError='変更履歴を読み込めないため、古いキャラクターの判定を停止しています。';}
async function trackActivity(){if(activityError)return;const next=updateActivity(activity,savedSlots,undefined,[...characters.keys()]);if(next.changed){try{await writeFile(activityPath+'.tmp',JSON.stringify(next.state));await rename(activityPath+'.tmp',activityPath);activity=next.state;}catch{activityError='変更日時を保存できないため、古いキャラクターの判定を停止しています。';}}}

const defaultSource=process.env.ALLAGAN_SOURCE||path.join(process.env.APPDATA||'','XIVLauncher','pluginConfigs','InventoryTools','inventories.csv');
let state;
try{state=JSON.parse(await readFile(statePath,'utf8'));if(!Array.isArray(state.lists)||!Array.isArray(state.favorites))throw new Error('保存形式が不正です');}
catch(e){if(e.code!=='ENOENT')throw new Error(`state.jsonを読み込めません。元ファイルを保持しました: ${e.message}`);state={source:defaultSource,lists:[{id:randomUUID(),name:'マイリスト',items:[]}],favorites:[],owners:{}};}
let catalog={items:[]},catalogMap=new Map(),records=[],savedSlots=[],sourceStamp='',sourceUpdated=null,sourceError='',lastRead=null;
let catalogJob={running:false,message:''},refreshing=false;
let characters=new Map(),charactersStamp='',charactersError='',worlds={};
try{worlds=JSON.parse(await readFile(path.join(process.env.ALLAGAN_CATALOG_DIR||data,'worlds.json'),'utf8'));}catch{}
const token=randomUUID();const port=Number(process.env.PORT||47831);
let salesRecords=[],salesStamp='',salesUpdated=null,salesError='',marketCharacters=new Map(),marketStamp='',marketError='';
function salesPath(){return process.env.ALLAGAN_SALES_SOURCE||path.join(path.dirname(path.dirname(state.source)),'AllaganMarket','SoldItems.csv');}
async function refreshSales(){
 for(let attempt=0;attempt<3;attempt++){
  try{
    const file=salesPath(),before=await stat(file),stamp=`${file}:${before.mtimeMs}:${before.size}`;
    if(stamp!==salesStamp){if(before.size>100*1024*1024)throw new Error('販売履歴が100MBを超えています。');const text=await readFile(file,'utf8'),after=await stat(file);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw new Error('販売履歴の保存中です。次回読込を待っています。');const next=parseSoldItems(text);if(!next.length&&salesRecords.length)throw new Error('販売履歴が空になったため、最後の読込結果を保持しています。');salesRecords=next;salesStamp=stamp;salesUpdated=after.mtime.toISOString();}salesError='';break;
  }catch(e){salesError=e.code==='ENOENT'?'AllaganMarketのSoldItems.csvが見つかりません。Allagan Tools単独では販売履歴を取得できません。':e.message;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,200));}
 }
  try{const file=path.join(path.dirname(path.dirname(salesPath())),'AllaganMarket.json'),info=await stat(file),stamp=`${file}:${info.mtimeMs}:${info.size}`;if(stamp!==marketStamp){if(info.size>100*1024*1024)throw new Error('売上設定が大きすぎます。');marketCharacters=parseMarketCharacters(await readFile(file,'utf8'));marketStamp=stamp;}marketError='';}catch(e){marketError='AllaganMarketの名前設定を読み込めません。Allagan Toolsの名前情報を使用しています。';}
}
async function loadCharacters(){
  const configPath=path.join(path.dirname(path.dirname(state.source)),path.basename(path.dirname(state.source))+'.json');
  try{const info=await stat(configPath);const stamp=`${configPath}:${info.mtimeMs}:${info.size}`;if(stamp===charactersStamp){charactersError='';return;}if(info.size>100*1024*1024)throw new Error('設定ファイルが100MBを超えています。');const next=parseCharacters(await readFile(configPath,'utf8'),worlds);characters=next;charactersStamp=stamp;charactersError='';}
  catch(e){charactersError=e.code==='ENOENT'?'キャラクター設定が見つからないため、保管者IDで表示しています。':`保管者名の読込: ${e.message}`;}
}
async function loadCatalog(){try{catalog=JSON.parse(await readFile(path.join(process.env.ALLAGAN_CATALOG_DIR||data,'catalog.json'),'utf8'));catalogMap=new Map(catalog.items.map(x=>[x.id,x]));}catch(e){if(e.code!=='ENOENT')console.error('Catalog:',e.message);}}
async function refresh(force=false){
  if(refreshing)return;refreshing=true;
  try{
    await loadCharacters();
    await refreshSales();
    const before=await stat(state.source);const stamp=`${state.source}:${before.mtimeMs}:${before.size}`;
    if(!force&&stamp===sourceStamp){sourceError='';await captureMoney();return;}
    if(before.size>100*1024*1024)throw new Error('CSVが100MBを超えています。');
    const text=await readFile(state.source,'utf8');const after=await stat(state.source);
    if(before.mtimeMs!==after.mtimeMs||before.size!==after.size)throw new Error('Allagan Toolsが保存中です。次回の読込を待っています。');
    const snapshot=parseInventory(text,true),next=snapshot.filter(r=>r.id&&r.quantity);if(!next.length)throw new Error('保存データが空です。最後に読み込めた内容を表示します。');
    records=next;savedSlots=snapshot;sourceStamp=stamp;sourceUpdated=after.mtime.toISOString();lastRead=new Date().toISOString();sourceError='';await trackActivity();await captureMoney();
  }catch(e){sourceError=e.code==='ENOENT'?'保存ファイルが見つかりません。接続設定を確認してください。':e.message;}
  finally{refreshing=false;}
}
await loadCatalog();await refresh();await getPortrait.ready;
let timer;function scheduleRefresh(){clearInterval(timer);timer=setInterval(()=>refresh(),(state.refreshSeconds||60)*1000);timer.unref();}scheduleRefresh();
async function persist(next){await writeFile(statePath+'.tmp',JSON.stringify(next,null,2));await rename(statePath+'.tmp',statePath);state=next;}
let directoryCache;
function directory(){if(!directoryCache||directoryCache.slots!==savedSlots||directoryCache.chars!==characters||directoryCache.aliases!==state.owners)directoryCache={slots:savedSlots,chars:characters,aliases:state.owners,value:ownerDirectory(savedSlots,characters,state.owners)};return directoryCache.value;}
function excludedGilKeys(params){
 const manual=new Set([...(state.excludedCharacters||[]),...(params.get('excludedCharacters')||'').split(',')].filter(id=>/^\d+$/.test(id)));
 const owners=withActivity(directory(),activityError?{entries:{}}:activity),excluded=new Set(owners.filter(o=>o.type==='キャラクター'&&(manual.has(o.id)||o.stale||getPortrait.status(o).excluded)).map(o=>o.id));
 return new Set([...excluded].map(id=>'character:'+id).concat(owners.filter(o=>o.type==='リテイナー'&&o.parentIds?.some(id=>excluded.has(id))).map(o=>'retainer:'+o.id)));
}
let lodestoneJob={running:false,done:0,total:0};
async function refreshLodestone(){if(lodestoneJob.running)return;const owners=directory().filter(o=>['キャラクター','FC'].includes(o.type));lodestoneJob={running:true,done:0,total:owners.length};let index=0;try{await Promise.all(Array.from({length:2},async()=>{while(index<owners.length){const o=owners[index++];try{await getPortrait(o,true);}finally{lodestoneJob.done++;}}}));await captureMoney();}finally{lodestoneJob.running=false;}}
function status(){return {refreshSeconds:state.refreshSeconds||60,lodestone:lodestoneJob,market:marketPrices.status(),source:state.source,sourceUpdated,lastRead,sourceError,charactersError,charactersStamp:charactersStamp+':portraits:'+getPortrait.revision()+':market:'+marketPrices.status().revision,records:records.length,owners:[...new Set(records.map(x=>x.owner))].map(id=>({id,...characters.get(id),name:state.owners[id]||characters.get(id)?.name||`保管者 · ${id.slice(-6)}`})),categories,catalogItems:catalog.items.length,catalogUpdated:catalog.updatedAt||null,catalogJob};}
function send(res,code,body){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>1024*1024)throw new Error('リクエストが大きすぎます');parts.push(chunk);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
function validName(value){if(typeof value!=='string'||!value.trim()||value.trim().length>80)throw new Error('名前は1〜80文字で入力してください。');return value.trim();}
let mutation=Promise.resolve();
async function action(input){
  const next=structuredClone(state);const list=next.lists.find(x=>x.id===input.listId);const id=Number(input.itemId);
  if(['cash-item','favorite','add-item','target','remove-item','exclude-location'].includes(input.action)&&(!Number.isSafeInteger(id)||id<=0))throw new Error('アイテムIDが不正です。');
  if(['list-pricing','rename-list','delete-list','add-item','target','remove-item','exclude-location'].includes(input.action)&&!list)throw new Error('リストが見つかりません。');
  switch(input.action){
    case 'refresh-interval':if(![10,30,60,120,300,600].includes(input.seconds))throw new Error('更新間隔が不正です。');next.refreshSeconds=input.seconds;break;
    case 'create-list': if(next.lists.length>=100)throw new Error('リストは100件までです。');next.lists.push({id:randomUUID(),name:validName(input.name),items:[]});break;
    case 'list-pricing':if(!['npc','market'].includes(input.pricing))throw new Error('参照価格が不正です。');list.pricing=input.pricing;break;
    case 'rename-list':list.name=validName(input.name);break;
    case 'delete-list':next.lists=next.lists.filter(x=>x.id!==input.listId);break;
    case 'excluded-characters':if(!Array.isArray(input.ids)||input.ids.some(id=>typeof id!=='string'||!/^\d+$/.test(id)))throw new Error('除外設定が不正です。');next.excludedCharacters=[...new Set(input.ids)];break;
    case 'cash-item': if(typeof input.enabled!=='boolean'||!catalogMap.has(id))throw new Error('換金アイテムの指定が不正です。');next.cashItems=input.enabled?[...new Set([...(next.cashItems||[]),id])]:(next.cashItems||[]).filter(x=>x!==id);break;
    case 'favorite':next.favorites=input.enabled?[...new Set([...next.favorites,id])]:next.favorites.filter(x=>x!==id);break;
    case 'add-item':if(!catalogMap.has(id)&&!records.some(r=>r.id===id))throw new Error('アイテムが見つかりません。');if(!list.items.some(x=>x.id===id))list.items.push({id,target:1});break;
    case 'remove-item':list.items=list.items.filter(x=>x.id!==id);break;
    case 'exclude-location':{
      const item=list.items.find(x=>x.id===id),owner=input.owner,category=input.category;
      if(!item)throw new Error('リスト内にアイテムがありません。');
      if(typeof owner!=='string'||!/^\d+$/.test(owner)||!Number.isInteger(category)||!categories[category]||typeof input.excluded!=='boolean')throw new Error('保管先の指定が不正です。');
      const exclusions=item.excludedLocations||[];
      const exists=exclusions.some(x=>x.owner===owner&&x.category===category);
      if(!exists&&!records.some(r=>r.id===id&&r.owner===owner&&r.category===category))throw new Error('このアイテムの保管先が見つかりません。');
      item.excludedLocations=exclusions.filter(x=>x.owner!==owner||x.category!==category);
      if(input.excluded)item.excludedLocations.push({owner,category});break;
    }
    case 'target':{const target=Number(input.target);if(!Number.isSafeInteger(target)||target<0||target>999999999)throw new Error('目標数は0〜999999999で入力してください。');const item=list.items.find(x=>x.id===id);if(!item)throw new Error('リスト内にアイテムがありません。');item.target=target;break;}
    case 'source':{if(typeof input.path!=='string'||!path.isAbsolute(input.path)||path.basename(input.path).toLowerCase()!=='inventories.csv')throw new Error('inventories.csvの絶対パスを指定してください。');const info=await stat(input.path);if(info.size>100*1024*1024)throw new Error('ファイルが大きすぎます。');parseInventory(await readFile(input.path,'utf8'));next.source=input.path;break;}
    case 'owner-name':if(!records.some(x=>x.owner===input.owner))throw new Error('保管者が見つかりません。');next.owners[input.owner]=validName(input.name);break;
    default:throw new Error('未対応の操作です。');
  }
  await persist(next);if(input.action==='refresh-interval')scheduleRefresh();await captureMoney();if(input.action==='source')await refresh(true);return state;
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const hosts=[`127.0.0.1:${port}`,`localhost:${port}`];
  if(!hosts.includes(req.headers.host)){send(res,403,{error:'接続先が不正です。'});return;}
  if(req.headers.origin&&!hosts.some(h=>req.headers.origin===`http://${h}`)){send(res,403,{error:'他のサイトからは操作できません。'});return;}
  try{
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    const omitted=new Set([...excludedGilKeys(url.searchParams)].map(key=>key.split(':')[1]));const activeRecords=records.filter(r=>!omitted.has(r.owner));
    if(req.method==='GET'&&/^\/api\/item-link\/\d+$/.test(url.pathname)){
      const id=Number(url.pathname.split('/').at(-1)),item=catalogMap.get(id);if(!item)return send(res,404,{error:'アイテムが見つかりません。'});
      try{const target=await getItemLink(id,item.name);res.writeHead(302,{Location:target,'Cache-Control':'no-store'});return res.end();}catch(error){res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});return res.end(error.message);}
    }
    if(req.method==='GET'&&/^\/api\/character-link\/\d+$/.test(url.pathname)){const owner=characters.get(url.pathname.split('/').at(-1));if(!owner||owner.type!=='キャラクター')return send(res,404,{error:'キャラクターが見つかりません。'});try{const target=await getPortrait.profile(owner);res.writeHead(302,{Location:target,'Cache-Control':'no-store'});return res.end();}catch(error){res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});return res.end(error.message);}}
    if(req.method==='GET'&&/^\/api\/avatar\/\d+$/.test(url.pathname)){
      const owner=characters.get(url.pathname.split('/').at(-1));if(!owner)return send(res,404,{error:'キャラクターが見つかりません。'});
      const portrait=await getPortrait(owner);res.writeHead(200,{'Content-Type':portrait.type,'Cache-Control':portrait.type==='image/jpeg'?'private, max-age=86400':'private, max-age=300'});return res.end(portrait.bytes);
    }
    if(req.method==='GET'&&/^\/api\/icon\/\d+$/.test(url.pathname)){
      const id=Number(url.pathname.split('/').at(-1));
      if(!catalogMap.has(id)&&!records.some(r=>r.id===id)&&!salesRecords.some(r=>r.itemId===id))return send(res,404,{error:'アイテムが見つかりません。'});
      const icon=await getIcon(id);res.writeHead(200,{'Content-Type':icon.type,'Cache-Control':icon.type==='image/png'?'private, max-age=604800':'no-store'});return res.end(icon.bytes);
    }
    if(req.method==='GET'&&url.pathname==='/migration-settings.js'){
      if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')return send(res,403,{error:'同じサイトから開いてください。'});
      let settings={};try{settings=JSON.parse(await readFile(path.join(data,'browser-settings.json'),'utf8'));}catch{}
      if(!settings||typeof settings!=='object'||Array.isArray(settings))settings={};
      settings=Object.fromEntries(Object.entries(settings).filter(([key,value])=>typeof value==='string'&&(key.startsWith('allagan.')||['characterSort','characterSortDirection','characterManualOrder','ownerDirectoryLayout'].includes(key))));
      res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin'});
      return res.end('(()=>{try{const settings='+JSON.stringify(settings)+';for(const [key,value] of Object.entries(settings)){if(localStorage.getItem(key)===null)localStorage.setItem(key,value);}}catch{}})();');
    }
    if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{app:'allagan-local',version:'1.0.0'});
    if(req.method==='GET'&&url.pathname==='/api/bootstrap')return send(res,200,{token,state,status:status()});
    if(req.method==='GET'&&url.pathname==='/api/status')return send(res,200,status());
    if(req.method==='GET'&&url.pathname==='/api/money-history'){const day=url.searchParams.get('day')||japanDay();if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day)))return send(res,400,{error:'日付が不正です。'});const selectedKey=url.searchParams.get('key')||'all:gil',itemScope=selectedKey.startsWith('item:')||selectedKey==='all:items';const totals=itemScope?itemMetricLedger(scopedItems(ledger,url.searchParams.get('character'),omitted,selectedKey),url.searchParams.get('metric')):withMoneyTotals(selectedKey.startsWith('list:')||selectedKey==='all:lists'?listMetricLedger(visibleHistory(ledger,excludedGilKeys(url.searchParams),new Map(state.lists.map(l=>['list:'+l.id,url.searchParams.get('metric')==='market'?'market':url.searchParams.get('metric')==='price'?'npc':l.pricing||'npc']))),url.searchParams.get('metric')):visibleHistory(ledger,excludedGilKeys(url.searchParams)),excludedGilKeys(url.searchParams));return send(res,200,{...historyOrigins(moneyView(totals,selectedKey,day,url.searchParams.get('from')||'',url.searchParams.get('to')||''),ledger,directory(),omitted,selectedKey,url.searchParams.get('metric')||'count',url.searchParams.get('character')||'',new Map(state.lists.map(l=>['list:'+l.id,url.searchParams.get('metric')==='market'?'market':url.searchParams.get('metric')==='price'?'npc':l.pricing||'npc']))),pricing:url.searchParams.get('metric')==='market'?'market':url.searchParams.get('metric')==='price'?'npc':state.lists.find(l=>'list:'+l.id===selectedKey)?.pricing||'npc',characters:directory().filter(o=>o.type==='キャラクター'&&!omitted.has(o.id)).map(o=>({id:o.id,name:o.name,world:o.world})),entities:Object.entries(totals.series).filter(([key])=>!itemScope||key===selectedKey).filter(([key])=>(key.startsWith('item:')||key==='all:items')===itemScope).map(([key,s])=>({key,label:s.label})).concat(itemScope&&!totals.series[selectedKey]?[{key:selectedKey,label:catalogMap.get(Number(selectedKey.slice(5)))?.name||'未記録のアイテム'}]:[]),today:japanDay(),error:ledgerError});}
    if(req.method==='GET'&&url.pathname==='/api/owners')return send(res,200,{owners:withActivity(withOwnerAssets(withCashItems(directory(),records,catalogMap,state.cashItems||[]),records,catalogMap,state.cashItems||[],marketPrices),activityError?{entries:{}}:activity).map(o=>({...o,assetDayChanges:assetDayChanges(o),portraitStatus:o.type==='キャラクター'?getPortrait.status(o):null,pointChange:moneySummary(ledger,'points:'+o.id).change,dayChange:moneySummary(ledger,(o.type==='FC'?'fc:':o.type==='リテイナー'?'retainer:':'character:')+o.id).change})),updatedAt:sourceUpdated,activityWarning:activityError});
    if(req.method==='GET'&&url.pathname==='/api/storage'){
 const owners=directory(),view=storageView(savedSlots.filter(r=>!omitted.has(r.owner)),owners,catalogMap,url.searchParams),byId=new Map(owners.map(o=>[o.id,o]));
 for(const c of view.containers)for(const r of c.items){r.sell=catalogMap.get(r.id)?.sell??null;r.buy=catalogMap.get(r.id)?.buy??null;r.market=marketPrices.item(r.id,byId.get(c.owner)?.world||'');r.cashItem=(state.cashItems||[]).includes(r.id);}
 return send(res,200,{...view,updatedAt:sourceUpdated});
}
    if(req.method==='GET'&&url.pathname==='/api/sales')return send(res,200,{...salesView(salesRecords.filter(r=>!omitted.has(r.retainerId)&&!(marketCharacters.get(r.retainerId)?.parentIds||[]).some(id=>omitted.has(id))),characters,marketCharacters,catalogMap,worlds,url.searchParams),source:salesPath(),updatedAt:salesUpdated,error:salesError,nameWarning:marketError});
    if(req.method==='GET'&&url.pathname==='/api/currencies'){
      const p=url.searchParams,owner=p.get('owner')||'',q=(p.get('q')||'').normalize('NFKC').toLocaleLowerCase('ja');
      const rows=currencyRows(savedSlots.filter(r=>!omitted.has(r.owner)),directory(),catalogMap).filter(r=>(!owner||r.owner===owner)&&(!q||(r.name+' '+r.ownerName+' '+r.world).normalize('NFKC').toLocaleLowerCase('ja').includes(q)||String(r.id)===q));
      const pages=Math.max(1,Math.ceil(rows.length/60)),page=Math.max(1,Math.min(pages,Math.floor(Number(p.get('page')))||1));
      return send(res,200,{items:rows.slice((page-1)*60,page*60),page,pages,total:rows.length,owners:directory(),updatedAt:sourceUpdated});
    }
    if(req.method==='GET'&&url.pathname==='/api/items'){
      const p=url.searchParams,view=p.get('view')||'inventory',list=state.lists.find(x=>x.id===p.get('list'));
      const currencyIds=new Set([1,80,...savedSlots.filter(isCurrencyRecord).map(r=>r.id)]);
      const itemRecords=activeRecords.filter(r=>!currencyIds.has(r.id)&&!(['catalog','inventory'].includes(view)&&p.get('excludeArmoury')==='1'&&r.category===5)&&(view==='market'?r.category===9:!(['catalog','list'].includes(view)&&p.get('excludeMarket')==='1'&&r.category===9)));
      const character=p.get('character')||'',retainer=p.get('retainer')||'';const allowed=new Set(directory().filter(o=>!character||o.id===character||o.parentIds?.includes(character)).map(o=>o.id));
      const scoped=itemRecords.filter(r=>allowed.has(r.owner)&&(!retainer||r.owner===retainer));
      const totals=aggregate(scoped,p.get('owner')||'',view==='market'?'9':p.get('location')||'');
      const ids=view==='catalog'?new Set([...catalogMap.keys(),...totals.keys()]):view==='favorites'?state.favorites:view==='list'?(list?.items.map(x=>x.id)||[]):[...totals.keys()];
      const q=(p.get('q')||'').normalize('NFKC').toLocaleLowerCase('ja').trim();
      let items=[...ids].filter(id=>!currencyIds.has(id)).map(id=>({...catalogMap.get(id),id,...(totals.get(id)||{quantity:0,nq:0,hq:0,collectable:0,locations:[]}),name:catalogMap.get(id)?.name||`アイテム #${id}`,favorite:state.favorites.includes(id),target:list?.items.find(x=>x.id===id)?.target??null}));
      if(view==='list'&&list)items=items.map(x=>applyExclusions(x,list.items.find(i=>i.id===x.id)?.excludedLocations));
      if(view==='catalog'&&p.get('excludeZero')!=='0')items=items.filter(x=>x.quantity>0);
      items=items.map(valueItem);
      let listSummary=null;
      if(view==='list'&&list){
        const all=aggregate(itemRecords);
        const complete=list.items.filter(x=>!currencyIds.has(x.id)).map(x=>valueItem(applyExclusions({...catalogMap.get(x.id),...x,...(all.get(x.id)||{quantity:0,locations:[]}),name:catalogMap.get(x.id)?.name||`アイテム #${x.id}`},x.excludedLocations)));
        listSummary={...summarize(complete),market:marketSummary(complete,marketPrices,state.cashItems||[]),pricing:list.pricing||'npc'};const details=new Map(complete.map(x=>[x.id,x]));items=items.map(x=>({...x,listDetail:details.get(x.id)}));
      }
      if(q)items=items.filter(x=>x.name.normalize('NFKC').toLocaleLowerCase('ja').includes(q)||String(x.id)===q);
      const summary={...summarize(items),market:marketSummary(items,marketPrices,state.cashItems||[])};
      if(p.get('group')==='location')items=splitLocations(items);
      const sort=p.get('sort')||'name',direction=p.get('direction')==='desc'?-1:1;
 const marketSort=new Map();if(sort==='market')for(const i of items){const m=marketPrices.item(i.id,''),quotes=[m.region?.nq?.price,m.region?.hq?.price].filter(Number.isFinite);marketSort.set(i.id,quotes.length?Math.min(...quotes):null);}
 items.sort((a,b)=>{const av=sort==='quantity'?a.quantity:sort==='sell'?a.sell:sort==='buy'?a.buy:marketSort.get(a.id),bv=sort==='quantity'?b.quantity:sort==='sell'?b.sell:sort==='buy'?b.buy:marketSort.get(b.id);if(sort!=='name'){if(av==null||bv==null)return av==null?(bv==null?a.id-b.id:1):-1;return direction*(av-bv)||a.id-b.id;}return direction*a.name.localeCompare(b.name,'ja')||a.id-b.id;});
      if(p.get('group')==='category')items.sort((a,b)=>(a.category||'').localeCompare(b.category||'','ja'));
      const total=items.length, page=Math.max(1,Math.min(Number(p.get('page'))||1,Math.max(1,Math.ceil(total/60))));
      return send(res,200,{items:items.slice((page-1)*60,page*60).map(item=>{const locations=item.locations||[],names=[...new Set(locations.map(l=>characters.get(l.owner)?.world).filter(Boolean))];const price=marketPrices.item(item.id,''),tagged=(state.cashItems||[]).includes(item.id);return {...item,market:{region:price.region,total:marketValue(item,price.region,tagged,price.marketable),worlds:names.map(world=>{const p=marketPrices.item(item.id,world);return {...p,total:marketValue(item,p.local,tagged,p.marketable)};})}};}),page,pages:Math.max(1,Math.ceil(total/60)),total,summary,listSummary,listDayChange:list?moneySummary(visibleHistory(ledger,excludedGilKeys(url.searchParams)),'list:'+list.id).change:null});
    }
    if(req.method==='POST'){
      if(req.headers['x-app-token']!==token)return send(res,403,{error:'ページを再読み込みしてください。'});
      if(url.pathname==='/api/action'){const input=await body(req);const job=mutation.then(()=>action(input));mutation=job.catch(()=>{});return send(res,200,{state:await job,status:status()});}
      if(url.pathname==='/api/market-items'){const input=await body(req);let selected;if(input.itemId){const id=Number(input.itemId);if(!catalogMap.has(id))throw new Error('アイテムが見つかりません。');selected=activeRecords.filter(r=>r.id===id);const names=[...new Set(selected.map(r=>characters.get(r.owner)?.world).filter(Boolean))];const result=await marketPrices.updateItems([id],names,worlds);await captureMoney();return send(res,200,result);}if(!characters.has(input.owner)||!Array.isArray(input.categories)||input.categories.some(c=>!Number.isInteger(c)))throw new Error('保管先の指定が不正です。');selected=activeRecords.filter(r=>r.owner===input.owner&&input.categories.includes(r.category));const result=await marketPrices.updateItems(selected.map(r=>r.id),[characters.get(input.owner).world],worlds);await captureMoney();return send(res,200,result);}
      if(url.pathname==='/api/market-update'){marketPrices.start(catalogMap,records,directory(),worlds);return send(res,202,marketPrices.status());}
      if(url.pathname==='/api/refresh'){await refresh(true);return send(res,200,status());}
      if(url.pathname==='/api/lodestone-refresh'){refreshLodestone().catch(()=>{});return send(res,202,status());}
      if(url.pathname==='/api/catalog'){
        if(!catalogJob.running){catalogJob={running:true,message:'アイテム辞書を更新しています'};updateCatalog(message=>{catalogJob.message=message;}).then(loadCatalog).then(()=>{catalogJob.running=false;}).catch(e=>{catalogJob={running:false,message:`更新失敗: ${e.message}`};});}
        return send(res,202,catalogJob);
      }
    }
    const assets={'/i18n.js':'i18n.js',...Object.fromEntries(['ja','en','de','fr','ko','zh-Hans','zh-Hant'].map(l=>['/locales/'+l+'.json','locales/'+l+'.json'])),'/':'index.html','/theme.js':'theme.js','/app.js':'app.js','/sales.js':'sales.js','/storage.js':'storage.js','/images.js':'images.js','/currencies.js':'currencies.js','/money.js':'money.js','/style.css':'style.css','/favicon.svg':'favicon.svg'};
    if(req.method==='GET'&&assets[url.pathname]){
      const file=assets[url.pathname],types={json:'application/json',html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml'};
      res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)]+'; charset=utf-8','Cache-Control':'no-cache'});res.end(await readFile(path.join(root,'public',file)));return;
    }
    send(res,404,{error:'見つかりません。'});
  }catch(e){send(res,400,{error:e.message});}
});
let checkingPortraits=false;async function retryPortraits(){if(checkingPortraits)return;checkingPortraits=true;try{for(const owner of characters.values()){const status=getPortrait.status(owner);if(owner.type==='キャラクター'&&status.excluded&&!status.stopped&&status.nextRetry<=Date.now())await getPortrait(owner);}}finally{checkingPortraits=false;}}
const portraitTimer=setInterval(()=>retryPortraits().catch(()=>{}),60000);portraitTimer.unref();retryPortraits().catch(()=>{});
server.listen(port,'127.0.0.1',()=>console.log(`Allagan Local: http://127.0.0.1:${port}`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'このポートは使用中です。既に起動していないか確認してください。':e.message);process.exitCode=1;});
