let csvParams=new URLSearchParams();
import {pagedSource,purchaseColumns,purchaseRow} from './csv-sources.js';
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('ja-JP').format(n),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const section=document.createElement('section');section.id='purchasesView';section.hidden=true;
section.innerHTML=`<p class="exclusion-help">購入履歴元: Gil Ledger。購入履歴の利用にはGil Ledgerの導入と記録が必要です。通常の購入合計には未分類・資金移動を含めません。除外キャラクターは集計対象外です。</p>
<section class="collection"><div class="toolbar purchase-filters">
<label>検索<input id="purchaseSearch" type="search" placeholder="アイテム・購入元・ID"></label>
<label>キャラクター<select id="purchaseCharacter"><option value="">すべて</option></select></label>
<label>購入先<select id="purchaseSource"><option value="purchases">購入（マーケット・NPC）</option><option value="0">マーケット</option><option value="1">NPC購入</option><option value="2">未分類</option><option value="3">資金移動</option><option value="all">すべて</option></select></label>
<label>購入ワールド<select id="purchaseWorld"><option value="">すべて</option></select></label>
<label>品質<select id="purchaseQuality"><option value="all">すべて</option><option value="nq">NQ</option><option value="hq">HQ</option></select></label>
<label>期間<select id="purchasePeriod"><option value="all">全期間</option><option value="today">今日</option><option value="yesterday">昨日</option><option value="day">日付指定</option><option value="range">期間指定</option></select></label>
<label id="purchaseDayLabel" hidden>日付<input id="purchaseDay" type="date"></label><label id="purchaseFromLabel" hidden>開始日<input id="purchaseFrom" type="date"></label><label id="purchaseToLabel" hidden>終了日<input id="purchaseTo" type="date"></label>
<label>最低金額<input id="purchaseMin" type="number" min="0" step="1"></label><label>最高金額<input id="purchaseMax" type="number" min="0" step="1"></label>
<label>ソート<select id="purchaseSort"><option value="time">購入日時</option><option value="total">支払総額</option><option value="quantity">個数</option><option value="unit">単価</option></select></label>
<div class="sort-direction"><button data-purchase-direction="asc">↑ 昇順</button><button data-purchase-direction="desc">↓ 降順</button></div><button id="purchaseClear">絞り込みをクリア</button></div></section>
<p id="purchaseWarning" class="warning" role="status" hidden></p>
<div class="stats"><div><span>件数</span><strong id="purchaseCount">—</strong></div><div><span>個数</span><strong id="purchaseQuantity">—</strong></div><div><span>税抜</span><strong id="purchaseSubtotal">—</strong><small>G</small></div><div><span>税額</span><strong id="purchaseTax">—</strong><small>G</small></div><div><span>支払総額</span><strong id="purchaseTotal">—</strong><small>G</small></div></div><p id="purchaseTaxNote" class="footnote"></p>
<div class="toolbar"><label>集計<select id="purchaseBucket"><option value="day">日別</option><option value="month">月別</option></select></label><label><input id="purchaseCumulative" type="checkbox">累積</label></div><section id="purchaseChart" class="collection money-chart"></section>
<details class="collection"><summary>キャラクター別の合計</summary><div id="purchaseGroups" class="retainer-sales"></div></details>
<section class="collection"><div class="table-scroll"><table><thead><tr><th>購入日時</th><th>アイテム</th><th>キャラクター</th><th>購入先</th><th>購入元</th><th>購入ワールド</th><th class="number">個数</th><th class="number">単価</th><th class="number">税抜</th><th class="number">税額</th><th class="number">支払総額</th></tr></thead><tbody id="purchaseRows"></tbody></table></div><footer class="table-footer"><span id="purchasePage"></span><div><button id="purchasePrev">← 前へ</button><button id="purchaseNext">次へ →</button></div></footer></section>
<p class="footnote">日時は日本時間（0:00〜24:00）。税額不明の支出は税抜・税額に含めず、支払総額にのみ含めます。未記録の購入は復元できません。</p>`;
document.querySelector('main').append(section);
const fields=['purchaseSearch','purchaseCharacter','purchaseSource','purchaseWorld','purchaseQuality','purchasePeriod','purchaseDay','purchaseFrom','purchaseTo','purchaseMin','purchaseMax','purchaseSort','purchaseBucket','purchaseCumulative'];
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
$('purchaseDay').value=today();let page=1,direction='desc',sequence=0,controller,lastData,timer;const cache=new Map();
export const purchaseNavigation=()=>({page,direction,fields:Object.fromEntries(fields.map(k=>[k,$(k).type==='checkbox'?$(k).checked:$(k).value]))});
export function cancelPurchaseLoad(){sequence++;clearTimeout(timer);controller?.abort();controller=null;}
export function purchaseParams(){
 const mode=$('purchasePeriod').value;let from='',to='';
 if(mode==='range'){from=$('purchaseFrom').value;to=$('purchaseTo').value;}else if(mode==='day')from=to=$('purchaseDay').value;else if(mode==='today')from=to=today();else if(mode==='yesterday')from=to=new Date(Date.parse(today()+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 const p=new URLSearchParams({q:$('purchaseSearch').value,character:$('purchaseCharacter').value,source:$('purchaseSource').value,world:$('purchaseWorld').value,quality:$('purchaseQuality').value,from,to,min:$('purchaseMin').value,max:$('purchaseMax').value,sort:$('purchaseSort').value,direction,bucket:$('purchaseBucket').value,page});
 try{const excluded=JSON.parse(localStorage.getItem('allagan.excludedCharacters')||'[]');if(Array.isArray(excluded))p.set('excludedCharacters',excluded.join(','));}catch{}
 return p;
}
const choose=(id,options)=>{const selected=$(id).value;$(id).innerHTML='<option value="">すべて</option>'+options.map(o=>`<option value="${esc(o.id)}" translate="no">${esc(o.name)}</option>`).join('');if(selected&&!options.some(o=>o.id===selected))$(id).add(new Option('選択した対象（履歴なし）',selected));$(id).value=selected;};
const sourceName=n=>['マーケット','NPC購入','未分類','資金移動'][n]||'不明';
function chart(d){
 let cumulative=0;const points=d.chart.map(p=>({...p,value:$('purchaseCumulative').checked?(cumulative+=p.total):p.total}));const max=Math.max(1,...points.map(p=>p.value));
 $('purchaseChart').innerHTML='<h2>購入金額の推移</h2>'+(points.length?`<svg viewBox="0 0 1000 240" role="img" aria-label="購入金額の推移">${points.map((p,i)=>{const x=40+i*920/points.length,h=180*p.value/max;return `<rect x="${x}" y="${200-h}" width="${Math.max(1,920/points.length-2)}" height="${h}" fill="#38bca9" tabindex="0" aria-label="${esc(p.date)} ${fmt(p.value)} G"><title>${esc(p.date)}: ${fmt(p.value)} G</title></rect>`;}).join('')}<text x="40" y="225">${esc(points[0].date)}</text><text x="960" y="225" text-anchor="end">${esc(points.at(-1).date)}</text><text x="40" y="15">${fmt(max)} G</text></svg>`:'<p>表示できる記録がありません。</p>')+(d.chartTruncated?'<p class="footnote">グラフは最新366区間です。累積は表示範囲内の合計です。</p>':'');
}
function render(d){
 lastData=d;page=d.page;choose('purchaseCharacter',d.characters.map(c=>({id:c.id,name:c.name+' @ '+c.home})));choose('purchaseWorld',d.worlds.map(w=>({id:w,name:w})));
 for(const [id,k] of [['purchaseCount','count'],['purchaseQuantity','quantity'],['purchaseSubtotal','subtotal'],['purchaseTax','tax'],['purchaseTotal','total']])$(id).textContent=fmt(d.summary[k]);
 $('purchaseTaxNote').textContent=d.summary.unknownTaxTotal?'税額不明の支出 '+fmt(d.summary.unknownTaxTotal)+' G':'';
 $('purchaseRows').innerHTML=d.items.map(r=>`<tr><td>${esc(new Date(r.time*1000).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}))}</td><td><span translate="no">${esc(r.name||'—')}</span>${r.item?` <small>#${r.item} · ${r.hq?'HQ':'NQ'}</small>`:''}</td><td translate="no">${esc(r.character)}<small> @ ${esc(r.home)}</small></td><td>${sourceName(r.source)}</td><td translate="no">${esc(r.seller||'—')}</td><td translate="no">${esc(r.world)}</td><td class="number">${r.quantity?fmt(r.quantity):'—'}</td><td class="number">${r.quantity?fmt(r.unit):'—'}</td><td class="number">${r.tax_known?fmt(r.subtotal):'—'}</td><td class="number">${r.tax_known?fmt(r.tax):'—'}</td><td class="number"><strong>${fmt(r.total)} G</strong></td></tr>`).join('')||'<tr><td colspan="11">表示できる記録がありません。</td></tr>';
 $('purchaseGroups').innerHTML=d.groups.map(g=>`<button data-purchase-group="${esc(g.id)}"><span translate="no" title="${esc(g.name)} @ ${esc(g.home)}">${esc(g.name)} @ ${esc(g.home)}</span><strong>${fmt(g.total)} G</strong><small>${fmt(g.count)}件</small></button>`).join('');
 $('purchasePage').textContent=`${d.page} / ${d.pages} ページ · ${fmt(d.summary.count)}件`;$('purchasePrev').disabled=d.page<=1;$('purchaseNext').disabled=d.page>=d.pages;chart(d);
}
export async function loadPurchases(force=false){
 const mode=$('purchasePeriod').value;$('purchaseDayLabel').hidden=mode!=='day';$('purchaseFromLabel').hidden=$('purchaseToLabel').hidden=mode!=='range';
 for(const b of section.querySelectorAll('[data-purchase-direction]'))b.setAttribute('aria-pressed',String(b.dataset.purchaseDirection===direction));
 const query=purchaseParams().toString(),saved=cache.get(query),request=++sequence;controller?.abort();controller=new AbortController();
 try{
  let d;if(saved&&!force&&Date.now()-saved.at<30000)d=saved.data;
  else{const response=await fetch('/api/purchases?'+query,{headers:saved?{'If-None-Match':saved.etag}:{},signal:controller.signal});if(response.status===304&&saved){d=saved.data;saved.at=Date.now();}else{d=await response.json();if(!response.ok)throw new Error(d.error||'購入履歴を読み込めません。');const bytes=JSON.stringify(d).length*2;if(bytes<=2*1024*1024)cache.set(query,{data:d,etag:response.headers.get('etag'),at:Date.now(),bytes});while(cache.size>12||[...cache.values()].reduce((n,c)=>n+c.bytes,0)>8*1024*1024)cache.delete(cache.keys().next().value);}}
  if(request!==sequence)return;csvParams=new URLSearchParams(query);$('purchaseWarning').hidden=true;if(d!==lastData)render(d);document.dispatchEvent(new Event('purchase-state-change'));
 }catch(e){if(request===sequence&&e.name!=='AbortError'){$('purchaseWarning').hidden=false;$('purchaseWarning').textContent=e.message;}}
}
export async function restorePurchases(saved){if(saved){page=saved.page||1;direction=saved.direction==='asc'?'asc':'desc';for(const [k,v] of Object.entries(saved.fields||{})){if(!fields.includes(k))continue;if($(k).type==='checkbox')$(k).checked=!!v;else{if($(k).tagName==='SELECT'&&!Array.from($(k).options).some(o=>o.value===v))$(k).add(new Option(v,v));$(k).value=v;}}}await loadPurchases();}
export async function openPurchases(character=''){resetFilters();if(character){if(!Array.from($('purchaseCharacter').options).some(o=>o.value===character))$('purchaseCharacter').add(new Option(character,character));$('purchaseCharacter').value=character;}await loadPurchases();}
for(const id of fields)$(id).onchange=()=>{if(id==='purchaseCumulative'){if(lastData)chart(lastData);document.dispatchEvent(new Event('purchase-state-change'));return;}page=1;loadPurchases();};
$('purchaseSearch').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{page=1;loadPurchases();},300);};
function resetFilters(){for(const id of ['purchaseSearch','purchaseCharacter','purchaseWorld','purchaseFrom','purchaseTo','purchaseMin','purchaseMax'])$(id).value='';$('purchaseSource').value='purchases';$('purchaseQuality').value='all';$('purchasePeriod').value='all';$('purchaseSort').value='time';direction='desc';page=1;}
$('purchaseClear').onclick=()=>{resetFilters();loadPurchases();};
$('purchasePrev').onclick=()=>{page--;loadPurchases();};$('purchaseNext').onclick=()=>{page++;loadPurchases();};
section.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.dataset.purchaseDirection){direction=b.dataset.purchaseDirection;page=1;loadPurchases();}if(b?.dataset.purchaseGroup){$('purchaseCharacter').value=b.dataset.purchaseGroup;page=1;loadPurchases();}});

export const purchaseCsvSource=()=>pagedSource('purchases','購入履歴',purchaseColumns,'/api/purchases',csvParams,lastData,purchaseRow);

document.addEventListener('character-exclusions-changed',()=>{cache.clear();cancelPurchaseLoad();});
