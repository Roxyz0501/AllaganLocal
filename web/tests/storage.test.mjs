import test from 'node:test';import assert from 'node:assert/strict';
import {ownerDirectory,storageView,splitLocations} from '../storage.mjs';import {parseInventory,aggregate,parseCharacters} from '../inventory.mjs';import {applyExclusions,valueItem,summarize} from '../valuation.mjs';
const a='18014398549107457',b='18014398549107458',r='30000000000000001',fc='90000000000000001';
const chars=parseCharacters(`{"SavedCharacters":{"${a}":{"Name":"Same Name"},"${b}":{"Name":"Same Name"},"${r}":{"Name":"Retainer","OwnerId":${a}},"${fc}":{"Name":"FC"}}}`);
const slot=(owner,container,index,id,quantity,category=1)=>({owner,container,slot:index,id,quantity,category,nq:quantity,hq:false,collectable:false});
const rows=[slot(a,0,3,5,2),slot(a,0,12,5,8),slot(a,4000,2,5,4,2),slot(r,10000,20,5,10,4),slot(b,0,3,5,11),slot(a,2000,0,1,0,12),slot(r,12000,0,1,345,12),slot(fc,22000,0,1,900,8),slot(fc,2502,0,80,123,8)];
const catalog=new Map([[5,{id:5,name:'素材',sell:2,category:'素材'}]]);
test('balance scopes preserve zero, missing data, FC points, and exact owner IDs',()=>{
 const owners=ownerDirectory(rows,chars);assert.equal(owners.find(o=>o.id===a).gil,0);assert.equal(owners.find(o=>o.id===b).gil,null);assert.equal(owners.find(o=>o.id===r).gil,345);assert.equal(owners.find(o=>o.id===fc).gil,900);assert.equal(owners.find(o=>o.id===fc).points,123);
 const view=storageView(rows,owners,catalog,new URLSearchParams({owner:a,children:'1',highlight:'5'}));assert.equal(view.owners.length,2);assert.equal(view.matches,4);assert.equal(view.quantity,24);assert.deepEqual(view.containers.find(c=>c.id===0).items.map(x=>x.slot),[3,12]);assert.equal(view.containers[0].columns,5);
 const all=storageView(rows,owners,catalog,new URLSearchParams({highlight:'5'}));assert.equal(all.matches,5);assert.equal(all.quantity,35);
 const only=storageView(rows,owners,catalog,new URLSearchParams({owner:a,category:'2',highlight:'5'}));assert.equal(only.matches,1);assert.equal(only.quantity,4);
});
test('location rows retain totals and exclusions without duplicating target shortages',()=>{
 const item=valueItem({...aggregate(rows.filter(r=>r.id===5)).get(5),sell:2,target:40});const split=splitLocations([item]);assert.equal(split.length,4);assert.equal(summarize(split).quantity,item.quantity);assert.equal(summarize(split).sellTotal,item.sellTotal);assert.ok(split.every(r=>r.targetQuantity===35));
 const excluded=valueItem(applyExclusions(item,[{owner:a,category:2}]));const changed=splitLocations([excluded]);assert.equal(changed.find(r=>r.locations[0].category===2).quantity,0);assert.equal(changed.reduce((n,r)=>n+r.sellTotal,0),62);
});
test('snapshot retains empty slots and zero currency separately from counted inventory',()=>{
 const row=Array(27).fill('0');row[0]=row[20]='2000';row[2]='1';row[21]='12';row[23]=a;
 assert.equal(parseInventory(row.join(',')).length,0);assert.equal(parseInventory(row.join(','),true)[0].quantity,0);
});

test('retainer listing totals count occupied listings and units, not gil or empty slots',()=>{
 const input=[...rows,slot(r,12002,0,5,99,9),slot(r,12002,1,6,2,9),slot(r,12002,2,0,0,9),slot(b,12002,0,5,500,9)];
 const owners=ownerDirectory(input,chars),retainer=owners.find(o=>o.id===r);
 assert.equal(retainer.listedStacks,2);assert.equal(retainer.listedQuantity,101);assert.equal(retainer.gil,345);
 const view=storageView(input,owners,catalog,new URLSearchParams({owner:a,children:'1',paged:'1'}));
 assert.equal(view.owners.length,2);assert.ok(!view.containers.some(c=>c.owner===b));
});

test('retainer configuration Gil fills missing CSV balance, preserves zero and prefers explicit CSV',()=>{
 const make=c=>parseCharacters(JSON.stringify({SavedCharacters:{[r]:{Name:'Retainer',...c}}}));
 assert.equal(ownerDirectory([],make({Gil:1234}))[0].gil,1234);
 assert.equal(ownerDirectory([],make({Gil:0}))[0].gil,0);
 assert.equal(ownerDirectory([],make({}))[0].gil,null);
 assert.equal(ownerDirectory([],make({Gil:'1234'}))[0].gil,null);
 assert.equal(ownerDirectory([slot(r,12000,0,1,0,12)],make({Gil:1234}))[0].gil,0);
});
