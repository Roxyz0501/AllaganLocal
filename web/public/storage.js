import {currencyPanels} from './currencies.js';
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('ja-JP').format(n),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dresserPages=new Map();let committedCategory='';
let directory=[],data,highlight=0,sequence=0,lastPayload='';
let excludedOwnerIds=new Set();try{excludedOwnerIds=new Set(JSON.parse(localStorage.getItem('allagan.excludedCharacters')||'[]'));}catch{}
$('characterStatusFilter').onchange=()=>renderBalances();
const excludedCharacter=o=>excludedOwnerIds.has(o.id)||!!o.stale;
const exclusionBadge=o=>o.type==='キャラクター'&&excludedCharacter(o)?`<span class="main-character-badge excluded-character-badge">${excludedOwnerIds.has(o.id)?'手動除外':'1週間以上更新なし'}</span>`:'';
let manualOrder=[],visibleCharacterIds=[];
try{const order=JSON.parse(localStorage.getItem('characterManualOrder')||'[]');if(Array.isArray(order))manualOrder=order.filter(id=>typeof id==='string');const sort=localStorage.getItem('characterSort');if(['name','world','gil','retainerGil','cashValue','marketValue','updated','tag'].includes(sort))$('characterSort').value=sort;}catch{}
let characterDirection=['gil','retainerGil','cashValue','marketValue','updated'].includes($('characterSort').value)?'desc':'asc';
try{const saved=localStorage.getItem('characterSortDirection');if(['asc','desc'].includes(saved))characterDirection=saved;}catch{}
for(const button of document.querySelectorAll('[data-character-direction]'))button.onclick=()=>{characterDirection=button.dataset.characterDirection;try{localStorage.setItem('characterSortDirection',characterDirection);}catch{}renderBalances();};
$('characterSort').onchange=()=>{characterDirection=['gil','retainerGil','cashValue','marketValue','updated'].includes($('characterSort').value)?'desc':'asc';try{localStorage.setItem('characterSort',$('characterSort').value);localStorage.setItem('characterSortDirection',characterDirection);}catch{}renderBalances();};
// Elemental membership: https://jp.finalfantasyxiv.com/lodestone/worldstatus/
const elementalWorlds=new Set(['Aegis','Atomos','Carbuncle','Garuda','Gungnir','Kujata','Tonberry','Typhon']);
const worldPriority=o=>o.world==='Typhon'?0:elementalWorlds.has(o.world)?1:2;
const isMainCharacter=o=>o.type==='キャラクター'&&(characterTags[o.id]||[]).includes('main');
let characterTags={};try{characterTags=JSON.parse(localStorage.getItem('allagan.characterTags')||'{}')||{};}catch{}
let subNumbers={};try{subNumbers=JSON.parse(localStorage.getItem('allagan.subNumbers')||'{}')||{};}catch{}
const mainBadge=o=>(isMainCharacter(o)?'<span class="main-character-badge">★ メイン</span>':'')+(o.type==='キャラクター'?(characterTags[o.id]||[]).filter(t=>['sub','submarine'].includes(t)).map(t=>`<span class="main-character-badge tag-${t}">${t==='sub'?'サブ'+(subNumbers[o.id]?' №'+esc(subNumbers[o.id]):''):'潜水艦用'}</span>`).join(''):'');

const tagRank=o=>isMainCharacter(o)?0:(characterTags[o.id]||[]).includes('sub')?1:(characterTags[o.id]||[]).includes('submarine')?2:3;
function orderedCharacters(owners){
 const mode=$('characterSort').value;
 const known=directory.filter(o=>o.type==='キャラクター').map(o=>o.id);manualOrder=[...new Set([...manualOrder,...known])];
 const position=new Map(manualOrder.map((id,i)=>[id,i]));
 const byName=(a,b)=>a.name.localeCompare(b.name,'ja')||(a.world||'').localeCompare(b.world||'','ja')||a.id.localeCompare(b.id);
 const direction=characterDirection==='desc'?-1:1;
 return owners.toSorted((a,b)=>{
  if(mode==='manual')return position.get(a.id)-position.get(b.id);
  if(['gil','retainerGil','cashValue','marketValue','updated'].includes(mode)){
   const value=o=>['cashValue','marketValue'].includes(mode)?o.assets?.total?.[mode]:mode==='gil'?o.gil:mode==='retainerGil'?(o.retainerKnownGil??o.retainerGil):(Date.parse(o.lastChangedAt)||null);
   const av=value(a),bv=value(b);
   if(av==null||bv==null)return av==null?(bv==null?byName(a,b):1):-1;
   return direction*(av-bv)||byName(a,b);
  }
  const result=mode==='tag'?tagRank(a)-tagRank(b)||(tagRank(a)===1?(subNumbers[a.id]||Infinity)-(subNumbers[b.id]||Infinity):0)||byName(a,b):mode==='world'?worldPriority(a)-worldPriority(b)||(a.world||'').localeCompare(b.world||'','ja')||Number(isMainCharacter(b))-Number(isMainCharacter(a))||byName(a,b):byName(a,b);
  return mode==='tag'?result:direction*result;
 });
}
function orderButtons(o){if(selectedOwner||mode!=='characters'||$('characterSort').value!=='manual')return '';const i=visibleCharacterIds.indexOf(o.id);return `<span class="order-buttons"><button data-move-owner="${esc(o.id)}" data-move="-1" aria-label="${esc(label(o))}を上へ" ${i<=0?'disabled':''}>↑</button><button data-move-owner="${esc(o.id)}" data-move="1" aria-label="${esc(label(o))}を下へ" ${i>=visibleCharacterIds.length-1?'disabled':''}>↓</button></span>`;}
const money=n=>n==null?'未記録':fmt(n)+' G';
const label=o=>o.name+(o.world?' @ '+o.world:'');
async function json(url){const r=await fetch(url),d=await r.json();if(!r.ok)throw new Error(d.error||'読込に失敗しました');return d;}
let mode='characters',selectedOwner='',parentOwner='';
export function resetStorage(next){mode=next;selectedOwner='';parentOwner='';highlight=0;sequence++;lastPayload='';$('storageSearch').value='';$('storageCategory').value='';}
function portrait(o){if(o.type==='FC')return `<img class="character-portrait fc-crest" data-image="/api/avatar/${esc(o.id)}?v=${Date.now()}" alt="" width="56" height="56" title="ロドストのFC紋章">`;return o.type==='キャラクター'?`<img class="character-portrait" data-image="/api/avatar/${esc(o.id)}?v=${Date.now()}" alt="" width="56" height="56" loading="lazy" title="ロドストの顔アイコン（取得できない場合は代替表示）">`:`<span class="owner-symbol" aria-hidden="true">${o.type==='FC'?'◇':'▣'}</span>`;}
function activityText(o){return o.lastChangedAt?'変更検出: '+new Date(o.lastChangedAt).toLocaleString('ja-JP'):'更新日時不明'+(o.observedSince?' / 観測開始 '+new Date(o.observedSince).toLocaleDateString('ja-JP'):'');}
function ownerExtra(o){return o.type==='FC'?'FCポイント '+(o.points==null?'未記録':fmt(o.points)+' pt'):o.type==='キャラクター'?'リテイナー '+directory.filter(r=>r.type==='リテイナー'&&r.parentIds?.includes(o.id)).length+'人':o.stacks+'スタック';}
function cashText(o){return `${fmt(o.cashValue||0)} G${o.cashUnknown?'（価格判明分）':''} / ${fmt(o.cashQuantity||0)}個`;}
function characterAssets(o){return o.type==='キャラクター'?`<span class="character-assets"><span>リテイナー出品 <b>${fmt(o.retainerListedStacks||0)}枠 / ${fmt(o.retainerListedQuantity||0)}個</b></span><span>NPC売却（合計）・換金アイテム数量 <b>${cashText(o)}</b></span></span>`:'';}
function renderCharacterOverview(){
 const el=$('characterOverview');el.hidden=mode!=='characters';if(el.hidden)return;
 const active=directory.filter(o=>o.type==='キャラクター'&&!excludedCharacter(o)&&!o.portraitStatus?.excluded);
 const sum=key=>active.reduce((n,o)=>n+(o[key]||0),0),personal=sum('gil'),retainers=sum('retainerKnownGil'),unknown=active.some(o=>o.gil==null||o.retainerUnknown);
 const cards=[['アクティブキャラクター数',fmt(active.length)+'人'],['全体所持金額',money(personal+retainers)],['キャラクター全体の所持金額',money(personal)],['リテイナー全体の所持金額',money(retainers)],['リテイナー全体の出品数',fmt(sum('retainerListedStacks'))+'枠 / '+fmt(sum('retainerListedQuantity'))+'個'],['NPC売却（合計）・換金アイテム数量',cashText({cashValue:sum('cashValue'),cashQuantity:sum('cashQuantity'),cashUnknown:sum('cashUnknown')})]];
 el.innerHTML='<div class="stats">'+cards.map(([name,value])=>`<div><span>${name}</span><strong>${value}</strong></div>`).join('')+'</div><p class="footnote">アクティブキャラクター本人・所属リテイナーの合計（FCは含みません）。換金アイテムはタグを付けたアイテムの全保管先・出品中を含み、NQのNPC売却単価×個数で評価します。検索・一覧フィルターによらず、除外キャラクターは集計しません。</p>';
}
function assetDelta(o,key,unit='個'){const n=o.assetDayChanges?.[key];return n==null?'比較なし':(n>0?'+':'')+fmt(n)+' '+unit;}
function wallet(o){
 if(!['キャラクター','リテイナー'].includes(o.type))return `<strong>${money(o.gil)}</strong>`;
 const character=o.type==='キャラクター',assets=o.assets||{},personal=assets.personal||{},retainers=assets.retainers||{},total=assets.total||{};
 const row=(name,value,bold=false)=>`<span class="asset-row ${bold?'asset-total':''}"><span>${name}</span><span>${value}</span></span>`;
 const group=(title,p,r,t)=>`<span class="asset-group"><span class="asset-heading">${title}</span>${character?row('プレイヤー所持'+(title==='所持金'?'金':'数'),p)+row('リテイナー所持'+(title==='所持金'?'金':'数'),r)+row('合計',t,true):row(title==='所持金'?'所持金':'所持数',p)}</span>`;
 const count=a=>fmt(a.quantity||0)+'個',cash=a=>fmt(a.cashValue||0)+' G / '+fmt(a.cashQuantity||0)+'個'+(a.cashUnknown?'（価格不明あり）':''),market=a=>fmt(a.marketValue||0)+' G / '+fmt(a.marketQuantity||0)+'個'+(a.marketUnknown?`<small>未取得／出品なし ${fmt(a.marketUnknown)}個</small>`:'');
 return `<span class="wallet asset-wallet">${group('所持金',money(o.gil),money(o.retainerGil),money(o.totalGil))}<small>前日比 ${o.dayChange==null?'比較なし':(o.dayChange>0?'+':'')+money(o.dayChange)}</small>${group('所持品',count(personal),count(retainers),count(total))}<small>前日比 ${assetDelta(o,'quantity')}</small>${group('換金アイテム',cash(personal),cash(retainers),cash(total))}<small>前日比 ${assetDelta(o,'cashValue','G')} / ${assetDelta(o,'cashQuantity')}</small>${group('マーケット換算',market(personal),market(retainers),market(total))}<small>前日比 ${assetDelta(o,'marketValue','G')} / ${assetDelta(o,'marketQuantity')}</small><span class="asset-group"><span class="asset-heading">リテイナー出品</span>${row('',fmt(character?o.retainerListedStacks||0:o.listedStacks||0)+'枠 / '+fmt(character?o.retainerListedQuantity||0:o.listedQuantity||0)+'個')}</span><small>前日比 ${assetDelta(o,'listedStacks','枠')} / ${assetDelta(o,'listedQuantity')}</small></span>`;
}
function profileAssets(o){
 const character=o.type==='キャラクター',a=o.assets||{},p=a.personal||{},r=a.retainers||{},t=a.total||{};
 const row=(label,value,total=false)=>`<div class="profile-asset-row ${total?'profile-asset-total':''}"><span>${label}</span><strong>${value}</strong></div>`;
 const panel=(title,values,note)=>`<section class="profile-asset-panel"><h3>${title}</h3>${character?row('プレイヤー',values[0])+row('リテイナー',values[1])+row('合計',values[2],true):row('所持',values[0],true)}<p>${note}</p></section>`;
 const qty=x=>fmt(x.quantity||0)+' 個',cash=x=>money(x.cashValue||0)+' / '+fmt(x.cashQuantity||0)+' 個',market=x=>money(x.marketValue||0)+' / '+fmt(x.marketQuantity||0)+' 個'+(x.marketUnknown?`<small>未取得／出品なし ${fmt(x.marketUnknown)} 個</small>`:'');
 return '<div class="profile-assets">'+panel('所持金',[money(o.gil),money(o.retainerGil),money(o.totalGil)],'前日比 '+(o.dayChange==null?'比較なし':(o.dayChange>0?'+':'')+money(o.dayChange)))+panel('所持品',[qty(p),qty(r),qty(t)],'前日比 '+assetDelta(o,'quantity')+' · 全保管先・出品中を含む')+panel('換金アイテム',[cash(p),cash(r),cash(t)],'前日比 '+assetDelta(o,'cashValue','G')+' / '+assetDelta(o,'cashQuantity'))+panel('マーケット換算',[market(p),market(r),market(t)],'前日比 '+assetDelta(o,'marketValue','G')+' / '+assetDelta(o,'marketQuantity')+' · '+esc(o.world||'ワールド不明')+' の最安値')+'</div>'+`<div class="profile-assets-footer"><span>リテイナー出品 <strong>${fmt(character?o.retainerListedStacks||0:o.listedStacks||0)} 枠 / ${fmt(character?o.retainerListedQuantity||0:o.listedQuantity||0)} 個</strong></span>${character?'<span>'+esc(ownerExtra(o))+'</span>':''}</div>`;
}
function storagePrices(r){
 const m=r.market||{},quote=prices=>prices?.[r.hq?'hq':'nq'];
 const value=q=>q?.price==null?'未取得／出品なし':money(q.price),total=q=>r.category===5||r.cashItem||m.marketable===false?'0 G':q?.price==null?'未取得／出品なし':money(q.price*r.quantity);
 const local=quote(m.local),region=quote(m.region);
 return `<td class="number">${r.sell==null?'—':money(r.sell)}<small>NQ / 個</small></td><td class="number">${r.sell==null?'—':money(r.sell*r.quantity)}</td><td class="number">${r.buy==null?'—':money(r.buy)}<small>通常 / 個</small></td><td class="number storage-market-cell"><small>保管先：${esc(m.world||'不明')}</small>${m.marketable===false?'取引不可':value(local)}<small>日本全体${region?.world?'：'+esc(region.world):''}</small>${m.marketable===false?'取引不可':value(region)}</td><td class="number storage-market-cell"><small>保管先：${esc(m.world||'不明')}</small>${total(local)}<small>日本全体</small>${total(region)}${r.category===5?'<small>アーマリーチェスト：換算対象外</small>':r.cashItem?'<small>換金アイテム：換算対象外</small>':''}</td>`;
}
function balanceCard(o){return `<button class="balance-card owner-card ${isMainCharacter(o)?'main-character':''}" data-storage-owner="${esc(o.id)}">${portrait(o)}<span class="owner-card-name"><b>${esc(o.name)}</b>${`<span class="owner-badges">${mainBadge(o)}${exclusionBadge(o)}</span>`}<small>${esc(o.world||'ワールド不明')}</small></span>${wallet(o)}<small class="owner-extra">${esc(ownerExtra(o))}</small><span class="owner-arrow" aria-hidden="true">→</span></button>`;}
function renderCollection(id,owners){
 const layout=$(id==='storageRetainerCards'?'retainerDirectoryLayout':'storageDirectoryLayout').value,el=$(id);el.className='owner-collection layout-'+layout;
 if(!owners.length){el.innerHTML='<p class="muted">該当する記録がありません。</p>';return;}
 el.innerHTML=layout==='details'?`<div class="table-scroll"><table class="owner-table"><thead><tr><th>名前 / ワールド</th><th class="number">所持金</th><th>情報</th><th>更新状況</th>${mode==='characters'&&!selectedOwner&&$('characterSort').value==='manual'?'<th>順序</th>':''}</tr></thead><tbody>${owners.map(o=>`<tr class="${isMainCharacter(o)?'main-character':''}"><td><button class="owner-table-link" data-storage-owner="${esc(o.id)}">${portrait(o)}<span><b>${esc(o.name)}</b>${mainBadge(o)}${exclusionBadge(o)}<small>${esc(o.world||'ワールド不明')}</small></span></button></td><td class="number">${wallet(o)}</td><td>${esc(ownerExtra(o))}</td><td>${esc(activityText(o))}</td>${orderButtons(o)?`<td>${orderButtons(o)}</td>`:''}</tr>`).join('')}</tbody></table></div>`:owners.map(o=>`<div class="owner-entry">${balanceCard(o)}${orderButtons(o)}</div>`).join('');
}
try{const saved=localStorage.getItem('ownerDirectoryLayout');if(['list','tile','details'].includes(saved))$('storageDirectoryLayout').value=saved;}catch{}
$('storageDirectoryLayout').onchange=()=>{try{localStorage.setItem('ownerDirectoryLayout',$('storageDirectoryLayout').value);}catch{}renderBalances();};
try{const saved=localStorage.getItem('allagan.retainerDirectoryLayout');if(['list','tile','details'].includes(saved))$('retainerDirectoryLayout').value=saved;}catch{}
$('retainerDirectoryLayout').onchange=()=>{localStorage.setItem('allagan.retainerDirectoryLayout',$('retainerDirectoryLayout').value);renderBalances();};
function renderBalances(){
 $('characterSortDirection').hidden=mode==='companies'||$('characterSort').value==='tag';
 for(const button of document.querySelectorAll('[data-character-direction]')){button.setAttribute('aria-pressed',String(button.dataset.characterDirection===characterDirection));button.disabled=$('characterSort').value==='manual';}

  const selected=directory.find(o=>o.id===selectedOwner),overview=!selectedOwner&&!highlight;
  $('storageDirectoryLayout').closest('label').hidden=!overview;
  $('storageRoster').hidden=!overview;$('storageDetail').hidden=overview;
  $('storageBack').hidden=overview;
  $('storageBack').textContent=selected?.type==='リテイナー'&&parentOwner?'← キャラクターに戻る':mode==='companies'?'← フリーカンパニー一覧へ':'← キャラクター一覧へ';
  $('storageTrail').textContent=overview?'':selected?`${mode==='companies'?'フリーカンパニー':'キャラクター'} / ${parentOwner?label(directory.find(o=>o.id===parentOwner)||{name:'キャラクター'})+' / ':''}${label(selected)}`:'アイテムの全保管先';
  if(overview){
    renderCharacterOverview();
    const q=$('storageSearch').value.normalize('NFKC').toLocaleLowerCase('ja');
    $('characterSortControl').hidden=mode==='companies';$('storageStaleControl').hidden=mode==='companies';$('storageActivityNote').hidden=mode==='companies';
    let owners=directory.filter(o=>o.type===(mode==='companies'?'FC':'キャラクター')&&(mode==='companies'||!o.portraitStatus?.excluded)&&(mode==='companies'||$('characterStatusFilter').value==='all'||($('characterStatusFilter').value==='excluded')===excludedCharacter(o))&&label(o).normalize('NFKC').toLocaleLowerCase('ja').includes(q));
    if(mode==='characters')owners=orderedCharacters(owners);visibleCharacterIds=owners.map(o=>o.id);
    $('storageRosterCount').textContent=`${owners.length} ${mode==='companies'?'FC':'キャラクター'}`;
    renderCollection('storageRosterCards',owners);
    const excluded=directory.filter(o=>o.type==='キャラクター'&&o.portraitStatus?.excluded&&label(o).normalize('NFKC').toLocaleLowerCase('ja').includes(q));
    $('excludedCharacters').hidden=mode==='companies'||!excluded.length;$('excludedCharacterCount').textContent=`顔画像を取得できないキャラクター（${excluded.length}人）`;
    $('excludedCharacterCards').innerHTML=excluded.map(o=>`<div class="excluded-character"><button data-storage-owner="${esc(o.id)}">${esc(label(o))}</button>${mainBadge(o)}${exclusionBadge(o)}<p class="muted">初回失敗：${new Date(o.portraitStatus.firstFailure).toLocaleString('ja-JP')} · ${o.portraitStatus.stopped?'自動取得停止（36時間経過）':'次回取得：'+new Date(o.portraitStatus.nextRetry).toLocaleString('ja-JP')}</p></div>`).join('');

    $('storageRetainers').hidden=true;return;
  }
  $('storageBalances').innerHTML=(selected?[selected]:data.owners).map(o=>{
    const stats=o.type==='キャラクター'?[['キャラクター所持金',money(o.gil)],['リテイナー所持金',money(o.retainerGil)+(o.retainerUnknown?'（一部未記録）':'')],['合計金額',money(o.totalGil)],['リテイナー出品数',fmt(o.retainerListedStacks||0)+'枠 / '+fmt(o.retainerListedQuantity||0)+'個'],['NPC売却（合計）・換金アイテム数量',cashText(o)]]:o.type==='FC'?[['FCチェスト所持金',money(o.gil)],['FCポイント',o.points==null?'未記録':fmt(o.points)+' pt']]:[['リテイナー所持金',money(o.gil)]];
    return `<article class="profile-summary ${isMainCharacter(o)?'main-character':''}"><div class="profile-heading">${portrait(o)}<div><small>${esc(o.type)} · ${esc(o.world||'')}</small><h2>${esc(o.name)}</h2>${mainBadge(o)}${exclusionBadge(o)}</div><div class="profile-actions">${o.type==='キャラクター'?`<a class="item-external-button" href="/api/character-link/${esc(o.id)}" target="_blank" rel="noopener noreferrer">↗ ロドストを開く</a>`:''}${o.type==='リテイナー'?`<button data-retainer-sales="${esc(o.id)}" data-sales-owner="${esc(o.parentIds?.[0]||'')}">販売履歴を見る</button><button data-money-history="retainer:${esc(o.id)}">所持ギル履歴を見る</button>`:''}${o.type!=='リテイナー'?`<button data-money-history="${o.type==='FC'?'fc:':'character:'}${esc(o.id)}">収支履歴を見る</button>`:''}</div></div>${o.type==='FC'?`<button data-money-history="points:${esc(o.id)}">FCポイント履歴 · 前日比 ${o.pointChange==null?'比較なし':(o.pointChange>0?'+':'')+fmt(o.pointChange)+' pt'}</button>`:''}${o.type==='キャラクター'?`<div class="character-exclusion"><label><input type="checkbox" data-exclude-character="${esc(o.id)}" ${excludedOwnerIds.has(o.id)?'checked':''}> このキャラクターを除外する</label>${o.stale?'<small>1週間以上更新がないため、自動除外の対象です。</small>':''}</div><div class="character-tags"><span>タグ</span>${[['main','★ メイン'],['sub','サブ'],['submarine','潜水艦用']].map(([tag,name])=>`<label><input type="checkbox" data-character-tag="${tag}" data-tag-owner="${esc(o.id)}" ${(characterTags[o.id]||[]).includes(tag)?'checked':''}><span class="main-character-badge tag-${tag}">${name}</span></label>`).join('')}${(characterTags[o.id]||[]).includes('sub')?`<label>サブ番号<input class="sub-number" type="number" min="1" max="9999" step="1" placeholder="未設定" aria-label="サブ番号" data-sub-number="${esc(o.id)}" value="${esc(subNumbers[o.id]||'')}"></label>`:''}</div>`:''}${o.type!=='FC'?profileAssets(directory.find(x=>x.id===o.id)||o):`<div class="profile-finances">${stats.map(([title,value])=>`<div><span>${title}</span><strong>${value}</strong></div>`).join('')}</div>${o.type!=='リテイナー'?`<p class="profile-change">前日比 ${o.dayChange==null?'比較なし':(o.dayChange>0?'+':'')+money(o.dayChange)}</p>`:''}`}</article>`;
  }).join('');
  const children=selected?.type==='キャラクター'?directory.filter(o=>o.type==='リテイナー'&&o.parentIds?.includes(selected.id)):[];
  $('storageRetainers').hidden=selected?.type!=='キャラクター';
  $('storageRetainerCount').textContent=`リテイナー一覧（${children.length}人）`;
  renderCollection('storageRetainerCards',children);
  $('storageItemsHeading').textContent=selected?.type==='FC'?'FCチェスト':selected?.type==='リテイナー'?'リテイナーの所持品':'キャラクターの所持品';
}
function slotButton(r,c){return `<button class="bag-slot ${r.highlighted?'matched':highlight?'dimmed':''}" data-slot-owner="${esc(r.owner)}" data-slot-container="${c.id}" data-slot="${r.slot}" title="${esc(r.name)}${r.hq?' HQ':''}${r.collectable?' 収集品':''} × ${fmt(r.quantity)} / スロット ${r.slot+1}" aria-label="${esc(r.name)} ${r.hq?'HQ ':''}${fmt(r.quantity)}個、スロット${r.slot+1}${r.highlighted?'、一致':''}"><img data-image="/api/icon/${r.id}" alt="" width="40" height="40" loading="lazy"><span class="slot-quantity">${fmt(r.quantity)}</span>${r.hq?'<span class="slot-quality">HQ</span>':r.collectable?'<span class="slot-quality">収</span>':''}${r.highlighted?'<span class="slot-match" aria-hidden="true">◆</span>':''}</button>`;}
let storageTab='inventory';
const tabDefs=[['inventory','所持品',[1,4,8,13]],['saddle','チョコボかばん',[2,3]],['equipment','装備・アーマリーチェスト',[5,6,7]],['dresser','ミラージュドレッサー',[10]],['cabinet','愛蔵品キャビネット',[11]],['market','出品中',[9]],['other','その他',[14,15,16,17,18,19,99]]];
let sectionLayouts={};try{sectionLayouts=JSON.parse(localStorage.getItem('allagan.sectionLayouts')||'{}')||{};}catch{}
const sectionLayout=c=>sectionLayouts[c.owner+':'+(tabDefs.find(t=>t[2].includes(c.category))?.[0]||'other')]||'grid';
let sectionSorts={};try{sectionSorts=JSON.parse(localStorage.getItem('allagan.sectionSorts')||'{}')||{};}catch{}
function sectionSortControls(id){const v=sectionSorts[id]||{key:'slot',direction:'asc'};return `<label>ソート <select data-section-sort="${esc(id)}">${[['slot','位置順'],['name','名前順'],['quantity','個数順'],['sell','NPC売却順'],['sellTotal','NPC売却（合計）順'],['buy','NPC購入順'],['local','マーケット価格順（保管先）'],['localTotal','マーケット合計順（保管先）'],['region','マーケット価格順（日本全体）'],['regionTotal','マーケット合計順（日本全体）']].map(([key,label])=>`<option value="${key}" ${key===v.key?'selected':''}>${label}</option>`).join('')}</select></label><span class="sort-direction" role="group" aria-label="ソート方向"><button data-section-direction="${esc(id)}" data-direction="asc" aria-pressed="${v.direction==='asc'}">↑ 昇順</button><button data-section-direction="${esc(id)}" data-direction="desc" aria-pressed="${v.direction==='desc'}">↓ 降順</button></span><small>各保管枠内でソート（ページ表示は現在のページ内）</small>`;}
function sortedStorageItems(c){const id=c.owner+':'+(tabDefs.find(t=>t[2].includes(c.category))?.[0]||'other'),v=sectionSorts[id]||{key:'slot',direction:'asc'},direction=v.direction==='desc'?-1:1;
 const value=r=>{if(v.key==='slot')return r.slot;if(v.key==='quantity')return r.quantity;if(v.key==='sell')return r.sell;if(v.key==='buy')return r.buy;if(v.key==='sellTotal')return r.sell==null?null:r.sell*r.quantity;const total=v.key.endsWith('Total'),scope=v.key.startsWith('local')?'local':'region';if(total&&(r.cashItem||r.category===5||r.market?.marketable===false))return 0;const price=r.market?.[scope]?.[r.hq?'hq':'nq']?.price;return price==null?null:price*(total?r.quantity:1);};
 return c.items.toSorted((a,b)=>{if(v.key==='name')return direction*a.name.localeCompare(b.name,'ja')||a.slot-b.slot;const av=value(a),bv=value(b);if(av==null||bv==null)return av==null?(bv==null?a.slot-b.slot:1):-1;return direction*(av-bv)||a.slot-b.slot;});
}
function sectionContents(owner,key,containers){const id=owner+':'+key,layout=sectionLayouts[id]||'grid';return `<div class="section-layout"><label>表示形式 <select data-section-layout="${esc(id)}" aria-label="${esc(tabDefs.find(t=>t[0]===key)?.[1]||'保管先')}の表示形式"><option value="grid" ${layout==='grid'?'selected':''}>バッグ</option><option value="list" ${layout==='list'?'selected':''}>リスト（詳細）</option></select></label>${layout==='list'?sectionSortControls(id):''}<button data-section-market="${esc(id)}" data-market-owner="${esc(owner)}" data-market-categories="${esc(JSON.stringify(tabDefs.find(t=>t[0]===key)?.[2]||[]))}">この保管先の価格を更新</button></div>`+containers.map(c=>containerHtml(c)).join('');}
let disclosureScope='', disclosureState=new Map(), lazySections=new Map();
function disclosure(key,title,body,defaultOpen=false,lazy=false){
 const open=highlight?true:(disclosureState.get(key)??defaultOpen);
 if(lazy)lazySections.set(key,body);
 return `<details class="storage-disclosure" data-storage-node="${esc(key)}" ${open?'open':''}><summary>${title}</summary><div class="${lazy?'bag-panels':'storage-branches'}" ${lazy&&open?'data-loaded="1"':''}>${!lazy||open?body():''}</div></details>`;
}
function embeddedSales(o){return `<details class="storage-disclosure embedded-sales" data-sales-scope="${esc(o.id)}" data-sales-type="${o.type==='キャラクター'?'character':'retainer'}"><summary>マーケット販売履歴${o.type==='キャラクター'?'（所属リテイナー合計）':''}</summary><div class="embedded-sales-body"><p class="muted">開くと販売履歴を読み込みます。</p></div></details>`;}
async function loadEmbeddedSales(el,page=1){
 if(el.dataset.busy)return;el.dataset.busy='1';const body=el.querySelector('.embedded-sales-body');
 try{const p=new URLSearchParams({[el.dataset.salesType]:el.dataset.salesScope,page:String(page)}),d=await json('/api/sales?'+p);if(!el.isConnected)return;const signature=JSON.stringify(d);if(el.dataset.salesSignature===signature)return;el.dataset.salesSignature=signature;el.dataset.salesPage=String(d.page);
 const fee=Math.floor(d.summary.gross*.1);body.innerHTML=`${d.error?'<p class="warning">'+esc(d.error)+'</p>':''}<div class="embedded-sales-summary"><strong>売上合計 ${money(d.summary.gross)}</strong><span>${fmt(d.summary.count)}件 / ${fmt(d.summary.quantity)}個 · 全期間</span><small>手数料10%（概算） ${money(fee)} / 差引 ${money(d.summary.gross-fee)}</small></div><div class="table-scroll"><table><thead><tr><th>記録日時</th><th>アイテム</th><th>リテイナー</th><th>個数</th><th>単価</th><th>販売額</th></tr></thead><tbody>${d.items.map(r=>`<tr><td>${esc(r.detectedAt.replace('T',' '))}</td><td><div class="item-identity"><img class="item-icon" data-image="/api/icon/${r.itemId}" width="40" height="40" alt=""><button data-embedded-item="${r.itemId}">${esc(r.name)}${r.hq?' HQ':''}</button></div></td><td>${esc(r.retainerName)}<small> @ ${esc(r.world)}</small></td><td class="number">${fmt(r.quantity)}</td><td class="number">${money(r.unitPrice)}</td><td class="number">${money(r.gross)}</td></tr>`).join('')||'<tr><td colspan="6">販売履歴はありません。</td></tr>'}</tbody></table></div><div class="embedded-sales-paging"><button data-embedded-page="${d.page-1}" ${d.page<=1?'disabled':''}>← 前へ</button><span>${d.page} / ${d.pages} ページ</span><button data-embedded-page="${d.page+1}" ${d.page>=d.pages?'disabled':''}>次へ →</button><button data-embedded-page="${d.page}">再読み込み</button></div>`;el.dataset.loaded='1';
 }catch(e){body.innerHTML='<p class="warning">'+esc(e.message)+'</p><button data-embedded-page="1">再試行</button>';}finally{delete el.dataset.busy;}
}
$('storageContents').addEventListener('toggle',e=>{if(e.target.matches('.embedded-sales')&&e.target.open&&!e.target.dataset.loaded)loadEmbeddedSales(e.target);},true);
$('storageContents').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.embeddedPage)loadEmbeddedSales(b.closest('.embedded-sales'),Number(b.dataset.embeddedPage));if(b.dataset.embeddedItem)document.dispatchEvent(new CustomEvent('open-item-detail',{detail:{id:Number(b.dataset.embeddedItem)}}));});
function renderStorageTree(){
 const scope=selectedOwner+':'+highlight;
 if(disclosureScope!==scope){disclosureScope=scope;disclosureState.clear();}
 lazySections.clear();
 const ownerTree=o=>{
  const containers=data.containers.filter(c=>c.owner===o.id).sort((a,b)=>Number(a.category===13||[2001,12001,22001].includes(a.id))-Number(b.category===13||[2001,12001,22001].includes(b.id)));
  if(highlight&&!containers.length)return '';
  const groups=tabDefs.filter(t=>containers.some(c=>t[2].includes(c.category)));
  const listing=o.type==='リテイナー'?` · 出品 ${fmt(o.listedStacks||0)}枠 / ${fmt(o.listedQuantity||0)}個`:'';
  return disclosure('owner:'+o.id,`${esc(label(o))} <small>${esc(o.type)} · ${money(o.gil)}${listing}</small>`,()=>groups.map(([key,title,categories])=>disclosure(o.id+':'+key,title,()=>sectionContents(o.id,key,containers.filter(c=>categories.includes(c.category))),(o.type!=='リテイナー'||o.id===selectedOwner)&&(key==='inventory'||key==='saddle'),true)+(o.type==='リテイナー'&&o.id===selectedOwner&&key==='market'?embeddedSales(o):'')).join('')+(o.type==='リテイナー'&&o.id===selectedOwner&&!groups.some(g=>g[0]==='market')?embeddedSales(o):'')||'<p class="muted">この条件の保管先は記録されていません。</p>',o.type!=='リテイナー'||o.id===selectedOwner);
 };
 const selected=directory.find(o=>o.id===selectedOwner);
 if(selected?.type==='キャラクター'){
  const retainers=data.owners.filter(o=>o.type==='リテイナー');
  const known=retainers.reduce((n,o)=>n+(o.gil??0),0),unknown=retainers.some(o=>o.gil==null);
  const summary=`リテイナー <small>${retainers.length}人 · 合計所持金 ${money(known)} · 合計出品 ${fmt(retainers.reduce((n,o)=>n+(o.listedStacks||0),0))}枠 / ${fmt(retainers.reduce((n,o)=>n+(o.listedQuantity||0),0))}個</small>`;
  return ownerTree(selected)+disclosure('retainers:'+selectedOwner,summary,()=>retainers.map(ownerTree).join('')||'<p class="muted">リテイナーの記録はありません。</p>')+embeddedSales(selected);
 }
 return data.owners.map(ownerTree).join('')||'<p class="empty">該当する保管先はありません。</p>';
}
function dresserHtml(c){
 const controls=`<div class="dresser-pagination"><button data-dresser-container="${c.id}" data-dresser-owner="${esc(c.owner)}" data-dresser-page="${c.page-1}" ${c.page<=1?'disabled':''}>← 前へ</button><span>${c.page} / ${c.pages} ページ · ${c.total}件</span><button data-dresser-container="${c.id}" data-dresser-owner="${esc(c.owner)}" data-dresser-page="${c.page+1}" ${c.page>=c.pages?'disabled':''}>次へ →</button></div>`;
 const matches=c.matchPages.length?`<div class="dresser-matches">一致するページ：${c.matchPages.map(p=>`<button data-dresser-container="${c.id}" data-dresser-owner="${esc(c.owner)}" data-dresser-page="${p}" ${p===c.page?'disabled':''}>${p}</button>`).join('')}</div>`:'';
 return `<section class="dresser-panel" data-dresser="${esc(c.owner)}"><h3>${esc(c.name)} <small>保存順 / 1ページ50件</small></h3>${controls}${matches}${sectionLayout(c)==='grid'?`<div class="dresser-grid">${c.items.map(r=>slotButton(r,c)).join('')}${Array.from({length:50-c.items.length},()=>'<span class="bag-slot empty-slot" aria-hidden="true"></span>').join('')}</div>`:containerHtml({...c,pageHandled:true},true)}${controls}<p class="bag-note">現在のページだけを読み込みます。ゲーム内の絞り込み・並べ替えによってソートは異なります。</p></section>`;
}
function containerHtml(c,expanded=false){
  if([2500,2501].includes(c.id)&&c.paged&&!c.pageHandled)return dresserHtml(c);
  if(c.items.length>80&&!highlight&&!expanded)return `<details class="deferred-container" data-container-owner="${esc(c.owner)}" data-container-id="${c.id}"><summary>${esc(c.name)} · ${c.items.length}スタック（開いて表示）</summary><div></div></details>`;
  const header=`<h3>${esc(c.name)} <small>${c.items.length}スタック${c.matches?' · 一致 '+c.matches:''}</small></h3>`;
  if(sectionLayout(c)==='grid'&&c.grid&&c.size<=500){
    const slots=new Map(c.items.map(r=>[r.slot,r]));
    return `<section class="bag-panel">${header}<div class="bag-grid">${Array.from({length:c.size},(_,i)=>slots.has(i)?slotButton(slots.get(i),c):`<span class="bag-slot empty-slot" title="スロット ${i+1}：保存データ上の配置なし" aria-label="スロット${i+1}：配置なし"><small>${i+1}</small></span>`).join('')}</div><p class="bag-note">左から右へ、上から下へ（保存時の配置）</p></section>`;
  }
  return `<section class="storage-list-panel">${header}<div class="table-scroll"><table><thead><tr><th>位置</th><th>アイテム</th><th class="number">個数</th><th class="number">NPC売却</th><th class="number">NPC売却（合計）</th><th class="number">NPC購入</th><th class="number">マーケット価格</th><th class="number">マーケット合計</th><th></th></tr></thead><tbody>${sortedStorageItems(c).map(r=>`<tr class="${r.highlighted?'matched-row':''}"><td>${r.slot+1}</td><td><div class="item-identity"><img class="item-icon" data-image="/api/icon/${r.id}" alt="" width="40" height="40" loading="lazy"><button class="storage-item-name" data-slot-owner="${esc(r.owner)}" data-slot-container="${c.id}" data-slot="${r.slot}">${esc(r.name)} ${r.hq?'<small>HQ</small>':r.collectable?'<small>収集品</small>':''}</button></div></td><td class="number">${fmt(r.quantity)}</td>${storagePrices(r)}<td><button data-storage-highlight="${r.id}">同じアイテムを強調</button></td></tr>`).join('')||'<tr><td colspan="9">保存データ上のアイテムなし</td></tr>'}</tbody></table></div>${!c.grid?'<p class="muted">この保管先は一覧形式で表示します。位置は保存スロット番号です。</p>':''}</section>`;
}
function render(){
  renderBalances();
  const currencies=(data.currencies||[]).filter(r=>!selectedOwner||r.owner===selectedOwner);$('storageCurrencySection').hidden=!currencies.some(r=>r.id!==1&&r.id!==80);$('storageCurrencyCount').textContent=currencies.filter(r=>r.id!==1&&r.id!==80).length+'種類';$('storageCurrencyTable').innerHTML=currencyPanels(currencies);
  $('storageHighlight').hidden=!highlight;
  $('storageMatchText').textContent=`${data.highlightName}：${fmt(data.matches)}スタック / ${fmt(data.quantity)}個をハイライト（表示中の範囲）`;
  $('storageDate').textContent='データ保存日時：'+(data.updatedAt?new Date(data.updatedAt).toLocaleString('ja-JP'):'未記録');
  $('storageTabs').hidden=true;
  $('storageContents').innerHTML=renderStorageTree();
}
export async function loadStorage(){
  const seq=++sequence;
  try{
    const index=await json('/api/owners');if(seq!==sequence)return;directory=index.owners;
    const p=new URLSearchParams({owner:selectedOwner,children:'1',category:'',highlight:String(highlight),paged:'1'});
    const cabinet=dresserPages.get(selectedOwner+':'+highlight+':2500');if(cabinet)p.set('cabinetPage',String(cabinet));
    const savedPage=dresserPages.get(selectedOwner+':'+highlight);if(savedPage)p.set('dresserPage',String(savedPage));
    const next=selectedOwner||highlight?await json('/api/storage?'+p):{owners:[],containers:[],categories:[],updatedAt:index.updatedAt};if(seq!==sequence)return;
    const signature=JSON.stringify([mode,selectedOwner,highlight,index.owners,index.activityWarning,{...next,updatedAt:null}]);if(signature===lastPayload){$('storageDate').textContent='データ保存日時：'+(next.updatedAt?new Date(next.updatedAt).toLocaleString('ja-JP'):'未記録');return;}lastPayload=signature;data=next;committedCategory=p.get('category')||'';
    const category=$('storageCategory').value;$('storageCategory').innerHTML='<option value="">すべて</option>'+data.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');$('storageCategory').value=category;
    $('storageWarning').hidden=!index.activityWarning;$('storageWarning').textContent=index.activityWarning||'';render();
  }catch(e){if(seq===sequence){$('storageWarning').hidden=false;$('storageWarning').textContent=e.message;}}
}
export async function openStorage(owner='',item=0){
  highlight=item;storageTab=item?'all':'inventory';selectedOwner=owner;parentOwner='';
  const index=await json('/api/owners');directory=index.owners;
  const selected=directory.find(o=>o.id===owner);mode=selected?.type==='FC'?'companies':owner?'characters':'storage';
  if(selected?.type==='リテイナー')parentOwner=selected.parentIds?.find(id=>directory.some(o=>o.id===id&&o.type==='キャラクター'))||'';
  $('storageCategory').value='';$('storageLayout').value=localStorage.getItem('allagan.storageLayout')||'grid';await loadStorage();return mode;
}
$('storageBack').onclick=async()=>{storageBefore();selectedOwner=parentOwner||'';parentOwner='';highlight=0;$('storageCategory').value='';await loadStorage();storageAfter();};
$('storageSearch').oninput=()=>renderBalances();
$('storageCategory').onchange=async()=>{storageBefore();await loadStorage();storageAfter();};$('storageLayout').value=localStorage.getItem('allagan.storageLayout')||'grid';$('storageLayout').onchange=()=>{localStorage.setItem('allagan.storageLayout',$('storageLayout').value);if(data)render();};
$('clearHighlight').onclick=async()=>{storageBefore();highlight=0;storageTab='inventory';await loadStorage();storageAfter();};
const dialog=document.createElement('dialog');dialog.id='slotDialog';document.body.append(dialog);
$('storageView').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.sectionMarket){document.dispatchEvent(new CustomEvent('update-section-market',{detail:{button:b,owner:b.dataset.marketOwner,categories:JSON.parse(b.dataset.marketCategories)}}));return;}
  if(b.dataset.storageTab){storageBefore();storageTab=b.dataset.storageTab;render();storageAfter();return;}
  if(b.dataset.dresserOwner){
    storageBefore();const panel=b.closest('.dresser-panel'),owner=b.dataset.dresserOwner,requested=b.dataset.dresserPage,containerId=Number(b.dataset.dresserContainer),cabinet=containerId===2500;
    if(panel.getAttribute('aria-busy')==='true')return;panel.setAttribute('aria-busy','true');
    try{const next=await json('/api/storage?'+new URLSearchParams({owner,category:cabinet?'11':'10',highlight:String(highlight),paged:'1',[cabinet?'cabinetPage':'dresserPage']:requested}));if(!panel.isConnected)return;const c=next.containers.find(c=>c.id===containerId);if(!c)throw new Error('ドレッサーの記録がありません。');dresserPages.set(owner+':'+highlight+(cabinet?':2500':''),c.page);data.containers=data.containers.map(old=>old.owner===owner&&old.id===containerId?c:old);panel.outerHTML=dresserHtml(c);storageAfter();}catch(err){$('storageWarning').hidden=false;$('storageWarning').textContent=err.message;}finally{panel.removeAttribute('aria-busy');}return;
  }
  if(b.dataset.moveOwner){const index=visibleCharacterIds.indexOf(b.dataset.moveOwner),other=visibleCharacterIds[index+Number(b.dataset.move)];if(!other)return;const a=manualOrder.indexOf(b.dataset.moveOwner),z=manualOrder.indexOf(other);[manualOrder[a],manualOrder[z]]=[manualOrder[z],manualOrder[a]];try{localStorage.setItem('characterManualOrder',JSON.stringify(manualOrder));}catch{}renderBalances();const button=[...$('storageRosterCards').querySelectorAll('[data-move-owner]')].find(el=>el.dataset.moveOwner===b.dataset.moveOwner&&el.dataset.move===b.dataset.move);button?.focus();return;}
  if(b.dataset.storageOwner){storageBefore();const next=directory.find(o=>o.id===b.dataset.storageOwner);parentOwner=next?.type==='リテイナー'?selectedOwner:'';selectedOwner=b.dataset.storageOwner;storageTab='inventory';highlight=0;$('storageCategory').value='';await loadStorage();$('storageBack').focus();storageAfter();}
  if(b.dataset.storageHighlight){storageBefore();storageTab='all';highlight=Number(b.dataset.storageHighlight);await loadStorage();storageAfter();}
  if(b.dataset.slotOwner){
    const c=data.containers.find(c=>c.owner===b.dataset.slotOwner&&c.id===Number(b.dataset.slotContainer)),r=c?.items.find(r=>r.slot===Number(b.dataset.slot));if(!r)return;
    const o=data.owners.find(o=>o.id===r.owner);
    document.dispatchEvent(new CustomEvent('open-item-detail',{detail:{id:r.id,owner:o.id,character:o.type==='キャラクター'?o.id:o.parentIds?.[0]||'',slot:{owner:label(o),place:c.name,slot:r.slot+1,quantity:r.quantity,hq:r.hq}}}));

  }
});

$('storageContents').addEventListener('toggle',e=>{
 const el=e.target;if(!el.matches('[data-storage-node]')||!el.isConnected)return;
 disclosureState.set(el.dataset.storageNode,el.open);
 document.dispatchEvent(new Event('storage-state-changed'));
 const body=el.querySelector(':scope > div'),renderBody=lazySections.get(el.dataset.storageNode);
 if(el.open&&renderBody&&!body.dataset.loaded){body.dataset.loaded='1';body.innerHTML=renderBody();}
},true);

$('storageContents').addEventListener('toggle',e=>{const el=e.target;if(!el.matches('.deferred-container')||!el.open||el.dataset.loaded)return;const c=data?.containers.find(c=>c.owner===el.dataset.containerOwner&&c.id===Number(el.dataset.containerId));if(c){el.dataset.loaded='1';el.querySelector('div').innerHTML=containerHtml(c,true);}},true);

export function storageNavigation(){return {disclosures:[...disclosureState],disclosureScope,storageTab,mode,selectedOwner,parentOwner,highlight,category:committedCategory,layout:$('storageLayout').value,dresserPages:[...dresserPages]};}
export async function restoreStorageNavigation(saved){
 disclosureScope=saved.disclosureScope||'';disclosureState=new Map(saved.disclosures||[]);
 storageTab=saved.storageTab||'inventory';sequence++;lastPayload='';mode=saved.mode;selectedOwner=saved.selectedOwner;parentOwner=saved.parentOwner;highlight=saved.highlight;
 dresserPages.clear();for(const [k,v] of saved.dresserPages||[])dresserPages.set(k,v);
 $('storageLayout').value=saved.layout||'grid';
 const category='';if(category&&!Array.from($('storageCategory').options).some(o=>o.value===category))$('storageCategory').add(new Option('保管場所',category));$('storageCategory').value=category;
 await loadStorage();
}
function storageBefore(){document.dispatchEvent(new Event('storage-will-navigate'));}
function storageAfter(){document.dispatchEvent(new Event('storage-did-navigate'));}


$('storageView').addEventListener('change',event=>{const el=event.target;if(el.dataset.subNumber){if(el.value&&!el.checkValidity()){el.reportValidity();return;}if(el.value)subNumbers[el.dataset.subNumber]=Number(el.value);else delete subNumbers[el.dataset.subNumber];localStorage.setItem('allagan.subNumbers',JSON.stringify(subNumbers));renderBalances();return;}if(!el.dataset.characterTag)return;const tags=new Set(characterTags[el.dataset.tagOwner]||[]);if(el.checked){if(el.dataset.characterTag==='sub'&&!tags.has('sub')){const used=new Set(Object.entries(characterTags).filter(([id,values])=>id!==el.dataset.tagOwner&&values.includes('sub')).map(([id])=>Number(subNumbers[id])).filter(n=>Number.isInteger(n)&&n>0));let number=1;while(used.has(number))number++;subNumbers[el.dataset.tagOwner]=number;localStorage.setItem('allagan.subNumbers',JSON.stringify(subNumbers));}tags.add(el.dataset.characterTag);}else tags.delete(el.dataset.characterTag);characterTags[el.dataset.tagOwner]=[...tags];localStorage.setItem('allagan.characterTags',JSON.stringify(characterTags));renderBalances();});

$('storageView').addEventListener('input',event=>{const el=event.target;if(!el.dataset.subNumber||!el.checkValidity())return;if(el.value)subNumbers[el.dataset.subNumber]=Number(el.value);else delete subNumbers[el.dataset.subNumber];localStorage.setItem('allagan.subNumbers',JSON.stringify(subNumbers));const badge=$('storageBalances').querySelector('.profile-heading .tag-sub');if(badge)badge.textContent='サブ'+(el.value?' №'+Number(el.value):'');});

$('storageContents').addEventListener('change',event=>{const el=event.target;if(!el.dataset.sectionLayout)return;sectionLayouts[el.dataset.sectionLayout]=el.value;localStorage.setItem('allagan.sectionLayouts',JSON.stringify(sectionLayouts));const section=el.closest('[data-storage-node]'),body=section.querySelector(':scope > div');body.innerHTML=lazySections.get(el.dataset.sectionLayout)();body.dataset.loaded='1';});

$('storageView').addEventListener('change',event=>{const el=event.target;if(!el.dataset.excludeCharacter)return;if(el.checked)excludedOwnerIds.add(el.dataset.excludeCharacter);else excludedOwnerIds.delete(el.dataset.excludeCharacter);localStorage.setItem('allagan.excludedCharacters',JSON.stringify([...excludedOwnerIds]));document.dispatchEvent(new CustomEvent('character-exclusions-changed',{detail:[...excludedOwnerIds]}));renderBalances();});

$('storageContents').addEventListener('change',event=>{const el=event.target,id=el.dataset.sectionSort||el.dataset.sectionDirection;if(!id)return;const current=sectionSorts[id]||{key:'slot',direction:'asc'};sectionSorts[id]={...current,[el.dataset.sectionSort?'key':'direction']:el.value};localStorage.setItem('allagan.sectionSorts',JSON.stringify(sectionSorts));const body=el.closest('[data-storage-node]').querySelector(':scope > div');body.innerHTML=lazySections.get(id)();body.dataset.loaded='1';storageAfter();});

$('storageContents').addEventListener('click',event=>{const button=event.target.closest('button[data-section-direction]');if(!button)return;const id=button.dataset.sectionDirection;sectionSorts[id]={...(sectionSorts[id]||{key:'slot'}),direction:button.dataset.direction};localStorage.setItem('allagan.sectionSorts',JSON.stringify(sectionSorts));const body=button.closest('[data-storage-node]').querySelector(':scope > div');body.innerHTML=lazySections.get(id)();body.dataset.loaded='1';storageAfter();});

export async function refreshOpenSales(){await Promise.all([...document.querySelectorAll('.embedded-sales[open]')].filter(el=>el.getClientRects().length).map(el=>loadEmbeddedSales(el,Number(el.dataset.salesPage)||1)));}
