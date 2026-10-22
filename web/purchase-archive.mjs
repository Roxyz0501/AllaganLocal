import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
// Read-only archive adapter; only the disposable in-memory index is written.
export function resolvePurchaseSource(file){
 let root;try{if(statSync(file).isDirectory())root=file;}catch{}
 if(!root)return {file};
 const manifest=JSON.parse(readFileSync(path.join(root,'manifest.json'),'utf8'));
 if(manifest.Format!==1||manifest.Layout!=='yyyy-MM-dd/sha256(id).json')throw Error('Unsupported Gil Ledger archive');
 const compatible=path.resolve(root,manifest.CompatibilityDatabase);
 if(path.dirname(compatible)!==path.dirname(root))throw Error('Invalid compatibility database path');
 try{if(statSync(compatible).isFile())return {file:compatible};}catch{}
 return {root};
}
export function indexPurchaseArchive(root){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA user_version=2;CREATE TABLE characters(cid TEXT PRIMARY KEY,name TEXT,home TEXT);CREATE TABLE purchases(id TEXT PRIMARY KEY,time INTEGER,cid TEXT,character TEXT,home TEXT,world TEXT,item INTEGER,name TEXT,hq INTEGER,quantity INTEGER,unit INTEGER,tax INTEGER,subtotal INTEGER,total INTEGER,listing TEXT,retainer TEXT,seller TEXT,city INTEGER,source INTEGER,tax_known INTEGER);CREATE INDEX purchase_time ON purchases(time,id);CREATE INDEX purchase_character_time ON purchases(cid,time,id)');
 let count=0;const hash=createHash('sha256');const put=db.prepare('INSERT INTO purchases VALUES('+Array(20).fill('?').join(',')+')'),owner=db.prepare('INSERT OR REPLACE INTO characters VALUES(?,?,?)');
 try{db.exec('BEGIN');for(const day of readdirSync(root,{withFileTypes:true})){if(!day.isDirectory()||!/^\d{4}-\d{2}-\d{2}$/.test(day.name))continue;for(const name of readdirSync(path.join(root,day.name))){if(!/^[a-f0-9]{64}\.json$/.test(name))continue;if(++count>100000)throw Error('Archive index limit exceeded; use the compatibility database');const file=path.join(root,day.name,name),info=statSync(file);if(info.size>1024*1024)throw Error('Archive record too large');const text=readFileSync(file,'utf8'),entry=JSON.parse(text),p=entry.Purchase,c=p?.Character;if(entry.Format!==1||!p||!c||createHash('sha256').update(p.Id).digest('hex')+'.json'!==name)throw Error('Invalid archive transaction');hash.update(text);owner.run(c.Id,c.Name,c.HomeWorld);put.run(p.Id,p.Time,c.Id,c.Name,c.HomeWorld,c.World,p.ItemId,p.ItemName,p.Hq?1:0,p.Quantity,p.UnitPrice,p.Tax,p.Subtotal??p.Quantity*p.UnitPrice,p.Total??p.PaidAmount??p.Quantity*p.UnitPrice+p.Tax,p.ListingId,p.RetainerId,p.RetainerName,p.RetainerCity,p.Source??0,p.TaxKnown===false?0:1);}}db.exec('COMMIT;PRAGMA query_only=ON');return {db,identity:'archive:'+hash.digest('hex')};}catch(e){db.close();throw e;}
}
