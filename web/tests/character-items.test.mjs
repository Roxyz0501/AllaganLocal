import test from 'node:test';import assert from 'node:assert/strict';import {recordMoney,characterItemLedger,itemMetricLedger,moneyView} from '../ledger.mjs';
test('character item history isolates exact character IDs, preserves zeros and never reuses global history',()=>{
 const observations=[{key:'item:5',label:'素材',value:99,price:198},{key:'item-owner:111:5',label:'素材',value:3,price:6},{key:'item-owner:222:5',label:'素材',value:9,price:18},{key:'item-owner:111:all',label:'全アイテム',value:3,price:6}];
 const {ledger}=recordMoney({series:{}},observations,new Date('2026-10-04T00:00:00Z'));
 const scoped=characterItemLedger(ledger,'111');assert.deepEqual(Object.keys(scoped.series),['item:5','all:items']);
 assert.equal(moneyView(itemMetricLedger(scoped,'count'),'item:5','2026-10-04').value,3);
 assert.equal(moneyView(itemMetricLedger(scoped,'price'),'item:5','2026-10-04').value,6);
 assert.equal(moneyView(scoped,'item:5','2026-10-03').value,null);
 assert.deepEqual(characterItemLedger(ledger,'333').series,{});
});
