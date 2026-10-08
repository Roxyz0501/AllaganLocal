// Keep image downloads from occupying every localhost connection used by UI APIs.
const placeholder='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="80" height="80" fill="%23e5ece5"/%3E%3C/svg%3E';
const tracked=new Set(),ready=new Set(),active=new Map();
const visible=img=>img.isConnected&&img.getClientRects().length>0;
function pump(){
 for(const img of ready){
  if(active.size>=3)break;
  ready.delete(img);if(!visible(img)||img.dataset.imageDone)continue;
  let timer;
  const finish=()=>{clearTimeout(timer);img.removeEventListener('load',loaded);img.removeEventListener('error',failed);active.delete(img);pump();};
  const loaded=()=>{img.dataset.imageDone='1';observer.unobserve(img);tracked.delete(img);finish();};
  const failed=()=>{img.dataset.imageDone='1';observer.unobserve(img);tracked.delete(img);finish();img.src=placeholder;};
  active.set(img,()=>{finish();img.src=placeholder;});
  img.addEventListener('load',loaded,{once:true});img.addEventListener('error',failed,{once:true});
  img.loading='eager';img.decoding='async';img.fetchPriority='low';img.src=img.dataset.image;
  timer=setTimeout(failed,30000);
 }
}
const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting&&!active.has(e.target)&&!e.target.dataset.imageDone)ready.add(e.target);else if(!e.isIntersecting)ready.delete(e.target);}pump();},{rootMargin:'80px'});
let scheduled=false;
function scan(){
 scheduled=false;
 for(const img of tracked)if(!img.isConnected){ready.delete(img);observer.unobserve(img);tracked.delete(img);active.get(img)?.();}
 for(const [img,cancel] of active)if(!visible(img)){cancel();observer.unobserve(img);observer.observe(img);}
 for(const img of document.querySelectorAll('img[data-image]:not([data-image-done])'))if(!tracked.has(img)){tracked.add(img);img.src=placeholder;observer.observe(img);}
 pump();
}
new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(scan);}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']});
scan();
