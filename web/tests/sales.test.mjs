import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSoldItems,parseMarketCharacters,salesView} from '../sales.mjs';
test('sold CSV preserves IDs, local detection dates, quantities and pre-tax amounts',()=>{
  const row='33776997240863917,50,22506,1,3,30000,0,09/17/2025 10:07:50';
  const records=parseSoldItems(row+'\n'+row);assert.equal(records.length,2);assert.equal(records[0].retainerId,'33776997240863917');assert.equal(records[0].detectedAt,'2025-09-17T10:07:50');assert.equal(records[0].gross,90000);assert.equal(records[0].hq,true);
  assert.throws(()=>parseSoldItems(row.replace('09/17/2025','02/30/2025')));assert.throws(()=>parseSoldItems('1,2,3'));
});
test('sales filter and aggregation keep same-named characters separate and retain unknown owners',()=>{
  const rows=parseSoldItems('33776997240863917,50,22506,0,3,30000,0,09/17/2025 10:07:50\n33776997240863918,51,22506,0,2,20000,0,09/18/2025 10:07:50\n33776997240863919,50,22506,0,1,10000,0,09/19/2025 10:07:50');
  const chars=parseMarketCharacters('{"Characters":{"$type":"ignored","18014398549107457":{"Name":"Same Name","WorldId":50},"18014398549107458":{"Name":"Same Name","WorldId":51},"33776997240863917":{"Name":"Ret A","OwnerId":18014398549107457,"WorldId":50},"33776997240863918":{"Name":"Ret B","OwnerId":18014398549107458,"WorldId":51}}}');
  const catalog=new Map([[22506,{name:'沈没船の高級耳飾り'}]]),worlds={50:'World A',51:'World B'};
  const view=p=>salesView(rows,new Map(),chars,catalog,worlds,new URLSearchParams(p));
  assert.equal(view({}).summary.gross,140000);assert.equal(view({}).chart.reduce((n,p)=>n+p.gross,0),140000);assert.equal(view({}).chartUnit,'day');assert.equal(view({from:'2025-09-18',to:'2025-09-18'}).chartUnit,'hour');assert.equal(view({from:'2025-09-18',to:'2025-09-18'}).chart[0].date,'2025-09-18T10');assert.equal(view({}).groups.length,3);assert.equal(view({character:'18014398549107457'}).summary.gross,90000);
  assert.equal(view({from:'2025-09-18',to:'2025-09-18'}).summary.gross,40000);assert.equal(view({q:'Ret B'}).total,1);assert.equal(view({q:'missing'}).total,0);assert.throws(()=>view({from:'2026-01-01',to:'2025-01-01'}));
});
