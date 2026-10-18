import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {mkdtemp,rm,stat} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {PurchaseStore,purchaseFilter} from '../purchases.mjs';import {createPurchaseService} from '../purchases-service.mjs';
export function purchaseFixture(file){
 const db=new DatabaseSync(file);db.exec(`PRAGMA journal_mode=WAL;PRAGMA user_version=2;CREATE TABLE characters(cid TEXT PRIMARY KEY,name TEXT,home TEXT);CREATE TABLE purchases(id TEXT PRIMARY KEY,time INTEGER,cid TEXT,character TEXT,home TEXT,world TEXT,item INTEGER,name TEXT,hq INTEGER,quantity INTEGER,unit INTEGER,tax INTEGER,subtotal INTEGER,total INTEGER,listing TEXT,retainer TEXT,seller TEXT,city INTEGER,source INTEGER,tax_known INTEGER);CREATE INDEX purchase_date ON purchases(time DESC,id DESC);CREATE INDEX purchase_character_date ON purchases(cid,time DESC,id DESC);`);
 db.prepare('INSERT INTO characters VALUES(?,?,?)').run('18014398555948547','A','Typhon');db.prepare('INSERT INTO characters VALUES(?,?,?)').run('18014398555948548','B','Atomos');
 const insert=(id,source=0,cid='18014398555948547',time=Date.parse('2026-10-18T14:59:59Z')/1000)=>db.prepare('INSERT INTO purchases VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(String(id),time,cid,cid.endsWith('7')?'A':'B','Typhon','Typhon',source<2?5:0,source<2?'素材':'',1,source<2?2:0,source<2?100:0,source===0?10:0,source<2?200:0,source<2?200+(source===0?10:0):300,'l'+id,'33776997240863917','=seller',1,source,source<2?1:0);
 return {db,insert};
}
test('read-only purchase filters, JST boundaries, unknown tax and paged cache invalidation',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'purchase-test-')),file=path.join(dir,'ledger.db');const {db,insert}=purchaseFixture(file);const s=new PurchaseStore(file);
 try{
  for(let i=0;i<105;i++)insert(i);insert(200,1);insert(201,2);insert(202,3);insert(203,0,'18014398555948548');insert(204,0,'18014398555948547',Date.parse('2026-10-18T15:00:00Z')/1000);
  const before=await stat(file),q=s.query({from:'2026-10-18',to:'2026-10-18'});assert.equal(q.data.summary.count,107);assert.equal(q.data.items.length,100);assert.equal(q.data.chart.length,1);assert(q.data.items.some(r=>r.cid==='18014398555948548'));
  assert.equal(s.metrics.reads,6);s.query({from:'2026-10-18',to:'2026-10-18'});assert.equal(s.metrics.reads,6);
  assert.equal(s.query({from:'2026-10-18',to:'2026-10-18'},[],q.etag).notModified,true);assert.equal(s.metrics.reads,6);
  s.query({from:'2026-10-18',to:'2026-10-18',page:2});assert.equal(s.metrics.reads,7);
  const excluded=s.query({from:'2026-10-18',to:'2026-10-18'},['18014398555948548']);assert.equal(excluded.data.summary.count,106);
  assert.equal(s.query({source:'2'}).data.summary.unknownTaxTotal,300);assert.equal(s.query({source:'3'}).data.summary.tax,0);
  assert.equal(s.query({q:'=seller',source:'1',quality:'hq',min:'200',max:'200'}).data.summary.count,1);
  assert.equal(s.query({q:'%'}).data.summary.count,0);assert.throws(()=>purchaseFilter({from:'2026-02-30'}));assert.throws(()=>purchaseFilter({sort:'total; DELETE'}));
  const last=s.query({});insert(205);assert.notEqual(s.query({},[],last.etag).etag,last.etag);
  assert.throws(()=>s.db.exec('DELETE FROM purchases'),/readonly|read.only/i);
  let csv='';await s.export({source:'1'},[],async c=>csv+=c);assert(csv.includes("'=seller"));assert(csv.includes('33776997240863917'));
  assert.equal((await stat(file)).mtimeMs,before.mtimeMs,'WAL writer and reader do not rewrite main DB');assert.equal(s.metrics.writes,0);
 }finally{s.close();db.close();await rm(dir,{recursive:true,force:true});}
});
test('worker coalesces queries and CSV streams through a separate read-only snapshot',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'purchase-service-')),file=path.join(dir,'ledger.db');const {db,insert}=purchaseFixture(file);insert(1);const service=createPurchaseService(file);
 try{const [a,b]=await Promise.all([service.query({},[],''),service.query({},[],'')]);assert.equal(a.etag,b.etag);assert.equal(a.data.summary.count,1);let text='';for await(const c of service.csv({},[]))text+=c;assert(text.includes('purchased_at_jst'));assert(text.includes('素材'));}finally{await service.close();db.close();await rm(dir,{recursive:true,force:true});}
});
