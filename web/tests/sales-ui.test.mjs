import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('sales UI clears recovered errors and coalesces slow identical requests',async()=>{
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{value:id==='salesPeriod'?'all':'',hidden:false,textContent:'',innerHTML:'',addEventListener(){}});return elements.get(id);};
 const payload={page:1,pages:1,total:0,characters:[],retainers:[],groups:[],items:[],summary:{count:0,quantity:0,gross:0}};
 let calls=0,fail=false,release;
 const context=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[],createElement:()=>({setAttribute(){}}),body:{append(){}}},Intl,Date,URLSearchParams,AbortController,AbortSignal,setTimeout,clearTimeout,fetch:async()=>{calls++;if(fail)throw new Error('offline');if(release!==undefined)await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>payload};}});
 const source=(await readFile(new URL('../public/sales.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');vm.runInContext(source,context);
 await context.loadSales();fail=true;await context.loadSales();assert.equal(get('salesWarning').hidden,false);
 fail=false;await context.loadSales();assert.equal(get('salesWarning').hidden,true);
 release=null;const first=context.loadSales();const before=calls;await context.loadSales();assert.equal(calls,before);release();await first;
});

test('sales cancellation ignores late results and keeps CSV conditions current for identical payloads',async()=>{
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{value:id==='salesPeriod'?'all':'',hidden:false,textContent:'',innerHTML:'',addEventListener(){}});return elements.get(id);};
 const payload={page:1,pages:1,total:0,characters:[],retainers:[],groups:[],items:[],summary:{count:0,quantity:0,gross:0}},requests=[];
 const context=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[],createElement:()=>({setAttribute(){}}),body:{append(){}}},Intl,Date,URLSearchParams,AbortController,AbortSignal,setTimeout,clearTimeout,fetch:(_url,options)=>new Promise(resolve=>requests.push({resolve,signal:options.signal}))});
 vm.runInContext((await readFile(new URL('../public/sales.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replaceAll('export ',''),context);
 let job=context.loadSales();requests[0].resolve({ok:true,json:async()=>payload});await job;
 get('salesSearch').value='new';job=context.loadSales();requests[1].resolve({ok:true,json:async()=>payload});await job;
 assert.equal(vm.runInContext('csvParams.get("q")',context),'new');
 get('salesSearch').value='pending';job=context.loadSales();context.cancelSalesLoad();assert.equal(requests[2].signal.aborted,true);
 requests[2].resolve({ok:false,json:async()=>({error:'stale failure'})});await job;
 assert.equal(get('salesWarning').hidden,true);assert.equal(vm.runInContext('csvParams.get("q")',context),'new');
});
