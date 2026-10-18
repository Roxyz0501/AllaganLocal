import {Worker} from 'node:worker_threads';
export function createPurchaseService(file){
 let worker,seq=0;const pending=new Map(),inflight=new Map();let exporting=false;
 const get=()=>{if(!worker){worker=new Worker(new URL('./purchases-worker.mjs',import.meta.url),{workerData:{file}});worker.unref();worker.on('message',m=>{const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.result);});worker.on('error',e=>{for(const p of pending.values())p.reject(e);pending.clear();worker=null;});worker.on('exit',()=>{for(const p of pending.values())p.reject(new Error('購入履歴の読み込みが停止しました。'));pending.clear();worker=null;});}return worker;};
 return {
  query(params,excluded,etag){const key=JSON.stringify([params,excluded,etag]);if(inflight.has(key))return inflight.get(key);if(pending.size>=16)return Promise.reject(new Error('購入履歴の読み込み中です。少し待ってから再試行してください。'));const promise=new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});get().postMessage({id,params,excluded,etag});}).finally(()=>inflight.delete(key));inflight.set(key,promise);return promise;},
  async *csv(params,excluded){
   if(exporting)throw new Error('CSV出力中です。');exporting=true;
   const w=new Worker(new URL('./purchases-worker.mjs',import.meta.url),{workerData:{file}});let next,queued;
   const receive=()=>queued?Promise.resolve(queued):new Promise(resolve=>next=resolve);
   const deliver=m=>{if(next){next(m);next=null;}else queued=m;};
   w.on('message',deliver);w.on('error',e=>deliver({error:e.message}));w.on('exit',code=>{if(code)deliver({error:'CSV出力が停止しました。'});});
   w.postMessage({id:1,export:true,params,excluded});
   try{while(true){const m=await receive();queued=null;if(m.error)throw new Error(m.error);if(m.done)break;yield m.chunk;w.postMessage({ack:true});}}finally{await w.terminate();exporting=false;}
  },
  close(){return worker?.terminate();}
 };
}
