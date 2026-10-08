import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTranslator} from './public/translation.js';
const codes=['ja','en','de','fr','ko','zh-Hans','zh-Hant'];
const resources=Object.fromEntries(await Promise.all(codes.map(async code=>[code,JSON.parse(await readFile(new URL('./public/locales/'+code+'.json',import.meta.url),'utf8'))])));
test('seven complete Web dictionaries, shared format arguments and no empty translations',()=>{
 const keys=Object.keys(resources.ja).sort();
 for(const code of codes){assert.deepEqual(Object.keys(resources[code]).sort(),keys);for(const key of keys){assert(resources[code][key].trim(),code+key);assert.deepEqual((resources[code][key].match(/\{\d+\}/g)||[]).sort(),(key.match(/\{\d+\}/g)||[]).sort(),code+key);}}
});
test('exact phrases, dynamic quantities and literal user names',()=>{
 const t=createTranslator(resources.en,'en');
 assert.equal(t('リテイナー 10人'),'10 retainers');
 assert.equal(t('プレイヤー所持金'),'Player gil');
 assert.equal(t('「所持品」の名前をコピー','所持品'),'「所持品」: copy name');
 assert.equal(t('1,234個'),'1,234 units');
 assert.equal(t('Unmapped diagnostic'),'Unmapped diagnostic'); // Unknown text is retained for diagnostics, never erased.
 assert.equal(createTranslator(resources.ja,'ja')('リテイナー 10人'),'リテイナー 10人');
});
test('template placeholders can reorder numbers without retranslation',()=>{
 const t=createTranslator(resources.en,'en');
 assert.match(t('10対象中2対象の金額が不明です。確認できる金額だけを合計しています。対象数の変化も増減に含まれます。'),/^2 of 10 records/);
});
