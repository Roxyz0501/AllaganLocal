import test from 'node:test';import assert from 'node:assert/strict';
import {normalize,initialLanguage,languages} from './public/language-policy.js';
test('web follows concrete config language without overriding legacy choices',()=>{
 for(const code of Object.keys(languages))assert.equal(normalize(code),code);
 for(const [a,b] of [['JA_jp','ja'],['en-GB','en'],['de-DE','de'],['fr-FR','fr'],['ko_KR','ko'],['zh-CN','zh-Hans'],['zh-SG','zh-Hans'],['zh-TW','zh-Hant'],['zh-HK','zh-Hant'],['zh-MO','zh-Hant'],['zh-Hans-TW','zh-Hans'],['zh-Hant-CN','zh-Hant'],['zh',null],['Auto',null]])assert.equal(normalize(a),b);
 assert.equal(initialLanguage(null,'fr',{language:'ja',revision:'first'},null),'fr');
 assert.equal(initialLanguage(null,'fr',{language:'de',revision:'changed'},'old'),'de');
 assert.equal(initialLanguage(null,'fr',{language:'ja',revision:'same'},'same'),'fr');
 assert.equal(initialLanguage('ko','fr',{language:'ja',revision:'same'},'same'),'ko');
 assert.equal(initialLanguage(null,null,{language:'zh-Hant',revision:'first'},null),'zh-Hant');
 assert.equal(initialLanguage(null,null,{},null),'en');
});
