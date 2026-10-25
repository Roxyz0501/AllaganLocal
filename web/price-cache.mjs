import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
// Public, replaceable quotes only. Each flush updates dirty keys in one transaction.
export async function openPriceCache(file){
 await mkdir(path.dirname(file),{recursive:true});
 const database=file+'.sqlite',schema='PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,value TEXT NOT NULL)';
 const empty=()=>({items:{},marketable:[],updatedAt:null});let cache=empty(),saved=new Map(),dirty=new Map(),db;
 const invalid=()=>{const e=Error('Invalid price cache');e.corruptCache=true;throw e;};
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const validate=c=>{if(!object(c.items)||!Array.isArray(c.marketable)||c.marketable.some(id=>!Number.isSafeInteger(id)||id<=0)||(c.updatedAt!==null&&typeof c.updatedAt!=='string'))invalid();for(const [id,item]of Object.entries(c.items))if(!/^\d+$/.test(id)||!object(item)||!object(item.worlds))invalid();};
 const preserve=async source=>{try{await rename(source,source+'.corrupt-'+randomUUID());}catch(e){if(e.code!=='ENOENT')throw e;}};
 try{db=new DatabaseSync(database);db.exec(schema);for(const r of db.prepare('SELECT key,value FROM cache').iterate()){saved.set(r.key,r.value);if(r.key.startsWith('item:'))cache.items[r.key.slice(5)]=JSON.parse(r.value);else if(['marketable','updatedAt'].includes(r.key))cache[r.key]=JSON.parse(r.value);}validate(cache);}
 catch(e){try{db?.close();}catch{}if(!(e.corruptCache||e instanceof SyntaxError||[11,26].includes(e.errcode)))throw e;for(const source of [database,database+'-wal',database+'-shm'])await preserve(source);cache=empty();saved=new Map();db=new DatabaseSync(database);db.exec(schema);}
 let legacy=false;if(!saved.size){try{const value=JSON.parse(await readFile(file,'utf8')),candidate={...empty(),...value};validate(candidate);cache=candidate;legacy=true;}catch(e){if(e instanceof SyntaxError||e.corruptCache)await preserve(file);else if(e.code!=='ENOENT'){db.close();throw e;}}for(const key of ['marketable','updatedAt'])saved.set(key,JSON.stringify(cache[key]));}
 const metrics={writes:0,logicalBytes:0,transactions:0};let closed=false;
 function mark(key,value){const text=JSON.stringify(value);if(saved.get(key)===text){dirty.delete(key);return;}dirty.set(key,text);}
 function flush(){if(closed)throw Error('Price cache closed');if(!dirty.size)return;const entries=[...dirty];db.exec('BEGIN IMMEDIATE');try{const put=db.prepare('INSERT INTO cache VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');for(const [key,text]of entries)put.run(key,text);db.exec('COMMIT');for(const [key,text]of entries){saved.set(key,text);dirty.delete(key);metrics.writes++;metrics.logicalBytes+=Buffer.byteLength(text);}metrics.transactions++;}catch(e){db.exec('ROLLBACK');throw e;}}
 if(legacy){for(const [id,item]of Object.entries(cache.items))mark('item:'+id,item);for(const key of ['marketable','updatedAt']){saved.delete(key);mark(key,cache[key]);}flush();}
 return {cache,metrics,item(id){mark('item:'+id,cache.items[id]);},meta(){mark('marketable',cache.marketable);mark('updatedAt',cache.updatedAt);},flush,close(){if(closed)return;flush();closed=true;db.close();}};
}
