import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('sales UI clears recovered errors and coalesces slow identical requests',async()=>{
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{value:id==='salesPeriod'?'all':'',hidden:false,textContent:'',innerHTML:'',addEventListener(){}});return elements.get(id);};
 const payload={page:1,pages:1,total:0,characters:[],retainers:[],groups:[],items:[],summary:{count:0,quantity:0,gross:0}};
 let calls=0,fail=false,release;
 const context=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[],createElement:()=>({setAttribute(){}}),body:{append(){}}},Intl,Date,URLSearchParams,AbortController,AbortSignal,setTimeout,clearTimeout,fetch:async()=>{calls++;if(fail)throw new Error('offline');if(release!==undefined)await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>payload};}});
 const source=(await readFile(new URL('../public/sales.js',import.meta.url),'utf8')).replaceAll('export async function','async function').replaceAll('export function','function');vm.runInContext(source,context);
 await context.loadSales();fail=true;await context.loadSales();assert.equal(get('salesWarning').hidden,false);
 fail=false;await context.loadSales();assert.equal(get('salesWarning').hidden,true);
 release=null;const first=context.loadSales();const before=calls;await context.loadSales();assert.equal(calls,before);release();await first;
});
