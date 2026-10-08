import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {createPortraitCache,findProfilePortrait} from '../portraits.mjs';
const html='<div class="frame__chara__face"><img src="https://img2.finalfantasyxiv.com/f/test.jpg"></div><p class="frame__chara__name">Example Character</p><p class="frame__chara__world"><i></i>Typhon [Elemental]</p>';
test('direct profiles require the correct identity and official image host',()=>{
 assert.equal(findProfilePortrait(html,'Example Character','Typhon','123').id,'123');
 assert.equal(findProfilePortrait(html,'Other Name','Typhon','123'),null);
 assert.equal(findProfilePortrait(html,'Example Character','Atomos','123'),null);
 assert.equal(findProfilePortrait(html.replace('img2.finalfantasyxiv.com','example.org'),'Example Character','Typhon','123'),null);
});
test('known profile recovers excluded portrait without search',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'portrait-direct-'));
 const owner={id:'1',type:'キャラクター',name:'Example Character',world:'Typhon'};
 const key=createHash('sha256').update(owner.name+'@'+owner.world).digest('hex');
 try{
 await writeFile(path.join(dir,key+'.profile.json'),JSON.stringify({id:'12345'}));
 await writeFile(path.join(dir,'status.json'),JSON.stringify({'1':{firstFailure:1,lastAttempt:1}}));
 const urls=[];
 const cache=createPortraitCache(dir,async url=>{urls.push(String(url));return String(url).endsWith('/12345/')?new Response(html):new Response(new Uint8Array([255,216,255,0]),{headers:{'content-type':'image/jpeg'}});});
 assert.equal((await cache(owner,true)).type,'image/jpeg');
 assert.equal(cache.status(owner).excluded,false);
 assert.equal(urls.length,2);assert.ok(!urls.some(u=>u.includes('?q=')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
