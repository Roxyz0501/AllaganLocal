import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('leaving an item detail request prevents its late dialog and failure toast',async()=>{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),events={},requests=[],shown=[],toasts=[];
 const context=vm.createContext({document:{addEventListener:(name,fn)=>events[name]=fn,createElement:()=>({})},$:()=>({addEventListener(){}}),api:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),showDetail:id=>shown.push(id),toast:s=>toasts.push(s)});
 const section=source.slice(source.indexOf('const itemPriceRequests='),source.indexOf("document.addEventListener('change',async event=>{const el=event.target;if(!el.dataset.cashItem)"));
 vm.runInContext('let detailRequest=0;'+section,context);
 const pending=events['open-item-detail']({detail:{id:5}});
 context.cancelItemDetailLoad?.();
 requests[0].resolve({items:[{id:5}]});await pending;assert.deepEqual(shown,[]);
 const failed=events['open-item-detail']({detail:{id:6}});context.cancelItemDetailLoad?.();requests[1].reject(Error('old request'));await failed;assert.deepEqual(toasts,[]);
});

test('storage refresh clears a recovered error without forcing an unchanged rerender',async()=>{
 const source=await readFile(new URL('../public/storage.js',import.meta.url),'utf8'),elements=new Map();let fail=false,renders=0;
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,textContent:'',innerHTML:''});return elements.get(id);};
 const context=vm.createContext({$:get,URLSearchParams,Date,esc:x=>x,json:async()=>{if(fail)throw Error('offline');return {owners:[],updatedAt:null};},render:()=>renders++});
 vm.runInContext("let sequence=0,directory=[],selectedOwner='',highlight=0,mode='characters',lastPayload='',data,committedCategory='';const dresserPages=new Map();"+source.slice(source.indexOf('export async function loadStorage(){'),source.indexOf('export async function openStorage(')).replace('export ',''),context);
 await context.loadStorage();assert.equal(renders,1);fail=true;await context.loadStorage();assert.equal(get('storageWarning').hidden,false);
 fail=false;await context.loadStorage();assert.equal(get('storageWarning').hidden,true);assert.equal(renders,1);
});
