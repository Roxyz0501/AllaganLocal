import net from 'node:net';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('local API: lists, favorites, persistence, filters, partial writes, and request isolation',async()=>{
  const testRoot=path.join(root,'test-results');await mkdir(testRoot,{recursive:true});const dir=await mkdtemp(path.join(testRoot,'run-'));const source=path.join(dir,'inventories.csv');
  function csv(quantity){const r=Array(27).fill('0');r[2]=5;r[3]=quantity;r[21]=1;r[23]='18014398549107457';r[25]='';r[26]='';return r.join(',');}
  await writeFile(source,csv(7));let child;
  await writeFile(path.join(dir,'catalog.json'),JSON.stringify({items:[{id:5,name:'テスト素材',sell:7,buy:50}]}));
  const salesDir=path.join(dir,'AllaganMarket');await mkdir(salesDir);const salesFile=path.join(salesDir,'SoldItems.csv');
  const sale='33776997240863917,50,5,0,7,100,0,10/03/2026 10:00:00';await writeFile(salesFile,sale);
  await writeFile(path.join(dir,'AllaganMarket.json'),'{"Characters":{"18014398549107457":{"Name":"Test Character"},"33776997240863917":{"Name":"Test Retainer","OwnerId":18014398549107457}}}');
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));const base='http://127.0.0.1:'+port;
  async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),ALLAGAN_SOURCE:source,ALLAGAN_DATA_DIR:dir,ALLAGAN_CATALOG_DIR:dir,ALLAGAN_SALES_SOURCE:salesFile},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>reject(new Error('test server exit '+code+' '+stderr)));child.stdout.once('data',resolve);});}
  async function stop(){await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
  try{
    await start();let boot=await(await fetch(base+'/api/bootstrap')).json();const headers={'Content-Type':'application/json','X-App-Token':boot.token};
    const post=(url,body,extra={})=>fetch(base+url,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
    const history=await(await fetch(base+'/api/sales')).json();assert.equal(history.summary.gross,700);assert.equal(history.items[0].characterName,'Test Character');assert.equal(history.items[0].retainerName,'Test Retainer');
    await writeFile(salesFile,'partial');await post('/api/refresh',{});const retained=await(await fetch(base+'/api/sales')).json();assert.equal(retained.total,1);assert.ok(retained.error);
    await writeFile(salesFile,sale+'\n'+sale.replace('10:00:00','11:00:00'));await post('/api/refresh',{});await post('/api/refresh',{});assert.equal((await(await fetch(base+'/api/sales')).json()).summary.gross,1400);
    let r=await(await fetch(base+'/api/items?q=5')).json();assert.equal(r.items[0].quantity,7);assert.equal(r.items[0].locations[0].nq,7);
    assert.equal((await(await fetch(base+'/api/items?view=catalog&owner=missing')).json()).total,0);
    assert.equal((await(await fetch(base+'/api/items?view=catalog&owner=missing&excludeZero=0')).json()).total,1);
    assert.equal((await fetch(base+'/data/state.json')).status,404);
    assert.equal((await fetch(base+'/api/action',{method:'POST',body:'{}'})).status,403);
    assert.equal((await post('/api/action',{action:'create-list',name:'bad'},{Origin:'https://example.com'})).status,403);
    let saved=await(await post('/api/action',{action:'create-list',name:'試験用リスト'})).json();const listId=saved.state.lists.at(-1).id;
    await post('/api/action',{action:'add-item',listId,itemId:5});await post('/api/action',{action:'add-item',listId,itemId:5});
    await post('/api/action',{action:'target',listId,itemId:5,target:12});await post('/api/action',{action:'favorite',itemId:5,enabled:true});
    assert.equal((await post('/api/action',{action:'target',listId,itemId:5,target:-1})).status,400);
    r=await(await fetch(base+`/api/items?view=list&list=${listId}`)).json();assert.equal(r.total,1);assert.equal(r.summary.shortage,5);assert.equal(r.items[0].favorite,true);
    r=await(await fetch(base+'/api/items?owner=other')).json();assert.equal(r.total,0);
    assert.equal((await(await fetch(base+`/api/items?view=list&list=${listId}&q=not-found&owner=other`)).json()).listSummary.sellTotal,49);
    const second=await(await post('/api/action',{action:'create-list',name:'独立したリスト'})).json();const secondId=second.state.lists.at(-1).id;
    await post('/api/action',{action:'add-item',listId:secondId,itemId:5});
    const fc=csv(3).split(',');fc[21]='8';fc[23]='90000000000000001';await writeFile(source,csv(7)+'\n'+fc.join(','));await post('/api/refresh',{});
    for(const direction of ['asc','desc']){
      const rows=(await(await fetch(base+'/api/items?view=inventory&group=location&sort=quantity&direction='+direction)).json()).items;
      assert.deepEqual(rows.map(x=>x.quantity),direction==='asc'?[3,7]:[7,3]);
    }
    assert.equal((await post('/api/action',{action:'exclude-location',listId,itemId:5,owner:900,category:8,excluded:true})).status,400);
    await post('/api/action',{action:'exclude-location',listId,itemId:5,owner:'90000000000000001',category:8,excluded:true});
    r=await(await fetch(base+`/api/items?view=list&list=${listId}`)).json();assert.equal(r.items[0].quantity,7);assert.equal(r.items[0].sellTotal,49);assert.equal(r.listSummary.excludedQuantity,3);assert.equal(r.items[0].listDetail.locations[1].excluded,true);
    assert.equal((await(await fetch(base+`/api/items?view=list&list=${secondId}`)).json()).listSummary.sellTotal,70);
    assert.equal((await(await fetch(base+'/api/items?q=5')).json()).items[0].quantity,10);
    assert.equal((await(await fetch(base+'/api/items?q=5&character=18014398549107457')).json()).items[0].quantity,7);
    assert.equal((await(await fetch(base+'/api/items?character=18014398549107457&retainer=90000000000000001')).json()).total,0);
    const located=await(await fetch(base+'/api/items?q=5&group=location')).json();assert.equal(located.total,2);assert.equal(located.summary.kinds,1);assert.equal(located.summary.quantity,10);assert.deepEqual(located.items.map(x=>x.quantity),[7,3]);
    const owners=await(await fetch(base+'/api/owners')).json();assert.equal(owners.owners.length,2);
    const bags=await(await fetch(base+'/api/storage?owner=18014398549107457&highlight=5')).json();assert.equal(bags.matches,1);assert.equal(bags.quantity,7);assert.equal(bags.containers[0].items[0].highlighted,true);assert.equal(bags.containers[0].items[0].slot,0);

    await post('/api/action',{action:'exclude-location',listId,itemId:5,owner:'90000000000000001',category:8,excluded:false});
    assert.equal((await(await fetch(base+`/api/items?view=list&list=${listId}`)).json()).listSummary.sellTotal,70);
    await post('/api/action',{action:'exclude-location',listId,itemId:5,owner:'90000000000000001',category:8,excluded:true});
    const market=csv(4).split(',');market[21]='9';market[23]='90000000000000002';await writeFile(source,csv(7)+'\n'+market.join(','));await post('/api/refresh',{});
    const marketView=await(await fetch(base+'/api/items?view=market&location=1')).json();assert.equal(marketView.items[0].quantity,4);assert.ok(marketView.items[0].locations.every(l=>l.category===9));
    const filteredList=await(await fetch(base+`/api/items?view=list&list=${listId}&excludeMarket=1`)).json();assert.equal(filteredList.items[0].quantity,7);assert.equal(filteredList.listSummary.sellTotal,49);
    const excluded=await(await fetch(base+'/api/items?view=catalog&excludeMarket=1&q=5')).json();assert.equal(excluded.items[0].quantity,7);assert.ok(excluded.items[0].locations.every(l=>l.category!==9));
    assert.equal((await(await fetch(base+'/api/items?view=catalog&q=5')).json()).items[0].quantity,11);
    await writeFile(source,csv(7));await post('/api/refresh',{});
    await writeFile(source,'1,2,3');await post('/api/refresh',{});r=await(await fetch(base+'/api/items?q=5')).json();assert.equal(r.items[0].quantity,7);assert.ok((await(await fetch(base+'/api/status')).json()).sourceError);
    await writeFile(source,csv(11));await post('/api/refresh',{});r=await(await fetch(base+'/api/items?q=5')).json();assert.equal(r.items[0].quantity,11);
    await stop();await start();boot=await(await fetch(base+'/api/bootstrap')).json();headers['X-App-Token']=boot.token;assert.equal(boot.state.lists.find(x=>x.id===listId).items[0].target,12);assert.ok(boot.state.favorites.includes(5));
    assert.deepEqual(boot.state.lists.find(x=>x.id===listId).items[0].excludedLocations,[{owner:'90000000000000001',category:8}]);
    await post('/api/action',{action:'remove-item',listId,itemId:5});await post('/api/action',{action:'delete-list',listId});await post('/api/action',{action:'favorite',itemId:5,enabled:false});
    const disk=JSON.parse(await readFile(path.join(dir,'state.json'),'utf8'));assert.equal(disk.lists.some(x=>x.id===listId),false);assert.equal(disk.favorites.length,0);
  }finally{if(child&&child.exitCode===null)await stop();}
});
