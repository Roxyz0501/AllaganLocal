import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {saveHistory,loadHistory,parseHistory,recoverHistoryPrefix} from '../history-store.mjs';
const point=value=>({label:'test',days:{'2026-10-18':{at:'2026-10-18T01:00:00Z',amounts:{value}}},changes:[]});
test('flushed snapshots keep one previous generation and recover corrupt main without overwriting it',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'allagan-history-')),file=path.join(dir,'history.json');
 try{
  const a={version:1,series:{a:point(10)}},b={version:1,series:{a:point(20)}};
  await saveHistory(file,a);await saveHistory(file,b);
  assert.deepEqual(parseHistory(await readFile(file+'.bak','utf8')),a);
  await writeFile(file,'{"version":1,'+'\0'.repeat(100));
  const loaded=await loadHistory(file);assert.equal(loaded.recovered,true);assert.deepEqual(loaded.ledger,a);
  assert.equal((await readdir(dir)).filter(n=>n.includes('.corrupt-')).length,1);
  assert.deepEqual((await loadHistory(file)).ledger,a);
  assert.equal((await readdir(dir)).filter(n=>n.endsWith('.tmp')).length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('offline salvage accepts only complete series and preserves older missing series',()=>{
 const base={version:1,startedAt:'2026-10-01T00:00:00Z',series:{a:point(1),b:point(2)}};
 const text=JSON.stringify({...base,series:{a:point(3),b:point(4)}});
 const broken=text.slice(0,text.indexOf(',"b":')+15)+'\0'.repeat(20);
 const result=recoverHistoryPrefix(broken,base);
 assert.equal(result.recoveredSeries,1);assert.deepEqual(result.ledger.series.a,point(3));assert.deepEqual(result.ledger.series.b,point(2));
 assert.throws(()=>parseHistory(broken),/Invalid history JSON/);
});
