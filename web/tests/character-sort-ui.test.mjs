import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('character money sorting handles zero and unknown values; tags prefer main then numbered subs',async()=>{
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{value:'name'});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[]},localStorage:{getItem:key=>key==='allagan.characterTags'?JSON.stringify({a:['main'],b:['sub','submarine'],c:['sub'],d:['submarine']}):key==='allagan.subNumbers'?JSON.stringify({b:2,c:1}):null},Intl,Date});
 const source=(await readFile(new URL('../public/storage.js',import.meta.url),'utf8')).split('function orderButtons')[0].replace(/^import .*;\r?\n/gm,'');vm.runInContext(source,context);
 vm.runInContext(`directory=['a','b','c','d','e'].map((id,i)=>({id,name:id,type:'キャラクター',world:'Typhon',gil:[100,0,null,50,200][i],retainerGil:[1,0,null,2,3][i],assets:{total:{cashValue:[10,0,null,20,30][i],marketValue:[100,0,null,200,300][i]}}}));`,context);
 const ids=()=>Array.from(vm.runInContext('orderedCharacters(directory).map(o=>o.id)',context));
 for(const mode of ['gil','retainerGil','cashValue','marketValue']){
  get('characterSort').value=mode;vm.runInContext("characterDirection='desc'",context);const result=ids();assert.equal(result[0],'e');assert.equal(result.at(-1),'c');assert.equal(result.at(-2),'b');
  vm.runInContext("characterDirection='asc'",context);assert.equal(ids()[0],'b');assert.equal(ids().at(-1),'c');
 }
 get('characterSort').value='tag';assert.deepEqual(ids(),['a','c','b','d','e']);vm.runInContext("characterDirection='desc'",context);assert.deepEqual(ids(),['a','c','b','d','e']);
});
