import {Worker} from 'node:worker_threads';
export function createPurchaseService(file,{WorkerClass=Worker}={}){
 let worker,seq=0,closed=false,exporting=false;const exports=new Map(),pending=new Map(),inflight=new Map();
 const rejectPending=e=>{for(const p of pending.values())p.reject(e);pending.clear();};
 const get=()=>{
  if(closed)throw Error('Purchase service closed');
  if(!worker){const current=new WorkerClass(new URL('./purchases-worker.mjs',import.meta.url),{workerData:{file}});worker=current;current.unref();
   current.on('message',m=>{if(worker!==current)return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.result);});
   const failed=e=>{if(worker!==current)return;worker=null;rejectPending(e);};
   current.on('error',failed);current.on('exit',()=>failed(new Error('購入履歴の読み込みが停止しました。')));
  }return worker;
 };
 return {
  query(params,excluded,etag){
   if(closed)return Promise.reject(Error('Purchase service closed'));
   const key=JSON.stringify([params,excluded,etag]);if(inflight.has(key))return inflight.get(key);
   if(pending.size>=16)return Promise.reject(new Error('購入履歴の読み込み中です。少し待ってから再試行してください。'));
   let current;try{current=get();}catch(e){return Promise.reject(e);}
   const promise=new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});try{current.postMessage({id,params,excluded,etag});}catch(e){pending.delete(id);reject(e);}}).finally(()=>inflight.delete(key));inflight.set(key,promise);return promise;
  },
  async *csv(params,excluded){
   if(closed)throw Error('Purchase service closed');if(exporting)throw new Error('CSV出力中です。');exporting=true;
   let current,next,queued,done=false;
   const receive=()=>queued?Promise.resolve(queued):new Promise(resolve=>next=resolve);
   const deliver=m=>{if(next){next(m);next=null;}else queued=m;};
   try{
    current=new WorkerClass(new URL('./purchases-worker.mjs',import.meta.url),{workerData:{file}});exports.set(current,deliver);
    current.on('message',deliver);current.on('error',e=>deliver({error:e.message}));current.on('exit',()=>{if(!done)deliver({error:'CSV出力が停止しました。'});});
    current.postMessage({id:1,export:true,params,excluded});
    while(true){const m=await receive();queued=null;if(m.error)throw new Error(m.error);if(m.done){done=true;break;}yield m.chunk;current.postMessage({ack:true});}
   }finally{done=true;if(current){exports.delete(current);await current.terminate();}exporting=false;}
  },
  async close(){closed=true;rejectPending(Error('Purchase service closed'));const workers=[worker,...exports.keys()].filter(Boolean);worker=null;for(const deliver of exports.values())deliver({error:'Purchase service closed'});await Promise.all(workers.map(w=>w.terminate()));}
 };
}
