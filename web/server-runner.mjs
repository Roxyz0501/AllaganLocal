// The server owns its log sink so game/plugin shutdown cannot break output pipes.
import {appendFileSync,mkdirSync,statSync,renameSync,existsSync,unlinkSync} from 'node:fs';
import path from 'node:path';
const data=process.env.ALLAGAN_DATA_DIR;
if(!data)throw new Error('ALLAGAN_DATA_DIR is required');
mkdirSync(data,{recursive:true});
for(const [stream,label] of [[process.stdout,''],[process.stderr,'ERROR ']]){
 stream.write=(chunk,encoding,callback)=>{
  try{const file=path.join(data,'dashboard.log');if(existsSync(file)&&statSync(file).size>=2*1024*1024){if(existsSync(file+'.3'))unlinkSync(file+'.3');for(let i=2;i>=1;i--)if(existsSync(file+'.'+i))renameSync(file+'.'+i,file+'.'+(i+1));renameSync(file,file+'.1');}appendFileSync(file,`${new Date().toISOString()} ${label}${String(chunk)}`);}catch{}
  const done=typeof encoding==='function'?encoding:callback;if(done)done();return true;
 };
}
await import('./server.mjs');
