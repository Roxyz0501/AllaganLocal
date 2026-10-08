import test from 'node:test';import assert from 'node:assert/strict';import {exactItemLink} from '../item-links.mjs';
test('official item links require a unique exact name, not similar search results',()=>{
 const html='<a href="/lodestone/playguide/db/item/abc/">高純度コークス</a><a href="/lodestone/playguide/db/item/def/">コークス</a>';
 assert.equal(exactItemLink(html,'コークス'),'https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/def/');
 assert.equal(exactItemLink(html,'不明'),null);
 assert.equal(exactItemLink(html+'<a href="/lodestone/playguide/db/item/aaa/">コークス</a>','コークス'),null);
});
