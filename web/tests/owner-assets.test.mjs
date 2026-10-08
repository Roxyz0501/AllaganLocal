import test from 'node:test';import assert from 'node:assert/strict';import {withOwnerAssets} from '../owner-assets.mjs';
test('market valuation uses owner world, distinguishes HQ and excludes cash items and currencies',()=>{
 const owners=[{id:'a',type:'キャラクター',world:'Typhon'},{id:'r',type:'リテイナー',world:'Atomos',parentIds:['a']}];
 const records=[{owner:'a',id:5,quantity:2,category:1},{owner:'r',id:5,quantity:3,hq:true,category:4},{owner:'a',id:6,quantity:10,category:1},{owner:'a',id:1,quantity:999,category:12}];
 const market={item:(id,w)=>({marketable:true,local:{nq:{price:w==='Typhon'?20:40},hq:{price:w==='Typhon'?30:50}}})};
 const result=withOwnerAssets(owners,records,new Map([[6,{sell:7}]]),[6],market);
 assert.equal(result[0].assets.total.quantity,15);assert.equal(result[0].assets.total.cashValue,70);assert.equal(result[0].assets.total.marketValue,190);assert.equal(result[0].assets.total.marketQuantity,5);assert.equal(result[0].assets.total.marketUnknown,0);assert.equal(result[1].assets.personal.marketValue,150);
});
