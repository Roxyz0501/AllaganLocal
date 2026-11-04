import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {recordMoney,japanDay,previousDay} from '../ledger.mjs';

test('list dashboard uses the selected historical price; exports detect exclusion changes; invalid dates reject before reading',async()=>{
 const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dir=await mkdtemp(path.resolve('artifacts/history-api-'));
 const inventory=path.join(dir,'InventoryTools');await mkdir(inventory);
 const owner='18014398549107457',source=path.join(inventory,'inventories.csv'),day=japanDay(),yesterday=previousDay(day);
 const row=Array(27).fill('0');row[2]='5';row[3]='7';row[20]='0';row[21]='1';row[23]=owner;row[25]=row[26]='';await writeFile(source,row.join(','));
 await writeFile(path.join(dir,'InventoryTools.json'),JSON.stringify({SavedCharacters:{[owner]:{Name:'Synthetic Character',WorldId:50}}}));
 await writeFile(path.join(dir,'worlds.json'),'{"50":"Typhon"}');
 await writeFile(path.join(dir,'catalog.json'),JSON.stringify({items:[{id:5,name:'Synthetic Item',sell:7,buy:50}]}));
 await writeFile(path.join(dir,'state.json'),JSON.stringify({source,lists:[{id:'prices',name:'Prices',pricing:'market',items:[{id:5}]}],favorites:[],owners:{}}));
 const prior=recordMoney({series:{}},[{key:'list:prices',label:'Prices',value:14,quantity:2,owners:{[owner]:{value:14,quantity:2,market:200}}}],new Date(yesterday+'T12:00:00+09:00')).ledger;
 await writeFile(path.join(dir,'money-history.json'),JSON.stringify(prior));
 await writeFile(path.join(dir,'market-prices.json'),JSON.stringify({marketable:[5],updatedAt:day+'T00:00:00Z',items:{5:{worlds:{},region:{nq:{price:100,world:'Typhon'},hq:null}}}}));
 const sales=path.join(dir,'sales.csv');await writeFile(sales,'');
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const base='http://127.0.0.1:'+port,child=spawn(process.execPath,['server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),ALLAGAN_DATA_DIR:dir,ALLAGAN_CATALOG_DIR:dir,ALLAGAN_SOURCE:source,ALLAGAN_SALES_SOURCE:sales,ALLAGAN_PURCHASE_SOURCE:path.join(dir,'missing.db')},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',b=>errors+=b);
 try{
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>reject(Error('server '+code+' '+errors)));child.stdout.once('data',resolve);});
  const json=async route=>{const response=await fetch(base+route);assert.equal(response.status,200);return response.json();};
  const boot=await json('/api/bootstrap');const action=async body=>{const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token},body:JSON.stringify(body)});assert.equal(r.status,200);};
  const list=await json('/api/items?view=list&list=prices');const trend=await json('/api/money-history?key=list:prices&metric=list&day='+day);
  assert.equal(list.listSummary.market.value,700);assert.equal(trend.change,500);assert.equal(list.listDayChange,trend.change);
  await action({action:'list-pricing',listId:'prices',pricing:'npc'});assert.equal((await json('/api/items?view=list&list=prices')).listDayChange,35);
  const routes=['/api/items','/api/storage-csv?owner='+owner,'/api/currencies','/api/sales'];
  const before=await Promise.all(routes.map(json));
  for(const result of before)assert.equal(typeof result.revision,'string');
  const unchanged=await Promise.all(routes.map(json));assert.deepEqual(unchanged.map(r=>r.revision),before.map(r=>r.revision));
  await action({action:'excluded-characters',ids:[owner]});
  const after=await Promise.all(routes.map(json));after.forEach((r,i)=>assert.notEqual(r.revision,before[i].revision));
  assert.equal((await json('/api/items?view=list&list=prices')).listDayChange,0);
  await action({action:'excluded-characters',ids:[]});assert.equal((await json('/api/items?view=list&list=prices')).listDayChange,35);
  for(const query of ['day=bad','day=2026-02-30','from=bad','from=2026-10-10&to=2026-10-01'])assert.equal((await fetch(base+'/api/money-history?'+query)).status,400,query);
 }finally{
  if(child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));const key=await readFile(path.join(dir,'server-control.key'),'utf8');await fetch(base+'/api/host-stop',{method:'POST',headers:{'X-Allagan-Control':key}});await exited;}
 }
});
