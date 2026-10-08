import test from 'node:test';import assert from 'node:assert/strict';import {withCashItems} from '../cash-items.mjs';
test('cash tags aggregate character and linked retainers with NPC price and unknown quantities',()=>{
 const owners=[{id:'a',type:'キャラクター'},{id:'b',type:'キャラクター'},{id:'r',type:'リテイナー',parentIds:['a'],listedStacks:2,listedQuantity:8}];
 const rows=[{owner:'a',id:5,quantity:3},{owner:'r',id:5,quantity:4},{owner:'b',id:5,quantity:100},{owner:'r',id:6,quantity:2}];
 const result=withCashItems(owners,rows,new Map([[5,{sell:7}]]),[5,6]);
 assert.equal(result[0].cashQuantity,9);assert.equal(result[0].cashValue,49);assert.equal(result[0].cashUnknown,2);assert.equal(result[0].retainerListedStacks,2);assert.equal(result[0].retainerListedQuantity,8);assert.equal(result[1].cashValue,700);
 assert.equal(withCashItems(owners,rows,new Map(),[])[0].cashQuantity,0);
});
