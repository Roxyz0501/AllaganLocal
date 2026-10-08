import {test} from 'node:test';
import assert from 'node:assert/strict';
import {valueItem,summarize,applyExclusions} from '../valuation.mjs';
test('NPC totals multiply all recorded units by NQ price and sum the complete list',()=>{
  const items=[valueItem({id:1,quantity:17,nq:10,hq:7,sell:7}),valueItem({id:2,quantity:500,sell:12}),valueItem({id:3,quantity:0,sell:100})];
  assert.equal(items[0].sellTotal,119);assert.equal(summarize(items).sellTotal,6119);
});
test('unknown prices remain unknown, zero prices and zero holdings contribute zero',()=>{
  const items=[valueItem({quantity:12}),valueItem({quantity:4,sell:0}),valueItem({quantity:0})];
  assert.equal(items[0].sellTotal,null);assert.equal(items[2].sellTotal,0);assert.deepEqual(summarize(items),{kinds:3,quantity:16,shortage:0,sellTotal:0,unknownPrices:1,excludedQuantity:0});
});
test('exclusions match both owner and place; excluded entries remain available for restoring',()=>{
  const raw={locations:[{owner:'90000000000000001',category:8,quantity:10,nq:7,hq:2,collectable:1},{owner:'90000000000000001',category:9,quantity:3,nq:3},{owner:'90000000000000002',category:8,quantity:5,nq:5}],sell:100};
  const scoped=valueItem(applyExclusions(raw,[{owner:'90000000000000001',category:8}]));
  assert.equal(scoped.quantity,8);assert.equal(scoped.sellTotal,800);assert.equal(scoped.excludedQuantity,10);assert.equal(scoped.locations.length,3);assert.equal(scoped.locations[0].excluded,true);assert.equal(raw.locations[0].excluded,undefined);
  assert.equal(applyExclusions(raw).quantity,18);
  assert.equal(applyExclusions({locations:[]},[{owner:'90000000000000001',category:8}]).locations[0].excluded,true);
});
