import test from 'node:test';import assert from 'node:assert/strict';import {recordMoney,moneyView,moneySummary,japanDay} from '../ledger.mjs';import {ownerDirectory} from '../storage.mjs';
test('daily closing values, strict previous day, ranges, unknown amounts and JST boundaries',()=>{
 let l={version:1,series:{}};const save=(at,value)=>{l=recordMoney(l,[{key:'character:a',label:'A',value,personal:value,retainers:0}],new Date(at)).ledger;};
 save('2026-10-01T14:00:00Z',100);save('2026-10-01T14:59:00Z',150);save('2026-10-01T15:00:00Z',170);
 assert.equal(japanDay(new Date('2026-10-01T15:00:00Z')),'2026-10-02');assert.equal(moneySummary(l,'character:a','2026-10-01').value,150);assert.equal(moneySummary(l,'character:a','2026-10-02').change,20);assert.equal(moneySummary(l,'character:a','2026-09-30').value,null);
 assert.equal(moneyView(l,'character:a','2026-10-02','2026-10-01','2026-10-02').days.length,2);assert.equal(moneyView(l,'character:a','2026-10-02').changes[0].delta,20);
 save('2026-10-03T15:00:00Z',200);assert.equal(moneySummary(l,'character:a','2026-10-04').change,null);save('2026-10-04T15:00:00Z',null);assert.equal(moneySummary(l,'character:a','2026-10-05').change,null);
});
test('character totals include only their own retainers and do not treat missing balances as zero',()=>{
 const c=new Map([['a',{id:'a',name:'A',type:'キャラクター'}],['r',{id:'r',name:'R',type:'リテイナー',parentIds:['a']}]]);let o=ownerDirectory([{owner:'a',id:1,container:2000,quantity:100},{owner:'r',id:1,container:12000,quantity:200}],c);assert.equal(o.find(x=>x.id==='a').totalGil,300);o=ownerDirectory([{owner:'a',id:1,container:2000,quantity:100}],c);assert.equal(o.find(x=>x.id==='a').totalGil,100);assert.equal(o.find(x=>x.id==='a').retainerUnknown,1);
});
import {withMoneyTotals} from '../ledger.mjs';
test('overall totals separate cash and list valuations, and preserve gaps',()=>{
 let l={version:1,series:{}};
 const obs=[{key:'character:a',label:'A',value:100},{key:'fc:f',label:'FC',value:50},{key:'list:l',label:'List',value:900}];
 l=recordMoney(l,obs,new Date('2026-10-01T01:00:00Z')).ledger;
 l=recordMoney(l,[{...obs[0],value:120}],new Date('2026-10-01T02:00:00Z')).ledger;
 let totals=withMoneyTotals(l);
 assert.equal(moneySummary(totals,'all:gil','2026-10-01').value,170);
 assert.equal(moneySummary(totals,'all:lists','2026-10-01').value,900);
 assert.deepEqual(totals.series['all:gil'].changes.map(p=>p.amounts.value),[150,170]);
 l=recordMoney(l,[{...obs[0],value:130}],new Date('2026-10-02T01:00:00Z')).ledger;
 assert.equal(moneySummary(withMoneyTotals(l),'all:gil','2026-10-02').value,130);assert.equal(withMoneyTotals(l).series['all:gil'].days['2026-10-02'].amounts.missing,1);
});
test('FC points totals remain separate from gil and calculate previous-day change',()=>{
 let l={version:1,series:{}};
 for(const [date,a,b] of [['2026-10-03T01:00:00Z',100,200],['2026-10-04T01:00:00Z',140,230]])l=recordMoney(l,[{key:'points:a',label:'A',value:a},{key:'points:b',label:'B',value:b},{key:'fc:a',label:'A gil',value:999}],new Date(date)).ledger;
 const total=withMoneyTotals(l);assert.equal(moneySummary(total,'all:points','2026-10-04').value,370);assert.equal(moneySummary(total,'all:points','2026-10-04').change,70);assert.equal(moneySummary(total,'points:a','2026-10-04').change,40);assert.equal(moneySummary(total,'all:gil','2026-10-04').value,999);
});
import {itemMetricLedger} from '../ledger.mjs';
test('item history retains quantity and historical NPC value including zero holdings',()=>{
 let l={version:1,series:{}};
 l=recordMoney(l,[{key:'item:5',label:'Item',value:7,price:49}],new Date('2026-10-03T01:00:00Z')).ledger;
 l=recordMoney(l,[{key:'item:5',label:'Item',value:0,price:0}],new Date('2026-10-04T01:00:00Z')).ledger;
 assert.equal(moneySummary(itemMetricLedger(l,'count'),'item:5','2026-10-04').change,-7);
 assert.equal(moneySummary(itemMetricLedger(l,'price'),'item:5','2026-10-04').change,-49);
 assert.equal(moneySummary(itemMetricLedger(l,'price'),'item:5','2026-10-03').value,49);
});
import {listMetricLedger} from '../ledger.mjs';
test('list quantities never invent unrecorded past counts and retain price history',()=>{
 let l={version:1,series:{}};l=recordMoney(l,[{key:'list:a',label:'A',value:30}],new Date('2026-10-03T01:00:00Z')).ledger;l=recordMoney(l,[{key:'list:a',label:'A',value:50,quantity:5}],new Date('2026-10-04T01:00:00Z')).ledger;
 assert.equal(moneySummary(listMetricLedger(l,'count'),'list:a','2026-10-03').value,null);assert.equal(moneySummary(listMetricLedger(l,'count'),'list:a','2026-10-04').value,5);assert.equal(moneySummary(listMetricLedger(l,'price'),'list:a','2026-10-03').value,30);
});

test('excluded character and retainer balances leave totals while individual history and FC funds remain',()=>{
 const {ledger}=recordMoney({series:{}},[{key:'character:a',label:'A',value:120},{key:'retainer:r',label:'R',value:20},{key:'character:b',label:'B',value:30},{key:'fc:f',label:'FC',value:40}],new Date('2026-10-04T00:00:00Z'));
 const filtered=withMoneyTotals(ledger,new Set(['character:a','retainer:r']));
 assert.equal(moneyView(filtered,'all:gil','2026-10-04').value,70);
 assert.equal(moneyView(filtered,'all:characters','2026-10-04').value,30);
 assert.equal(moneyView(filtered,'character:a','2026-10-04').value,120);
 assert.equal(moneyView(withMoneyTotals(ledger),'all:gil','2026-10-04').value,190);
});
