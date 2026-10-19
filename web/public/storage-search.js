const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function storageSearchForm(key,defs){
 const parts=key.split(':'),group=defs.find(d=>d[0]===parts[1]);
 const scope={owner:parts[0]==='owner'||parts[0]==='retainers'?parts[1]:parts[0],...(parts[0]==='retainers'?{children:'1',retainersOnly:'1'}:{}),...(group?{searchCategories:group[2].join(',')}:{})};
 return `<form class="storage-node-search" data-search-scope="${esc(JSON.stringify(scope))}"><label>アイテム検索 <input type="search" name="query" maxlength="120" placeholder="アイテム名" autocomplete="off"></label><button type="submit">検索</button><button type="reset">クリア</button><output aria-live="polite"></output></form><section class="storage-search-results" hidden></section>`;
}
export function bindStorageSearch(root){
 const pending=new WeakMap(),recent=new WeakMap();
 async function run(form,page=1){
  const signature=form.elements.query.value.trim()+':'+page,previous=recent.get(form);
  if(previous?.signature===signature&&Date.now()-previous.time<30000)return;
  pending.get(form)?.abort();const controller=new AbortController();pending.set(form,controller);
  const result=form.nextElementSibling,query=form.elements.query.value.trim(),output=form.querySelector('output');
  if(!query){recent.delete(form);result.hidden=true;result.nextElementSibling.hidden=false;result.replaceChildren();output.textContent='';return;}
  output.textContent='検索中…';
  try{
   const params=new URLSearchParams({...JSON.parse(form.dataset.searchScope),search:query,searchPage:String(page)});
   const response=await fetch('/api/storage?'+params,{signal:controller.signal});if(!response.ok)throw new Error(String(response.status));
   const d=await response.json();if(!form.isConnected||pending.get(form)!==controller)return;
   recent.set(form,{signature,time:Date.now()});
   output.textContent=String(d.matches);result.hidden=false;result.nextElementSibling.hidden=true;
   result.innerHTML=d.containers.map(c=>{const owner=d.owners.find(o=>o.id===c.owner);return `<details open class="storage-search-location"><summary><span translate="no">${esc(owner?.name)} @ ${esc(owner?.world)}</span> · ${esc(c.name)}</summary>${c.items.map(r=>`<button class="storage-search-hit" data-search-item="${r.id}" data-search-owner="${esc(c.owner)}" data-search-character="${esc(owner?.type==='キャラクター'?owner.id:owner?.parentIds?.[0]||'')}"><img src="/api/icon/${r.id}" width="40" height="40" loading="lazy" alt=""><mark translate="no">${esc(r.name)}</mark><span>${r.hq?'HQ · ':''}× ${r.quantity} · #${r.slot+1}</span></button>`).join('')}</details>`;}).join('')||'<p>該当するアイテムはありません。</p>';
   if(d.pages>1)result.insertAdjacentHTML('beforeend',`<nav><button data-search-page="${d.page-1}" ${d.page<=1?'disabled':''}>← 前へ</button> ${d.page} / ${d.pages} <button data-search-page="${d.page+1}" ${d.page>=d.pages?'disabled':''}>次へ →</button></nav>`);
  }catch(e){if(e.name!=='AbortError'&&form.isConnected)output.textContent='検索に失敗しました。再試行してください。';}
 }
 root.addEventListener('submit',e=>{if(!e.target.matches('.storage-node-search'))return;e.preventDefault();run(e.target);});
 root.addEventListener('reset',e=>{if(!e.target.matches('.storage-node-search'))return;pending.get(e.target)?.abort();recent.delete(e.target);const result=e.target.nextElementSibling;result.hidden=true;result.nextElementSibling.hidden=false;result.replaceChildren();e.target.querySelector('output').textContent='';});
 root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.searchPage)run(b.closest('.storage-search-results').previousElementSibling,Number(b.dataset.searchPage));if(b.dataset.searchItem)document.dispatchEvent(new CustomEvent('open-item-detail',{detail:{id:Number(b.dataset.searchItem),owner:b.dataset.searchOwner,character:b.dataset.searchCharacter}}));});
}
