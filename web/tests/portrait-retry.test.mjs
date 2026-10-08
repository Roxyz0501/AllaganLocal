import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createPortraitCache,portraitRetryState} from '../portraits.mjs';
test('portrait exclusion persists, retries after six hours, recovers and stops at 36 hours',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'portrait-retry-'));let now=Date.parse('2026-10-04T00:00:00Z'),calls=0,success=false;
 const owner={id:'1',type:'キャラクター',name:'Example Name',world:'Typhon'};
 const fetcher=async url=>{calls++;if(!success)return new Response('',{status:503});if(String(url).includes('/character/'))return new Response('<a href="/lodestone/character/123/"><div class="entry__chara__face"><img src="https://img2.finalfantasyxiv.com/f/test.jpg"></div><p class="entry__name">Example Name</p><p class="entry__world">Typhon [Elemental]</p></a>');return new Response(new Uint8Array([255,216,255,0]),{headers:{'content-type':'image/jpeg'}});};
 try{let cache=createPortraitCache(dir,fetcher,()=>now);await cache(owner);assert.equal(cache.status(owner).excluded,true);await cache(owner);assert.equal(calls,1);
 cache=createPortraitCache(dir,fetcher,()=>now);await cache(owner);assert.equal(calls,1);
 now+=6*3600000;success=true;await cache(owner);assert.equal(calls,3);assert.equal(cache.status(owner).excluded,false);
 assert.equal(portraitRetryState({firstFailure:now-36*3600000,lastAttempt:now-6*3600000},now).stopped,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
