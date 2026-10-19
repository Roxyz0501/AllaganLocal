import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import {parseJobs,createJobCache} from '../jobs.mjs';
const row=(name,level,exp)=>`<li><div class="character__job__level">${level}</div><div class="character__job__name js__tooltip">${name}</div><div class="character__job__exp">${exp}</div></li>`;
const html='<p class="frame__chara__name">Test Name</p><p class="frame__chara__world">Typhon [Elemental]</p><div class="frame__chara__face"><img src="https://img2.finalfantasyxiv.com/f/test.jpg"></div>'+row('戦士',100,'-- / --')+row('学者',99,'100 / 1000')+row('木工師',100,'-- / --')+row('剣術士',100,'-- / --')+row('青魔道士',80,'-- / --');
test('jobs distinguish level cap from level number and exclude crafting/base classes',()=>{const jobs=parseJobs(html);assert.equal(jobs.filter(j=>j.capped).length,2);assert.equal(jobs.length,5);assert.throws(()=>parseJobs('<html>maintenance</html>'));});
test('job cache coalesces explicit refresh, restores persisted jobs, performs no reads on display and retains previous data on failure',async()=>{
 const dir=await mkdtemp(path.resolve('artifacts/jobs-test-'));const owner={id:'fixture',name:'Test Name',world:'Typhon',type:'キャラクター'};let calls=0,fail=false;
 try{const get=createJobCache(dir,async()=> 'https://jp.finalfantasyxiv.com/lodestone/character/123/',async()=>{calls++;return {ok:!fail,text:async()=>html};});await get.ready;
 await Promise.all([get.refresh(owner),get.refresh(owner)]);assert.equal(calls,1);assert.equal(get.snapshot(owner).capped,2);
 for(let i=0;i<10;i++)get.snapshot(owner);assert.equal(calls,1);
 const reload=createJobCache(dir,async()=>{throw Error('No fetch expected')});await reload.ready;assert.equal(reload.snapshot(owner).capped,2);assert.equal(reload.snapshot({...owner,name:'Other'}),null);
 fail=true;await get.refresh(owner);assert.equal(get.snapshot(owner).jobs.length,5);assert.ok(get.snapshot(owner).error);
 }finally{await rm(dir,{recursive:true,force:true});}
});
