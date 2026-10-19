import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('parent search opens highlighted locations, caches unchanged results and restores original branches on clear',async()=>{
 const events={},output={textContent:''},original={hidden:false},result={hidden:true,innerHTML:'',nextElementSibling:original,replaceChildren(){this.innerHTML='';}},form={isConnected:true,elements:{query:{value:'ore'}},dataset:{searchScope:'{"owner":"a"}'},nextElementSibling:result,querySelector:()=>output,matches:()=>true};
 let calls=0;
 const context=vm.createContext({Date,URLSearchParams,AbortController,fetch:async()=>{calls++;return {ok:true,json:async()=>({matches:1,page:1,pages:1,owners:[{id:'a',name:'A',world:'Typhon',type:'キャラクター'}],containers:[{owner:'a',name:'所持品 1',items:[{id:5,name:'<ore>',slot:2,quantity:9}]}]})};}});
 vm.runInContext((await readFile(new URL('../public/storage-search.js',import.meta.url),'utf8')).replaceAll('export ',''),context);
 context.bindStorageSearch({addEventListener:(name,fn)=>events[name]=fn});
 events.submit({target:form,preventDefault(){}});await new Promise(r=>setImmediate(r));
 assert.equal(calls,1);assert.equal(result.hidden,false);assert.equal(original.hidden,true);assert.match(result.innerHTML,/<details open/);assert.match(result.innerHTML,/<mark translate="no">&lt;ore&gt;<\/mark>/);
 events.submit({target:form,preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(calls,1);
 events.reset({target:form});assert.equal(result.hidden,true);assert.equal(original.hidden,false);assert.equal(output.textContent,'');
 assert.match(context.storageSearchForm('retainers:a',[]),/retainersOnly/);
 assert.match(context.storageSearchForm('a:inventory',[['inventory','所持品',[1,4]]]),/searchCategories/);
});
