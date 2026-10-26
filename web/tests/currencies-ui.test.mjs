import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function fixture(){
 const elements=new Map(),requests=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,textContent:'',innerHTML:''});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:get},Intl,URLSearchParams,AbortController,setTimeout,clearTimeout,
  pagedSource:(_id,_label,_columns,_endpoint,params,data)=>({params,data}),currencyColumns:[],currencyRow:x=>x,
  fetch:(_url,options)=>new Promise((resolve,reject)=>requests.push({resolve,reject,signal:options?.signal}))});
 vm.runInContext((await readFile(new URL('../public/currencies.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replaceAll('export ',''),context);
 const payload={page:1,pages:1,total:0,owners:[],items:[]};
 const resolve=i=>requests[i].resolve({ok:true,json:async()=>payload});
 return {context,get,requests,resolve};
}

test('currency recovery clears an error even when the restored payload is unchanged',async()=>{
 const {context,get,requests,resolve}=await fixture();
 let job=context.loadCurrencies();resolve(0);await job;
 job=context.loadCurrencies();requests[1].reject(Error('offline'));await job;assert.equal(get('currencyWarning').hidden,false);
 job=context.loadCurrencies();resolve(2);await job;assert.equal(get('currencyWarning').hidden,true);
});

test('old currency errors cannot overwrite new results; CSV uses the displayed query',async()=>{
 const {context,get,requests,resolve}=await fixture();
 get('currencySearch').value='old';const old=context.loadCurrencies();
 get('currencySearch').value='new';const current=context.loadCurrencies();resolve(1);await current;
 requests[0].reject(Error('late failure'));await old;assert.equal(get('currencyWarning').hidden,true);
 get('currencySearch').value='pending';const pending=context.loadCurrencies();
 assert.equal(vm.runInContext('currencyCsvSource().params.get("q")',context),'new');
 context.cancelCurrencyLoad();assert.equal(requests[2].signal.aborted,true);resolve(2);await pending;
 assert.equal(vm.runInContext('currencyCsvSource().params.get("q")',context),'new');
});
