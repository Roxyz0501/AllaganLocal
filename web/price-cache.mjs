import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
// Public, replaceable quotes only. Each flush updates dirty keys in one transaction.
export async function openPriceCache(file){
 await mkdir(path.dirname(file),{recursive:true});
 const db=new DatabaseSync(file+'.sqlite');db.exec('PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const cache={items:{},marketable:[],updatedAt:null},saved=new Map(),dirty=new Map();
 for(const r of db.prepare('SELECT key,value FROM cache').iterate()){saved.set(r.key,r.value);if(r.key.startsWith('item:'))cache.items[r.key.slice(5)]=JSON.parse(r.value);else cache[r.key]=JSON.parse(r.value);}
 let legacy=false;if(!saved.size){try{Object.assign(cache,JSON.parse(await readFile(file,'utf8')));legacy=true;}catch(e){if(e.code!=='ENOENT')throw e;}for(const key of ['marketable','updatedAt'])saved.set(key,JSON.stringify(cache[key]));}
 const metrics={writes:0,logicalBytes:0,transactions:0};let closed=false;
 function mark(key,value){const text=JSON.stringify(value);if(saved.get(key)===text){dirty.delete(key);return;}dirty.set(key,text);}
 function flush(){if(closed)throw Error('Price cache closed');if(!dirty.size)return;const entries=[...dirty];db.exec('BEGIN IMMEDIATE');try{const put=db.prepare('INSERT INTO cache VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');for(const [key,text]of entries)put.run(key,text);db.exec('COMMIT');for(const [key,text]of entries){saved.set(key,text);dirty.delete(key);metrics.writes++;metrics.logicalBytes+=Buffer.byteLength(text);}metrics.transactions++;}catch(e){db.exec('ROLLBACK');throw e;}}
 if(legacy){for(const [id,item]of Object.entries(cache.items))mark('item:'+id,item);for(const key of ['marketable','updatedAt']){saved.delete(key);mark(key,cache[key]);}flush();}
 return {cache,metrics,item(id){mark('item:'+id,cache.items[id]);},meta(){mark('marketable',cache.marketable);mark('updatedAt',cache.updatedAt);},flush,close(){if(closed)return;flush();closed=true;db.close();}};
}
