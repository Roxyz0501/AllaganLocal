import {loadMoney} from './money.js';
import {loadCurrencies} from './currencies.js';
import './images.js';
import {refreshOpenSales,loadStorage,openStorage,resetStorage,storageNavigation,restoreStorageNavigation} from './storage.js';
import {loadSales,openRetainerSales,salesNavigation,restoreSalesNavigation} from './sales.js';
const $=id=>document.getElementById(id);
const targetDrafts=new Map();
const fmt=n=>new Intl.NumberFormat('ja-JP').format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token,state,status,view='catalog',listId='',page=1,result,request=0,nameMode='create',addingTo='',toastTimer,polling=false,loadedStamp='',loadedCatalog='',loadedCharacters='';
let historyReady=false,restoringHistory=false;
const historyFields=['itemHistoryCharacter','excludeZero','itemHistoryMetric','itemHistorySearch','retainer','salesDay','excludeArmoury','excludeMarket','search','owner','location','sort','sortDirection','group','destination','storageSearch','storageDirectoryLayout','characterSort','characterStatusFilter','salesSearch','salesCharacter','salesRetainer','salesFrom','salesTo','currencySearch','currencyOwner','moneyEntity','moneyPeriod','moneyDay','moneyFrom','moneyTo','salesPeriod'];
function navigationSnapshot(){return {allagan:true,view,listId,page,addingTo,storage:storageNavigation(),sales:salesNavigation(),fields:Object.fromEntries(historyFields.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]))};}
const listFilterFields=['search','owner','location','retainer','sort','sortDirection','group','excludeMarket'];
function saveListFilters(){if(view!=='list'||!listId)return;try{localStorage.setItem('allagan.listFilters.'+listId,JSON.stringify(Object.fromEntries(listFilterFields.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]))));}catch{}}
function restoreListFilters(id){let saved={};try{saved=JSON.parse(localStorage.getItem('allagan.listFilters.'+id)||'{}')||{};}catch{}const defaults={search:'',owner:'',location:'',retainer:'',sort:'name',sortDirection:'asc',group:'item',excludeMarket:false};for(const field of listFilterFields){const value=saved[field]??defaults[field];if($(field).type==='checkbox')$(field).checked=!!value;else{if(value&&$(field).tagName==='SELECT'&&!Array.from($(field).options).some(o=>o.value===value))$(field).add(new Option(value,value));$(field).value=value;}}}
function saveHistory(){if(historyReady&&!restoringHistory)history.replaceState(navigationSnapshot(),'');}
function pushHistory(){if(historyReady&&!restoringHistory)history.pushState(navigationSnapshot(),'');}
document.addEventListener('storage-state-changed',saveHistory);
for(const event of ['input','change'])document.addEventListener(event,()=>queueMicrotask(saveHistory));
document.addEventListener('storage-will-navigate',saveHistory);document.addEventListener('storage-did-navigate',pushHistory);
async function restoreNavigation(saved){
 if(!saved?.allagan)return;restoringHistory=true;request++;
 try{if(!['catalog','inventory','market','favorites','list','storage','characters','companies','sales','money','currencies'].includes(saved.view))throw new Error('保存された画面は利用できません');if(saved.view==='list'&&!state.lists.some(l=>l.id===saved.listId))throw new Error('マイリストが見つかりません');view=saved.view;listId=saved.listId;page=saved.page;addingTo=saved.addingTo;
 renderNav();renderStatus();for(const [id,value] of Object.entries(saved.fields||{})){if(!$(id))continue;if($(id).type==='checkbox')$(id).checked=value;else {if($(id).tagName==='SELECT'&&value&&!Array.from($(id).options).some(o=>o.value===value))$(id).add(new Option(value,value));$(id).value=value;}}
 if(['storage','characters','companies'].includes(view)&&saved.storage)await restoreStorageNavigation(saved.storage);else if(view==='sales')await restoreSalesNavigation(saved.sales);else await load();
 }finally{restoringHistory=false;}
}
window.addEventListener('popstate',e=>restoreNavigation(e.state).catch(error=>toast(error.message)));
window.addEventListener('pagehide',saveHistory);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveHistory();});
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
async function api(url,body){const res=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':token},body:JSON.stringify(body)}:{});const data=await res.json();if(!res.ok)throw new Error(data.error||'接続できません');return data;}
function run(fn){return async e=>{try{await fn(e);}catch(err){toast(err.message);}};}
async function action(body){const data=await api('/api/action',body);state=data.state;status=data.status;renderNav();renderStatus();await load();}
function ownerName(id){const o=status.owners.find(x=>x.id===id);return o?`${o.name}${o.world?' @ '+o.world:''}`:id;}
function date(value){return value?new Date(value).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'未読込';}
$('excludeZero').checked=localStorage.getItem('allagan.excludeZero')!=='false';
$('excludeArmoury').checked=localStorage.getItem('allagan.excludeArmoury')==='true';
$('excludeMarket').checked=localStorage.getItem('allagan.excludeMarket')==='true';
function renderNav(){
 $('title').setAttribute('translate',view==='list'?'no':'yes');
 $('excludeZeroLabel').hidden=view!=='catalog';
 if(['money','sales'].includes(view))$('historyMenu').open=true;
 $('excludeArmouryLabel').hidden=!['catalog','inventory'].includes(view);$('excludeMarketLabel').hidden=!['catalog','list'].includes(view);$('location').disabled=view==='market';
  $('moneyView').hidden=view!=='money';
  $('currenciesView').hidden=view!=='currencies';
  $('storageView').hidden=!['storage','characters','companies'].includes(view);$('salesView').hidden=view!=='sales';for(const el of document.querySelectorAll('main > .stats,main > .collection,main > .footnote'))el.hidden=['sales','storage','characters','companies','currencies','money'].includes(view);
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
  $('lists').innerHTML=state.lists.map(l=>`<button class="nav ${view==='list'&&l.id===listId?'active':''}" data-list="${esc(l.id)}"><span>≡</span>${esc(l.name)} <small>${l.items.length}</small></button>`).join('');
  const selected=addingTo||$('destination').value;
  $('destination').innerHTML=state.lists.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
  if(state.lists.some(l=>l.id===selected))$('destination').value=selected;
  const l=state.lists.find(x=>x.id===listId);const titles={market:'出品中',money:'収支履歴',currencies:'通貨・トークン',inventory:'所持アイテム',catalog:'所持アイテム',favorites:'お気に入り',sales:'リテイナー販売履歴',storage:'アイテムの保管先',characters:'キャラクター',companies:'フリーカンパニー',list:l?.name||'マイリスト'};
  $('title').textContent=$('breadcrumb').textContent=titles[view];
  $('subtitle').textContent={market:'Allagan Tools が最後に記録した、リテイナーの出品中アイテムを確認。',money:'日別の最終記録額と、金額の増減を確認。',currencies:'キャラクター・リテイナー・FCが所持する通貨とトークンを確認。',inventory:'Allagan Tools が記録したアイテムをまとめて確認。',catalog:'アイテムの所持数と保管先を確認。「0個を除外」をオフにすると未所持品も検索できます。',favorites:'気になるアイテムを、すぐ手の届く場所に。',sales:'キャラクター別に、売れた商品・個数・金額・検出日時を確認。',storage:'該当するアイテムの配置を確認。',characters:'一覧からキャラクターを選び、所持品やリテイナーを確認。',companies:'一覧からフリーカンパニーを選び、ポイントやチェストを確認。',list:'このリストに登録したアイテムの所持数と、NPC売却（合計）を確認。'}[view];
  $('listPricingLabel').hidden=view!=='list';$('listPricing').value=l?.pricing||'npc';$('renameList').hidden=$('deleteList').hidden=$('listMoneyHistory').hidden=view!=='list';$('listMoneyHistory').dataset.moneyHistory='list:'+listId;$('listMoneyHistory').textContent='個数・価格の推移を見る';$('addDestination').hidden=true;
  $('addToList').hidden=view!=='list';$('backToList').hidden=view!=='catalog'||!addingTo;$('totalNote').hidden=view!=='list';
  $('lastHeader').textContent=view==='list'?'削除':'マイリスト';
}
let renderedOwners='',renderedLocations='';
function renderStatus(){
 $('refreshLodestone').disabled=!!status.lodestone?.running;$('refreshLodestone').textContent=status.lodestone?.running?'ロドスト更新中 '+status.lodestone.done+' / '+status.lodestone.total:'ロドスト情報を更新';
  $('updateMarket').disabled=!!status.market?.running;$('marketUpdateStatus').textContent=status.market?.running?`価格更新中 ${status.market.done} / ${status.market.total} · ${status.market.message}`:status.market?.message||(status.market?.updatedAt?'価格更新：'+new Date(status.market.updatedAt).toLocaleString('ja-JP'):'');

  const ownerKey=JSON.stringify(status.owners);if(ownerKey!==renderedOwners){renderedOwners=ownerKey;
  const owner=$('owner').value;$('owner').innerHTML='<option value="">すべてのキャラクター</option>'+status.owners.filter(o=>o.type==='キャラクター').map(o=>`<option value="${esc(o.id)}">${esc(ownerName(o.id))}${o.parentNames?.length?' ← '+esc(o.parentNames.join('・')):''}</option>`).join('');$('owner').value=owner;}
  const locationKey=JSON.stringify(status.categories);if(locationKey!==renderedLocations){renderedLocations=locationKey;
  const loc=$('location').value;$('location').innerHTML='<option value="">すべての保管場所</option>'+Object.entries(status.categories).map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('');$('location').value=loc;}
  $('connectionDot').classList.toggle('error',!!status.sourceError);$('connectionText').textContent=status.sourceError?'保存データを確認してください':'Allagan Tools 接続済み';
  const warnings=[status.sourceError,status.charactersError,!status.catalogItems?'アイテム辞書がありません。「接続・データ設定」で日本語名・NPC価格を更新してください。':''].filter(Boolean);
  $('warning').hidden=!warnings.length;$('warning').textContent=warnings.join(' ');
  if(view!=='list'){$('thirdLabel').textContent='データ保存日時';$('thirdValue').textContent=date(status.sourceUpdated);$('thirdUnit').textContent='';}
  $('catalogInfo').textContent=`${fmt(status.catalogItems)}アイテム · 更新 ${date(status.catalogUpdated)}${status.catalogJob.message?' · '+status.catalogJob.message:''}`;
  $('updateCatalog').disabled=status.catalogJob.running;
}
let lastItemsPayload='';
async function load(){
 for(const b of document.querySelectorAll('[data-sort-direction]'))b.setAttribute('aria-pressed',String(b.dataset.sortDirection===$('sortDirection').value));
 renderRetainerFilter();
  if(view==='money'){request++;await loadMoney();return;}
  if(view==='currencies'){request++;await loadCurrencies();return;}
  if(['storage','characters','companies'].includes(view)){request++;await loadStorage();return;}
  if(view==='sales'){request++;await loadSales();return;}
  const seq=++request;
  const p=new URLSearchParams({excludeArmoury:['catalog','inventory'].includes(view)&&$('excludeArmoury').checked?'1':'0',excludeZero:$('excludeZero').checked?'1':'0',excludeMarket:$('excludeMarket').checked?'1':'0',view,list:listId,page:String(page),q:$('search').value,character:$('owner').value,retainer:(view==='market'||['4','7','9'].includes($('location').value))?$('retainer').value:'',location:$('location').value,sort:$('sort').value,direction:$('sortDirection').value,group:$('group').value});
  $('items').setAttribute('aria-busy','true');
  try{const next=await api('/api/items?'+p);if(seq!==request)return;result=next;page=result.page;const signature=JSON.stringify([view,listId,$('group').value,$('destination').value,status.charactersStamp,next]);if(signature!==lastItemsPayload){lastItemsPayload=signature;renderItems();}}
  finally{if(seq===request)$('items').removeAttribute('aria-busy');}
}
function price(n){return n==null?'<span class="price-missing">—</span>':`${fmt(n)}<span class="gil">G</span>`;}
function renderItems(){
  const dest=state.lists.find(l=>l.id===$('destination').value);let lastCategory;
  $('items').innerHTML=result.items.map(x=>{
    const added=false;
    const controls=view==='list'?`<button class="icon-button remove" data-remove="${x.id}" aria-label="${esc(x.name)}をリストから削除">×</button>`:`<button class="add-button ${added?'added':''}" data-add="${x.id}" ${added?'disabled':''}>${added?'✓ 追加済み':'＋ 追加'}</button>`;
    const locations=x.locations.slice(0,2).map(l=>`<div class="location-preview ${l.excluded?'excluded-preview':''}">${l.excluded?'除外中 · ':''}${esc(ownerName(l.owner))} · ${esc(status.categories[l.category]||'その他')} <b>${fmt(l.quantity)}個</b></div>`).join('');
    const groupTitle=$('group').value==='category'&&lastCategory!==x.category?`<tr class="category-heading"><th colspan="9">${esc(x.category||'分類不明')}</th></tr>`:'';lastCategory=x.category;
    return `${groupTitle}<tr><td class="star-col"><button class="star ${x.favorite?'selected':''}" data-favorite="${x.id}" aria-label="${esc(x.name)}のお気に入り${x.favorite?'解除':'登録'}" aria-pressed="${x.favorite}">${x.favorite?'★':'☆'}</button></td><td><div class="item-identity"><img class="item-icon" data-image="/api/icon/${x.id}" alt="" width="40" height="40" loading="lazy" decoding="async"><div><button class="item-name" data-detail="${x.id}">${esc(x.name)}</button>${(state.cashItems||[]).includes(x.id)?'<span class="cash-item-badge">換金アイテム</span>':''}<div class="item-category">${esc(x.category||'分類不明')} <span>· #${x.id}</span></div>${locations}${x.locations.length?`<button class="location-link" data-detail="${x.id}">${view==='list'?'保管先・除外設定':'保管先の内訳を見る'}（${x.locations.length}件）</button>`:''}</div></div></td><td class="number"><button class="item-name qty" data-detail="${x.id}" aria-label="${esc(x.name)}の保管場所">${fmt(x.quantity)}</button><div class="split">NQ ${fmt(x.nq)} / HQ ${fmt(x.hq)}${x.collectable?' / 収集 '+fmt(x.collectable):''}</div></td><td class="number">${price(x.sell)}</td><td class="number sell-total">${price(x.sellTotal)}</td><td class="number">${price(x.buy)}</td><td class="market-price-cell">${marketCell(x)}</td><td class="market-price-cell">${marketTotalCell(x)}</td><td>${controls}</td></tr>`;
  }).join('');
  const summary=view==='list'?(result.listSummary||result.summary):result.summary;
  const marketSummary=result.summary.market||{};$('cashSummary').textContent=fmt(marketSummary.cash||0);$('marketSummary').textContent=fmt(marketSummary.value||0);$('cashSummaryNote').textContent=marketSummary.cashUnknown?'価格不明 '+fmt(marketSummary.cashUnknown)+'個':'';$('marketSummaryNote').textContent='換金アイテムは除外'+(marketSummary.unknown?' · 未取得／出品なし '+fmt(marketSummary.unknown)+'個':'');
  $('kindCount').textContent=fmt(summary.kinds);$('quantityCount').textContent=fmt(summary.quantity);
  if(view==='list'){const market=summary.pricing==='market';$('thirdLabel').textContent=market?'マイリストのマーケット価格（合計）':'マイリストのNPC売却（合計）';$('thirdValue').textContent=fmt(market?summary.market?.value:summary.sellTotal);$('thirdValue').classList.add('money-value');$('thirdValue').classList.remove('date-value');$('thirdUnit').textContent='ギル';$('totalNote').textContent='リスト全体・除外設定を反映 / '+(market?'日本全体の最安値・換金アイテム／アーマリーチェストを除外':'NQ単価換算')+($('excludeMarket').checked?' · 出品中を除外':'')+(summary.unknownPrices?'（価格不明 '+summary.unknownPrices+'種類は除外）':'')+(summary.excludedQuantity?' · 除外 '+fmt(summary.excludedQuantity)+'個':'')+($('excludeMarket').checked?' ／ 前日比は保存済みリスト設定での金額：':' ／ 前日比 ')+(result.listDayChange==null?'比較なし':(result.listDayChange>0?'+':'')+fmt(result.listDayChange)+' G');}else {$('thirdValue').classList.remove('money-value');$('thirdValue').classList.add('date-value');renderStatus();}
  $('resultCount').textContent=`${fmt(result.total)} 件${$('search').value?' の検索結果':''}`;
  $('empty').hidden=result.total>0;$('emptyText').textContent=$('search').value?'検索語や保管者・保管場所の条件を変えてください。':view==='market'?'現在の条件に一致する出品中アイテムはありません。':view==='inventory'?'Allagan Tools の保存ファイルを接続すると、ここに表示されます。':view==='favorites'?'アイテムの ☆ を押すと、ここに登録されます。':'「所持アイテム」で検索し、追加先を選んで「＋ 追加」を押してください。';
  $('browseCatalog').hidden=['catalog','market'].includes(view);$('pageInfo').textContent=`${result.page} / ${result.pages} ページ`;$('prev').disabled=result.page<=1;$('next').disabled=result.page>=result.pages;
}
async function navigate(next,id=''){saveListFilters();saveHistory();const leavingList=view==='list';if(next==='money')$('moneyEntity').value='all:gil';if(['characters','companies'].includes(next))resetStorage(next);if(next!=='catalog')addingTo='';view=next;listId=id;page=1;if(next==='list')restoreListFilters(id);else{$('search').value='';if(leavingList){$('owner').value=$('location').value=$('retainer').value='';$('excludeMarket').checked=localStorage.getItem('allagan.excludeMarket')==='true';}}renderNav();renderStatus();await load();pushHistory();}
function openName(mode){nameMode=mode;$('nameTitle').textContent=mode==='create'?'マイリストを作成':'リスト名を変更';$('nameInput').value=mode==='create'?'':state.lists.find(l=>l.id===listId)?.name||'';$('nameDialog').showModal();$('nameInput').focus();}
document.addEventListener('click',run(async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.searchItemName){for(const d of document.querySelectorAll('dialog[open]'))d.close();await navigate('catalog');$('owner').value=$('location').value=$('retainer').value='';$('excludeMarket').checked=false;$('search').value=b.dataset.searchItemName;page=1;await load();saveHistory();return;}
  if(b.dataset.copyItemName){try{await navigator.clipboard.writeText(b.dataset.copyItemName);toast('アイテム名をコピーしました');}catch{toast('コピーできませんでした。アイテム名を選択してコピーしてください。');}return;}
  if(b.dataset.close){$(b.dataset.close).close();return;}
  if(b.dataset.retainerSales){saveHistory();view='sales';renderNav();await openRetainerSales(b.dataset.retainerSales,b.dataset.salesOwner||'');pushHistory();return;}
  if(b.dataset.moneyHistory){$('itemHistoryMetric').value=b.dataset.itemMetric||(b.dataset.moneyHistory.startsWith('list:')||b.dataset.moneyHistory==='all:lists'?'list':'count');if(b.dataset.historyCharacter&&!Array.from($('itemHistoryCharacter').options).some(o=>o.value===b.dataset.historyCharacter))$('itemHistoryCharacter').add(new Option(ownerName(b.dataset.historyCharacter),b.dataset.historyCharacter));$('itemHistoryCharacter').value=b.dataset.historyCharacter||'';for(const d of document.querySelectorAll('dialog[open]'))d.close();saveHistory();view='money';renderNav();await loadMoney(b.dataset.moneyHistory);pushHistory();return;}
  if(b.dataset.view)return navigate(b.dataset.view);
  if(b.dataset.list)return navigate('list',b.dataset.list);
  if(b.dataset.favorite){b.disabled=true;try{const id=Number(b.dataset.favorite);await action({action:'favorite',itemId:id,enabled:!state.favorites.includes(id)});}finally{b.disabled=false;}return;}
  if(b.dataset.add){openAddItem(Number(b.dataset.add));return;}
  if(b.dataset.remove)return action({action:'remove-item',listId,itemId:Number(b.dataset.remove)});
  if(b.dataset.saveTarget){const input=b.parentElement.querySelector('input');if(!input.reportValidity()||input.value==='')throw new Error('目標数を入力してください。');await action({action:'target',listId,itemId:Number(b.dataset.saveTarget),target:Number(input.value)});targetDrafts.delete(listId+':'+b.dataset.saveTarget);renderItems();toast('目標数を保存しました');return;}
  if(b.dataset.excludeOwner){
    const itemId=Number(b.dataset.itemId),owner=b.dataset.excludeOwner,category=Number(b.dataset.category);
    b.disabled=true;
    try{await action({action:'exclude-location',listId,itemId,owner,category,excluded:b.dataset.excluded!=='true'});showDetail(itemId);toast('このマイリストの集計対象を保存しました');}finally{b.disabled=false;}
    return;
  }
  if(b.dataset.bagItem){saveHistory();$('detailDialog').close();view='storage';request++;renderNav();view=await openStorage(b.dataset.bagOwner||'',Number(b.dataset.bagItem));renderNav();pushHistory();return;}
  if(b.dataset.detail){if(view==='list')showDetail(Number(b.dataset.detail));else document.dispatchEvent(new CustomEvent('open-item-detail',{detail:{id:Number(b.dataset.detail)}}));}
}));
function marketTotalCell(item){const m=item.market;if(!m)return '未取得';const block=(label,total)=>`<div><b>${esc(label)}</b><strong>${fmt(total?.value||0)} G</strong>${total?.unknown?`<small>未取得／出品なし ${fmt(total.unknown)}個</small>`:''}</div>`;return ($('group').value==='location'?m.worlds.map(w=>block(w.world,w.total)).join(''):'')+block('日本全体',m.total);}
function marketCell(item){const m=item.market;if(!m)return '未取得';const quote=q=>q?fmt(q.price)+' G · '+esc(q.world):'未取得／出品なし';const block=(label,q)=>`<div><b>${esc(label)}</b><span>NQ ${quote(q?.nq)}</span><span>HQ ${quote(q?.hq)}</span></div>`;return ($('group').value==='location'?m.worlds.map(w=>block('保管先：'+w.world,w.local)).join(''):'')+block('日本全体',m.region);}
function marketQuote(q){return q?`${fmt(q.price)} G · ${esc(q.world)}${q.at?'（市場更新 '+date(q.at)+'）':''}`:'未取得／出品なし';}
function detailMarketTotal(item,locations,quotes){
 if((state.cashItems||[]).includes(item.id))return '0 G（換金アイテムは対象外）';
 let total=0,missing=0;for(const l of locations){if(Number(l.category)===5||l.excluded)continue;for(const [key,count] of [['nq',(l.nq||0)+(l.collectable||0)],['hq',l.hq||0]]){if(!count)continue;if(quotes?.[key]?.price==null)missing+=count;else total+=count*quotes[key].price;}}
 return fmt(total)+' G'+(missing?' / 未取得・出品なし '+fmt(missing)+'個':'');
}
function marketInfo(item,context={},locations=item.locations||[],world=''){
 const m=item.market;if(!m)return '';const scoped=!!context.owner;world=world||status.owners.find(o=>o.id===context.owner)?.world||'';
 const local=m.worlds?.find(w=>w.world===world)?.local;
 const block=(title,quotes)=>`<div class="detail-price-block"><b>${esc(title)}</b><div>NQ ${marketQuote(quotes?.nq)}</div><div>HQ ${marketQuote(quotes?.hq)}</div>${scoped?'<strong>合計 '+detailMarketTotal(item,locations,quotes)+'</strong>':''}</div>`;
 return `<section class="market-item-info"><h3>マーケット最安出品価格（1個）</h3>${scoped?block('保管先：'+world,local):''}${block('日本全体',m.region)}</section>`;
}
function detailOwnership(item,context){
 const selected=status.owners.find(o=>o.id===context.owner),locations=item.locations||[];
 const count=ids=>locations.filter(l=>ids.has(l.owner)).reduce((n,l)=>n+l.quantity,0);
 const row=(title,n)=>`<div><span>${title}</span><strong>${fmt(n)} 個</strong></div>`;
 let html='';if(selected&&['キャラクター','リテイナー'].includes(selected.type)){
 const parent=selected.type==='キャラクター'?selected.id:selected.parentIds?.[0];
 const family=new Set(status.owners.filter(o=>o.id===parent||o.type==='リテイナー'&&o.parentIds?.includes(parent)).map(o=>o.id));
 html=row(selected.type+'の所有数',count(new Set([selected.id])))+row('キャラクター・リテイナーの所有数',count(family));
 }
 return '<div class="detail-ownership">'+html+row('全体の所有数',item.quantity)+'</div>';
}
function showDetail(id,provided=null,context={}){
  const row=provided||result?.items.find(x=>x.id===id);if(!row)return;
  const item={...(row.listDetail||row.itemDetail||row),market:row.market},editable=!provided&&view==='list';
  const currentList=state.lists.find(x=>x.id===listId);
  $('detailTitle').textContent=item.name;
  $('detailDialog').querySelector('.copy-name-icon')?.remove();$('detailTitle').insertAdjacentHTML('beforebegin',`<button class="copy-name-icon" data-copy-item-name="${esc(item.name)}" title="アイテム名をコピー" aria-label="${esc(item.name)}の名前をコピー"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg></button>`);
  $('detailBody').innerHTML=`<div class="item-identity detail-identity"><img class="item-icon" data-image="/api/icon/${item.id}" alt="" width="64" height="64"><p class="muted">#${item.id} · ${esc(item.category||'分類不明')}</p></div>
    ${editable?`<div class="exclusion-help">「${esc(currentList?.name)}」の集計対象を設定します。保管先ごとの除外は、このリストのこのアイテムだけに適用されます。</div>`:''}
    <label class="cash-item-toggle"><input type="checkbox" data-cash-item="${item.id}" ${(state.cashItems||[]).includes(item.id)?'checked':''}> <span class="cash-item-badge">換金アイテム</span></label>${detailOwnership(item,context)}${context.slot?`<p class="muted">選択したスタック：${esc(context.slot.owner)} · ${esc(context.slot.place)} / スロット ${context.slot.slot} · ${fmt(context.slot.quantity)}個 ${context.slot.hq?'HQ':'NQ'}</p>`:''}<div class="detail-stats"><div><span>${editable?'集計対象 ':''}NQ </span><strong>${fmt(item.nq)}</strong></div><div><span>HQ </span><strong>${fmt(item.hq)}</strong></div><div><span>収集品 </span><strong>${fmt(item.collectable)}</strong></div></div>
    <p>NPC売却（NQ） ${price(item.sell)} / NPC購入 ${price(item.buy)}</p><p>NPC売却（合計） <strong>${price(item.sellTotal)}</strong><br><span class="muted">集計対象の所持数 × NQ単価の参考額${item.excludedQuantity?' / 除外 '+fmt(item.excludedQuantity)+'個':''}</span></p>
    ${marketInfo(item,context,context.owner?(item.locations||[]).filter(l=>l.owner===context.owner):item.locations)}<div class="item-detail-actions"><a class="item-external-button" href="/api/item-link/${item.id}" target="_blank" rel="noopener noreferrer" title="公式データベースの個別ページを開く">↗ エオルゼアデータベース</a><button data-search-item-name="${esc(item.name)}">⌕ 全体で検索</button><button data-history-character="${esc(context.character||'')}" data-money-history="item:${item.id}">アイテム数推移を見る</button><button data-money-history="item:${item.id}" data-item-metric="total" data-history-character="${esc(context.character||'')}">アイテム価格推移を見る</button>${context.slot?`<button data-bag-item="${item.id}" data-bag-owner="${esc(context.character||'')}">同じアイテムの全スタックを強調</button>`:''}</div><h3>誰が・どこに・何個${editable?' / 集計対象設定':''}</h3>
    ${item.locations.map(l=>{const o=status.owners.find(x=>x.id===l.owner);return `<div class="detail-location ${l.excluded?'excluded-location':''}"><div><strong>${esc(ownerName(l.owner))}</strong>${o?.parentNames?.length?`<div class="muted">所有キャラクター: ${esc(o.parentNames.join('・'))}</div>`:''}<div class="muted">${esc(status.categories[l.category]||'その他')}</div>${l.excluded?'<span class="excluded-badge">このリストでは除外中</span>':''}</div><div class="location-quantity"><button data-bag-item="${item.id}" data-bag-owner="${esc(l.owner)}">バッグで位置を確認</button><strong>${fmt(l.quantity)} 個</strong><div class="muted">NQ ${fmt(l.nq)} / HQ ${fmt(l.hq)}${l.collectable?' / 収集 '+fmt(l.collectable):''}</div>${editable?`<button class="exclude-button" data-item-id="${item.id}" data-exclude-owner="${esc(l.owner)}" data-category="${l.category}" data-excluded="${!!l.excluded}" aria-label="${esc(ownerName(l.owner))} ${esc(status.categories[l.category])}を${l.excluded?'集計に戻す':'このリストから除外'}">${l.excluded?'除外を解除':'この保管先を除外'}</button>`:''}</div>${marketInfo(item,context,[l],o?.world||'')}</div>`;}).join('')||'<p class="muted">所持記録がありません。</p>'}
    <p class="muted">${editable?'このアイテムの全保管先を表示しています。除外設定は保存後も保持され、いつでも解除できます。':'全保管先の内訳です。除外の設定はマイリスト内で行えます。'} 記録時点: ${date(status.sourceUpdated)}</p>`;
  if(!$('detailDialog').open)$('detailDialog').showModal();
}
$('items').addEventListener('input',e=>{if(e.target.dataset.target)targetDrafts.set(listId+':'+e.target.dataset.target,e.target.value);});
$('items').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset.target){e.preventDefault();e.target.parentElement.querySelector('[data-save-target]').click();}});
$('createList').onclick=$('createListText').onclick=()=>openName('create');
$('addToList').onclick=run(async()=>{addingTo=listId;await navigate('catalog');$('search').focus();});
$('backToList').onclick=run(()=>navigate('list',$('destination').value));$('renameList').onclick=()=>openName('rename');
$('nameForm').onsubmit=run(async e=>{e.preventDefault();const before=state.lists.map(x=>x.id);await action({action:nameMode==='create'?'create-list':'rename-list',name:$('nameInput').value,listId});$('nameDialog').close();if(nameMode==='create')await navigate('list',state.lists.find(x=>!before.includes(x.id)).id);toast('保存しました');});
$('deleteList').onclick=()=>{$('confirmText').textContent=`「${state.lists.find(x=>x.id===listId)?.name}」を削除します。所持品データやお気に入りは残ります。`;$('confirmDialog').showModal();};
$('confirmForm').onsubmit=run(async e=>{e.preventDefault();await action({action:'delete-list',listId});$('confirmDialog').close();await navigate('catalog');toast('リストを削除しました');});
$('clearItemFilters').onclick=run(async()=>{for(const id of ['search','owner','location','retainer'])$(id).value='';page=1;saveListFilters();await load();toast('検索と保管先の絞り込みを解除しました');});
let searchTimer;$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=1;saveListFilters();load().catch(e=>toast(e.message));},220);};
$('excludeZero').onchange=run(async()=>{localStorage.setItem('allagan.excludeZero',String($('excludeZero').checked));page=1;await load();});
$('excludeMarket').onchange=run(async()=>{if(view==='list')saveListFilters();else localStorage.setItem('allagan.excludeMarket',String($('excludeMarket').checked));page=1;await load();});
for(const id of ['owner','location','retainer','sort','sortDirection','group'])$(id).onchange=run(async()=>{if(id==='owner'||id==='location')$('retainer').value='';renderRetainerFilter();saveListFilters();page=1;await load();});
$('destination').onchange=()=>{if(addingTo)addingTo=$('destination').value;renderItems();};$('prev').onclick=run(async()=>{saveHistory();page--;await load();pushHistory();});$('next').onclick=run(async()=>{saveHistory();page++;await load();pushHistory();});
$('browseCatalog').onclick=run(()=>navigate('catalog'));
$('updateMarket').onclick=run(async()=>{await api('/api/market-update',{});status=await api('/api/status');renderStatus();toast('マーケット価格の更新を開始しました。更新中も操作できます。');});
$('refresh').onclick=run(async()=>{status=await api('/api/refresh',{});renderStatus();await load();toast(status.sourceError||'保存データを再読み込みしました');});
$('settingsButton').onclick=()=>{$('refreshInterval').value=String(status.refreshSeconds||60);$('sourcePath').value=status.source;$('ownerNames').innerHTML=status.owners.map(o=>`<form class="owner-row" data-owner="${esc(o.id)}"><label>${esc(o.id)}<input value="${esc(o.name)}" required maxlength="80" aria-label="保管者 ${esc(o.id)}の表示名"></label><button type="submit">保存</button></form>`).join('');$('settingsDialog').showModal();};
$('sourceForm').onsubmit=run(async e=>{e.preventDefault();await action({action:'source',path:$('sourcePath').value});toast('接続先を保存しました');});
$('ownerNames').onsubmit=run(async e=>{e.preventDefault();await action({action:'owner-name',owner:e.target.dataset.owner,name:e.target.querySelector('input').value});toast('表示名を保存しました');});
$('updateCatalog').onclick=run(async()=>{await api('/api/catalog',{});status=await api('/api/status');renderStatus();toast('辞書の更新を開始しました');});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$(view==='sales'?'salesSearch':'search').focus();}});
try{const boot=await api('/api/bootstrap');({token,state,status}=boot);const localExcluded=JSON.parse(localStorage.getItem('allagan.excludedCharacters')||'[]');if(JSON.stringify(localExcluded)!==JSON.stringify(state.excludedCharacters||[])){const synced=await api('/api/action',{action:'excluded-characters',ids:localExcluded});state=synced.state;status=synced.status;}const saved=history.state;if(saved?.allagan){try{await restoreNavigation(saved);}catch{view='catalog';listId='';page=1;renderNav();renderStatus();await load();}}else{renderNav();renderStatus();await load();}loadedStamp=status.lastRead;loadedCatalog=status.catalogUpdated;loadedCharacters=status.charactersStamp;historyReady=true;history.replaceState(navigationSnapshot(),'');}
catch(e){$('warning').hidden=false;$('warning').textContent='接続できません: '+e.message;}
let lastAutomaticRefresh=Date.now();
setInterval(async()=>{if(polling||!state||document.hidden||Date.now()-lastAutomaticRefresh<(status.refreshSeconds||60)*1000)return;lastAutomaticRefresh=Date.now();polling=true;try{const next=await api('/api/status');if(view==='sales')await loadSales();if(['characters','storage','companies'].includes(view))await refreshOpenSales();const changed=next.lastRead!==loadedStamp||next.catalogUpdated!==loadedCatalog||next.charactersStamp!==loadedCharacters;status=next;renderStatus();if(changed&&!document.activeElement.classList.contains('target')){await load();loadedStamp=status.lastRead;loadedCatalog=status.catalogUpdated;loadedCharacters=status.charactersStamp;}}catch(e){$('connectionText').textContent='サーバーに接続できません';$('connectionDot').classList.add('error');}finally{polling=false;}},1000);
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  try{Promise.resolve(document.modelContext.registerTool({name:'search_items',title:'アイテムを検索',description:'ローカルに保存されたアイテム名を検索して、画面に所持数・NPC価格・保管者別内訳を表示します。保存データは変更しません。',inputSchema:{type:'object',properties:{query:{type:'string',maxLength:200}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},async execute(input){if(typeof input?.query!=='string'||input.query.length>200)throw new Error('query は200文字以内の文字列で指定してください。');await navigate('catalog');$('search').value=input.query;await load();return {total:result.total,items:result.items.map(x=>({id:x.id,name:x.name,quantity:x.quantity,sell:x.sell,buy:x.buy,locations:x.locations.map(l=>({...l,ownerName:ownerName(l.owner),place:status.categories[l.category]}))}))};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
}


function renderRetainerFilter(){
 const character=$('owner').value,previous=$('retainer').value;
 $('retainerFilter').hidden=!(view==='market'||['4','7','9'].includes($('location').value));
 const retainers=(status?.owners||[]).filter(o=>o.type==='リテイナー'&&(!character||o.parentIds?.includes(character)));
 $('retainer').innerHTML='<option value="">すべて</option>'+retainers.map(o=>{const parents=(o.parentIds||[]).map(id=>ownerName(id)).join('・');return `<option value="${esc(o.id)}">${esc(o.name)}${character?'':'　'+esc(parents||'所有キャラクター不明')}</option>`;}).join('');
 $('retainer').value=retainers.some(o=>o.id===previous)?previous:'';
}
let pendingItem=0;
function openAddItem(id){pendingItem=id;$('addItemName').textContent=result.items.find(x=>x.id===id)?.name||String(id);$('addItemList').innerHTML=state.lists.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}${l.items.some(x=>x.id===id)?'（登録済み）':''}</option>`).join('')+'<option value="new">＋ 新規マイリストを作成</option>';$('addItemNewName').value='';updateAddItemChoice();$('addItemDialog').showModal();}
function updateAddItemChoice(){const create=$('addItemList').value==='new';$('addItemNewLabel').hidden=!create;$('addItemNewName').required=create;}
$('addItemList').onchange=updateAddItemChoice;
$('addItemForm').onsubmit=run(async e=>{e.preventDefault();const submit=e.submitter;if(submit)submit.disabled=true;try{let dest=$('addItemList').value;if(dest==='new'){const ids=new Set(state.lists.map(l=>l.id));await action({action:'create-list',name:$('addItemNewName').value});dest=state.lists.find(l=>!ids.has(l.id)).id;$('addItemList').innerHTML=`<option value="${esc(dest)}">作成したリスト</option>`;updateAddItemChoice();}await action({action:'add-item',listId:dest,itemId:pendingItem});$('addItemDialog').close();toast('マイリストに追加しました');}finally{if(submit)submit.disabled=false;}});

// Dismiss only when both the press and release occur on the modal backdrop.
let backdropDialog=null;
function outsideDialog(event,dialog){const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;}
document.addEventListener('pointerdown',event=>{const dialog=event.target;backdropDialog=dialog instanceof HTMLDialogElement&&dialog.open&&outsideDialog(event,dialog)?dialog:null;});
document.addEventListener('click',event=>{const dialog=backdropDialog;backdropDialog=null;if(dialog&&event.target===dialog&&dialog.open&&outsideDialog(event,dialog))dialog.close();});
document.addEventListener('pointercancel',()=>{backdropDialog=null;});

let detailRequest=0;const itemPriceRequests=new Map();function refreshItemPrice(id){if(!itemPriceRequests.has(id)){const pending=api('/api/market-items',{itemId:id}).finally(()=>itemPriceRequests.delete(id));itemPriceRequests.set(id,pending);}return itemPriceRequests.get(id);}
document.addEventListener('open-item-detail',async event=>{
 const current=++detailRequest;try{const data=await api('/api/items?view=inventory&q='+event.detail.id);if(current!==detailRequest)return;const item=data.items.find(i=>i.id===event.detail.id);if(!item)throw new Error('アイテムの記録が見つかりません。');showDetail(item.id,item,event.detail);const note=document.createElement('p');note.className='muted';note.textContent='このアイテムのマーケット価格を更新中…';$('detailBody').prepend(note);const update=await refreshItemPrice(item.id);if(current!==detailRequest||!$('detailDialog').open)return;const fresh=await api('/api/items?view=inventory&q='+item.id);if(current!==detailRequest||!$('detailDialog').open)return;const latest=fresh.items.find(i=>i.id===item.id);if(latest)showDetail(item.id,latest,event.detail);if(update.errors)toast('一部の価格を取得できませんでした。前回価格を表示します。');}catch(error){toast(error.message);}
});

document.addEventListener('change',async event=>{const el=event.target;if(!el.dataset.cashItem)return;const enabled=el.checked;el.disabled=true;try{await action({action:'cash-item',itemId:Number(el.dataset.cashItem),enabled});toast(enabled?'換金アイテムに登録しました':'換金アイテムを解除しました');}catch(error){el.checked=!enabled;toast(error.message);}finally{el.disabled=false;}});

document.addEventListener('character-exclusions-changed',event=>action({action:'excluded-characters',ids:event.detail}).catch(error=>toast(error.message)));

document.addEventListener('update-section-market',async event=>{const {button,owner,categories}=event.detail;if(button.disabled)return;button.disabled=true;button.textContent='価格を更新中…';try{const result=await api('/api/market-items',{owner,categories});await load();toast(result.errors?'一部の価格を取得できませんでした。前回価格を保持します。':result.items+'種類の価格を更新しました');}catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='この保管先の価格を更新';}});

for(const b of document.querySelectorAll('[data-sort-direction]'))b.onclick=run(async()=>{$('sortDirection').value=b.dataset.sortDirection;saveListFilters();page=1;await load();});

$('excludeArmoury').onchange=run(async()=>{localStorage.setItem('allagan.excludeArmoury',String($('excludeArmoury').checked));page=1;await load();});

$('refreshLodestone').onclick=run(async()=>{status=await api('/api/lodestone-refresh',{});renderStatus();toast('ロドスト情報の再取得を開始しました');});

$('listPricing').onchange=run(async()=>{await action({action:'list-pricing',listId,pricing:$('listPricing').value});await load();toast('マイリストの参照価格を保存しました');});

$('refreshIntervalForm').onsubmit=run(async e=>{e.preventDefault();await action({action:'refresh-interval',seconds:Number($('refreshInterval').value)});lastAutomaticRefresh=Date.now();toast('定期更新の間隔を保存しました');});
