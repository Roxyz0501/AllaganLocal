const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('ja-JP').format(n),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let page=1,seq=0,timer,lastPayload='',activeQuery='',activeController;
function select(id,options){const value=$(id).value;$(id).innerHTML='<option value="">すべて</option>'+options.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} @ ${esc(x.world)}</option>`).join('');if(value&&!options.some(x=>x.id===value))$(id).add(new Option('選択した対象（履歴なし）',value));$(id).value=value;}
export async function loadSales(){
  let request,controller;
  try{
    const mode=$('salesPeriod').value;$('salesDayLabel').hidden=mode!=='day';$('salesFromLabel').hidden=$('salesToLabel').hidden=mode!=='range';if(mode==='all')$('salesFrom').value=$('salesTo').value='';if(mode==='day')$('salesFrom').value=$('salesTo').value=$('salesDay').value;
    if(mode==='today'||mode==='yesterday'){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());$('salesFrom').value=$('salesTo').value=mode==='yesterday'?new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10):today;}
    const p=new URLSearchParams({q:$('salesSearch').value,character:$('salesCharacter').value,retainer:$('salesRetainer').value,from:$('salesFrom').value,to:$('salesTo').value,page:String(page)});
    const query=p.toString();if(activeController&&activeQuery===query)return;activeController?.abort();controller=new AbortController();activeController=controller;activeQuery=query;request=++seq;
    const res=await fetch('/api/sales?'+p,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}),data=await res.json();if(!res.ok)throw new Error(data.error||'販売履歴を読み込めません。');if(request!==seq)return;
    $('salesWarning').hidden=!data.error&&!data.nameWarning;$('salesWarning').textContent=[data.error,data.nameWarning].filter(Boolean).join(' ');
    const signature=JSON.stringify(data);if(signature===lastPayload)return;
    page=data.page;select('salesCharacter',data.characters);select('salesRetainer',data.retainers);
    $('salesWarning').hidden=!data.error&&!data.nameWarning;$('salesWarning').textContent=[data.error,data.nameWarning].filter(Boolean).join(' ');
    $('salesCount').textContent=fmt(data.summary.count);$('salesQuantity').textContent=fmt(data.summary.quantity);$('salesGross').textContent=fmt(data.summary.gross);const fee=Math.floor(data.summary.gross*0.1);$('salesFee').textContent=`手数料10%（概算） ${fmt(fee)} G ／ 差引 ${fmt(data.summary.gross-fee)} G`;
    renderSalesChart(data);
    const open=new Set([...document.querySelectorAll('#salesGroups details[open]')].map(x=>x.dataset.group));
    $('salesGroups').innerHTML=data.groups.map(g=>`<details data-group="${esc(g.id)}" ${open.has(g.id)||data.groups.length===1?'open':''}><summary><span>${esc(g.name)} <small>@ ${esc(g.world)}</small></span><strong>${fmt(g.gross)} <small>ギル</small></strong><small>${fmt(g.count)}件</small></summary><div class="retainer-sales">${g.retainers.map(r=>`<button data-sales-retainer="${esc(r.id)}" data-sales-character="${esc(g.id)}"><span>${esc(r.name)}</span><strong>${fmt(r.gross)} G</strong><small>${fmt(r.count)}件 · ${fmt(r.quantity)}個</small></button>`).join('')}</div></details>`).join('')||'<p class="muted">表示できる記録がありません。</p>';
    $('salesRows').innerHTML=data.items.map(r=>`<tr><td>${esc(r.detectedAt.replace('T',' '))}</td><td><div class="item-identity"><img class="item-icon" data-image="/api/icon/${r.itemId}" alt="" width="40" height="40" loading="lazy" decoding="async"><div><button class="item-name" data-money-history="item:${r.itemId}">${esc(r.name)}</button> <span class="quality-badge">${r.hq?'HQ':'NQ'}</span><div class="item-category">#${r.itemId}</div></div></div></td><td>${esc(r.characterName)}<div class="item-category">${esc(r.retainerName)} @ ${esc(r.world)}</div><div class="item-category">マーケット出品</div></td><td class="number">${fmt(r.quantity)}</td><td class="number">${fmt(r.unitPrice)} G</td><td class="number sell-total">${fmt(r.gross)} G</td></tr>`).join('');
    $('salesResult').textContent=`${fmt(data.total)}件の記録`;$('salesEmpty').hidden=data.total>0;$('salesPage').textContent=`${data.page} / ${data.pages} ページ`;$('salesPrev').disabled=data.page<=1;$('salesNext').disabled=data.page>=data.pages;
    $('salesUpdated').textContent='ファイル保存: '+(data.updatedAt?new Date(data.updatedAt).toLocaleString('ja-JP'):'未読込');$('salesRange').textContent=data.range?`保存されている記録の期間: ${data.range.from.replace('T',' ')} ～ ${data.range.to.replace('T',' ')}`:'売却記録がまだありません。';
    lastPayload=signature;
  }catch(e){if(request===seq&&!controller?.signal.aborted){$('salesWarning').hidden=false;$('salesWarning').textContent=(e.name==='TimeoutError'?'販売履歴の応答が遅れています。':e.message)+' 前回の表示を保持し、自動で再試行します。';}}finally{if(activeController===controller){activeController=null;activeQuery='';}}
}
for(const id of ['salesCharacter','salesRetainer','salesFrom','salesTo','salesDay'])$(id).onchange=()=>{if(id==='salesCharacter')$('salesRetainer').value='';page=1;loadSales();};
$('salesSearch').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{page=1;loadSales();},250);};
$('salesClear').onclick=()=>{$('salesPeriod').value='all';$('salesFrom').disabled=$('salesTo').disabled=false;for(const id of ['salesSearch','salesCharacter','salesRetainer','salesFrom','salesTo'])$(id).value='';page=1;loadSales();};
$('salesPrev').onclick=()=>{page--;loadSales();};$('salesNext').onclick=()=>{page++;loadSales();};
$('salesGroups').onclick=e=>{const b=e.target.closest('[data-sales-retainer]');if(!b)return;$('salesCharacter').value=b.dataset.salesCharacter;$('salesRetainer').value=b.dataset.salesRetainer;page=1;loadSales();};

$('salesDay').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
$('salesPeriod').onchange=()=>{const today=['today','yesterday'].includes($('salesPeriod').value);$('salesFrom').disabled=$('salesTo').disabled=today;if(!today)$('salesFrom').value=$('salesTo').value='';page=1;loadSales();};

export async function openRetainerSales(retainer,character){
 page=1;lastPayload='';$('salesPeriod').value='all';
 for(const id of ['salesSearch','salesCharacter','salesRetainer','salesFrom','salesTo'])$(id).value='';
 $('salesFrom').disabled=$('salesTo').disabled=false;
 const option=(id,value)=>{if(value&&!Array.from($(id).options).some(o=>o.value===value))$(id).add(new Option(value,value));$(id).value=value;};
 option('salesCharacter',character);option('salesRetainer',retainer);await loadSales();
}

export function salesNavigation(){return {page};}
export function restoreSalesNavigation(saved){page=saved?.page||1;return loadSales();}

function renderSalesChart(data){
 const host=$('salesChart'),points=data.chart||[],hourly=data.chartUnit==='hour';
 if(!points.length){host.innerHTML='<h2>販売額の推移</h2><p>この条件の販売記録はありません。</p>';return;}
 const W=1000,H=280,L=100,R=25,T=20,B=55,max=Math.max(1,...points.map(p=>p.gross));
 const timestamp=p=>Date.parse(p.date+(hourly?':00:00+09:00':'T00:00:00+09:00')),start=timestamp(points[0]),end=timestamp(points.at(-1));
 const x=p=>L+(end===start?.5:(timestamp(p)-start)/(end-start))*(W-L-R),y=p=>T+(1-p.gross/max)*(H-T-B);
 const label=p=>p.date.replace('T',' ')+(hourly?'時台':'');
 const ticks=Array.from({length:4},(_,i)=>{const v=max*i/3,py=T+(1-i/3)*(H-T-B);return `<line x1="${L}" x2="${W-R}" y1="${py}" y2="${py}" stroke="#bbb"/><text x="${L-10}" y="${py+4}" text-anchor="end">${fmt(Math.round(v))}</text>`;}).join('');
 const line=points.map((p,i)=>(i?'L':'M')+x(p)+','+y(p)).join(' ');
 host.innerHTML=`<h2>販売額の推移</h2><p>${hourly?'時間帯別':'日別'}の販売額（手数料差引前・G）。記録された販売分を集計しています。</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="販売額の推移">${ticks}<path d="${line}" fill="none" stroke="#668bca" stroke-width="3"/>${points.map(p=>`<circle cx="${x(p)}" cy="${y(p)}" r="5" fill="#668bca" tabindex="0" aria-label="${esc(label(p))} ${fmt(p.gross)} G / ${fmt(p.count)}件"><title>${esc(label(p))}：${fmt(p.gross)} G</title></circle>`).join('')}<text x="${L}" y="${H-12}">${esc(label(points[0]))}</text><text x="${W-R}" y="${H-12}" text-anchor="end">${points.length>1?esc(label(points.at(-1))):''}</text></svg>`;
}
const salesTip=document.createElement('div');salesTip.className='money-tooltip';salesTip.hidden=true;salesTip.setAttribute('role','tooltip');document.body.append(salesTip);
function showSalesTip(e){const p=e.target.closest('circle');if(!p)return;const rect=p.getBoundingClientRect();salesTip.textContent=p.getAttribute('aria-label');salesTip.hidden=false;salesTip.style.left=Math.max(8,Math.min(innerWidth-300,e.clientX||rect.x))+'px';salesTip.style.top=Math.max(8,(e.clientY||rect.y)-55)+'px';}
$('salesChart').addEventListener('pointerover',showSalesTip);$('salesChart').addEventListener('focusin',showSalesTip);for(const event of ['pointerout','focusout'])$('salesChart').addEventListener(event,()=>salesTip.hidden=true);
