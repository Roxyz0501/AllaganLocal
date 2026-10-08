import test from 'node:test';import assert from 'node:assert/strict';import {marketValue,marketSummary} from '../market-valuation.mjs';
test('market totals separate HQ, exclusions, nonmarketable and missing quotes',()=>{
 const item={id:5,quantity:5,nq:2,hq:3,sell:7},prices={nq:{price:10},hq:{price:20}};
 assert.deepEqual(marketValue(item,prices),{value:80,unknown:0});assert.deepEqual(marketValue(item,prices,true),{value:0,unknown:0});assert.deepEqual(marketValue(item,{nq:{price:10}}),{value:20,unknown:3});assert.deepEqual(marketValue(item,null,false,false),{value:0,unknown:0});
 assert.deepEqual(marketSummary([item],{item:()=>({region:prices,marketable:true})},[5]),{cash:35,cashUnknown:0,value:0,unknown:0});
});
