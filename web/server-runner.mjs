// The server owns its log sink so game/plugin shutdown cannot break output pipes.
import {appendFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const data=process.env.ALLAGAN_DATA_DIR;
if(!data)throw new Error('ALLAGAN_DATA_DIR is required');
mkdirSync(data,{recursive:true});
for(const [stream,label] of [[process.stdout,''],[process.stderr,'ERROR ']]){
 stream.write=(chunk,encoding,callback)=>{
  try{appendFileSync(path.join(data,'dashboard.log'),`${new Date().toISOString()} ${label}${String(chunk)}`);}catch{}
  const done=typeof encoding==='function'?encoding:callback;if(done)done();return true;
 };
}
await import('./server.mjs');
