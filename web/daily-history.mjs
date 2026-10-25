import {DatabaseSync} from 'node:sqlite';
import {mkdir,readdir,readFile,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {parseHistory} from './history-store.mjs';
import {japanDay} from './ledger.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex');
const schema=`CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, key TEXT NOT NULL, label TEXT NOT NULL, at TEXT NOT NULL, payload TEXT NOT NULL, changed INTEGER NOT NULL, daily INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS event_key_time ON events(key,at);CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)`;
export class DailyHistory {
 constructor(legacy,{fault=()=>{}}={}){this.legacy=legacy;this.dir=path.join(path.dirname(legacy),'history-days');this.fault=fault;this.queue=Promise.resolve();this.closed=false;this.ranges=new Map();this.failures=0;this.metrics={transactions:0,events:0,logicalBytes:0,reads:0};}
 async days(){try{return(await readdir(this.dir)).filter(n=>/^\d{4}-\d{2}-\d{2}\.sqlite$/.test(n)).sort();}catch(e){if(e.code==='ENOENT')return[];throw e;}}
 async append(events,startedAt){if(this.closed)throw Error('History closed');if(this.failures>=3)throw Error('History saving paused; explicit retry required');
 const task=this.queue.then(async()=>{if(this.failures>=3)throw Error('History saving paused; explicit retry required');try{await this.write(events,startedAt);this.failures=0;}catch(e){this.failures++;throw e;}});this.queue=task.catch(()=>{});return task;}
 async write(events,startedAt){if(!events.length)return;await mkdir(this.dir,{recursive:true});const groups=Map.groupBy(events,e=>japanDay(new Date(e.point.at)));
 for(const [day,rows] of groups){const db=new DatabaseSync(path.join(this.dir,day+'.sqlite'));try{db.exec('PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;'+schema);const put=db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?)'),existing=db.prepare('SELECT key,label,at,payload,changed,daily FROM events WHERE id=?');
 for(let offset=0;offset<rows.length;offset+=500){db.exec('BEGIN IMMEDIATE');let count=0,bytes=0;try{for(const e of rows.slice(offset,offset+500)){const payload=JSON.stringify(e.point.amounts),entry=[e.key,e.label,e.point.at,payload,e.changed?1:0,e.daily===false?0:1],id=e.id||digest(JSON.stringify(entry));const r=put.run(id,...entry);if(r.changes){count++;bytes+=Buffer.byteLength(JSON.stringify([id,...entry]));}else{const old=existing.get(id);if(!old||JSON.stringify([old.key,old.label,old.at,old.payload,old.changed,old.daily])!==JSON.stringify(entry))throw Error('History event ID conflicts with stored contents');}}if(startedAt)db.prepare("INSERT OR IGNORE INTO metadata VALUES('startedAt',?)").run(startedAt);this.fault('beforeCommit');db.exec('COMMIT');this.metrics.transactions+=count?1:0;this.metrics.events+=count;if(count)this.ranges.clear();this.metrics.logicalBytes+=bytes;this.fault('afterCommit');}catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}}
 }finally{db.close();}}
 }
 async read({from='',to='',latestOnly=false}={}){const cacheKey=from+'|'+to;const cached=(from||to)&&!latestOnly?this.ranges.get(cacheKey):null;if(cached&&cached.expires>Date.now())return cached.ledger;const ledger={version:1,series:{}};const files=await this.days();for(const file of latestOnly?files.toReversed():files){{const day=file.slice(0,10);if(!latestOnly&&((from&&day<from)||(to&&day>to)))continue;}const db=new DatabaseSync(path.join(this.dir,file),{readOnly:true});try{const start=db.prepare("SELECT value FROM metadata WHERE key='startedAt'").get()?.value;if(start&&(!ledger.startedAt||start<ledger.startedAt))ledger.startedAt=start;
 const query=db.prepare(latestOnly?'SELECT key,label,at,payload,changed,daily FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY key ORDER BY at DESC,rowid DESC) AS rank FROM events) WHERE rank=1':'SELECT key,label,at,payload,changed,daily FROM events ORDER BY at,rowid');for(const r of query.iterate()){this.metrics.reads++;const point={at:r.at,amounts:JSON.parse(r.payload)},s=ledger.series[r.key]??={label:r.label,days:{},changes:[]};if(latestOnly){if(!s.changes.length)s.changes.push(point);if(file.slice(0,10)>=new Date(Date.now()-86400000+32400000).toISOString().slice(0,10))s.days[file.slice(0,10)]=point;}else{s.label=r.label;if(r.daily)s.days[file.slice(0,10)]=point;if(r.changed)s.changes.push(point);}}
 }finally{db.close();}}
 if(from&&!latestOnly){const found=new Set();for(const file of files.toReversed()){if(file.slice(0,10)>=from)continue;const db=new DatabaseSync(path.join(this.dir,file),{readOnly:true});try{for(const r of db.prepare('SELECT key,label,at,payload FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY key ORDER BY at DESC,rowid DESC) AS rank FROM events WHERE changed=1) WHERE rank=1').iterate()){if(found.has(r.key))continue;found.add(r.key);this.metrics.reads++;const s=ledger.series[r.key]??={label:r.label,days:{},changes:[]};s.changes.unshift({at:r.at,amounts:JSON.parse(r.payload)});}}finally{db.close();}}}
 if((from||to)&&!latestOnly){const bytes=Buffer.byteLength(JSON.stringify(ledger));if(bytes<=8*1024*1024){this.ranges.set(cacheKey,{ledger,bytes,expires:Date.now()+120000});while(this.ranges.size>4||[...this.ranges.values()].reduce((n,x)=>n+x.bytes,0)>16*1024*1024)this.ranges.delete(this.ranges.keys().next().value);}}return ledger;}
 async load(options={}){
 // Migration is idempotent: immutable event hashes deduplicate committed chunks after interruption.
 // The legacy original and backup are never changed or deleted.
 const marker=path.join(this.dir,'migration.json');let done=false;try{done=JSON.parse(await readFile(marker,'utf8')).complete===true;}catch{}
 if(done)return this.read(options);
 let legacy;try{legacy=parseHistory(await readFile(this.legacy,'utf8'));}catch(e){try{legacy=parseHistory(await readFile(this.legacy+'.bak','utf8'));}catch(b){if(e.code!=='ENOENT'||b.code!=='ENOENT')throw Error('Legacy history invalid; originals preserved');}}
 if(legacy&&!done){let batch=[];for(const [key,s] of Object.entries(legacy.series)){for(const [ordinal,p] of s.changes.entries()){batch.push({id:digest(JSON.stringify([key,ordinal,p])),key,label:s.label,point:p,changed:true,daily:false});if(batch.length>=500){await this.append(batch,legacy.startedAt);batch=[];}}for(const point of Object.values(s.days)){batch.push({key,label:s.label,point,changed:false});if(batch.length>=500){await this.append(batch,legacy.startedAt);batch=[];}}}await this.append(batch,legacy.startedAt);
 // Every imported ID and full record is validated by write(), including existing rows.
 // Newer events are intentionally retained when a missing marker causes a replay.
 const {open}=await import('node:fs/promises');await mkdir(this.dir,{recursive:true});const handle=await open(marker+'.tmp','w');try{await handle.writeFile(JSON.stringify({complete:true,sourceHash:digest(JSON.stringify(legacy)),series:Object.keys(legacy.series).length}));await handle.sync();}finally{await handle.close();}await rename(marker+'.tmp',marker);
 }
 return this.read(options);
 }
 async flush(){await this.queue;}
 async close(){this.closed=true;await this.flush();}
 retry(){this.failures=0;}
}
