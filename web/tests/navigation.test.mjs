import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('sidebar selection is exclusive across all routes; stale history cannot repaint',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const nav=html.slice(html.indexOf('<nav'),html.indexOf('</nav>'));
 const buttons=[...nav.matchAll(/<button([^>]*)>/g)].map(([,attrs])=>{const dataset={};for(const [,k,v] of attrs.matchAll(/data-([\w-]+)="([^"]*)"/g))dataset[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;return {dataset};});
 buttons.push({dataset:{list:'example'}});
 for(const b of buttons){b.active=true;b.attrs={};b.classList={toggle:(k,v)=>b.active=v};b.setAttribute=(k,v)=>b.attrs[k]=v;b.removeAttribute=k=>delete b.attrs[k];}
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{value:'',addEventListener(){}});return elements.get(id);};
 get('moneyPeriod').value='today';get('itemHistoryMetric').value='count';
 let resolveFetch;
 const context=vm.createContext({document:{querySelectorAll:()=>buttons,getElementById:get,createElement:()=>({setAttribute(){}}),body:{append(){}}},Intl,Date,URLSearchParams,localStorage:{getItem:()=>null},fetch:()=>new Promise(r=>resolveFetch=r)});
 vm.runInContext((await readFile(new URL('../public/money.js',import.meta.url),'utf8')).replaceAll('export ',''),context);
 const routes=[['money','all:retainers'],['sales'],['catalog'],['market'],['characters'],['companies'],['favorites'],['list','all:gil','count','example'],['money','item:1','total'],['money','item:1','count'],['money','list:1'],['money','points:1'],['money','character:1']];
 for(const route of routes){context.selectNavigation(...route);assert.equal(buttons.filter(b=>b.active).length,1,JSON.stringify(route));assert.equal(buttons.filter(b=>b.attrs['aria-current']==='page').length,1);}
 const pending=context.loadMoney('all:retainers');context.cancelMoneyLoad();context.selectNavigation('sales');get('title').textContent='sales';resolveFetch({ok:true,json:async()=>({})});await pending;
 assert.equal(get('title').textContent,'sales');assert.equal(buttons.find(b=>b.active).dataset.view,'sales');
});

