import {parentPort,workerData} from 'node:worker_threads';
import {PurchaseStore} from './purchases.mjs';
const store=new PurchaseStore(workerData.file);let ack;
parentPort.on('message',async m=>{
 if(m.ack){ack?.();ack=null;return;}
 try{
  if(m.export){await store.export(m.params,m.excluded,chunk=>new Promise(resolve=>{ack=resolve;parentPort.postMessage({id:m.id,chunk});}));parentPort.postMessage({id:m.id,done:true});}
  else parentPort.postMessage({id:m.id,result:store.query(m.params,m.excluded,m.etag)});
 }catch(e){parentPort.postMessage({id:m.id,error:e.message});}
});
