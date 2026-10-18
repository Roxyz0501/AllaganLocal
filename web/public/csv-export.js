import {translateText} from './i18n.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const csvCell=value=>'"'+String(value??'').replace(/^(\s*[=+@-]|[\t\r\n])/,"'$1").replaceAll('"','""')+'"';
export const csvColumns=entries=>entries.map(([id,label,def=true])=>({id,label,default:def}));
export async function* pagedCsvRows(endpoint,params,first,map,scope){
 if(scope==='page'){for(const row of first?.items||[])yield map(row);return;}
 const p=new URLSearchParams(params);p.set('export','1');let revision;
 for(let page=1;;page++){
  p.set('page',String(page));const res=await fetch(endpoint+'?'+p);const d=await res.json();if(!res.ok||d.error)throw new Error(d.error||'CSV出力に失敗しました。');
  const current=d.revision??d.updatedAt;if(page===1)revision=current;else if(current!==revision)throw new Error('出力中にデータが更新されました。もう一度出力してください。');
  for(const row of d.items)yield map(row);if(page>=d.pages)break;
 }
}
export function tableCsvSources(root){
 return [...root.querySelectorAll('table')].filter(t=>!t.closest('[hidden]')&&t.getClientRects().length).map((table,index)=>{
  const headers=[...table.querySelectorAll('thead th')],ids=headers.map((_,i)=>'column'+i),columns=headers.map((h,i)=>({id:ids[i],label:h.innerText.trim()||h.textContent.trim(),default:getComputedStyle(h).display!=='none'})).filter(c=>c.label&&!['マイリスト','削除','操作','お気に入り'].includes(c.label));
  const rows=[...table.querySelectorAll('tbody tr')].filter(tr=>tr.cells.length===headers.length).map(tr=>Object.fromEntries([...tr.cells].map((td,i)=>[ids[i],td.innerText.trim()])));
  return {id:table.id||'table-'+index,label:table.closest('[id]')?.previousElementSibling?.textContent?.slice(0,45)||'一覧 '+(index+1),columns,pageOnly:true,async *rows(){yield* rows;}};
 }).filter(s=>s.columns.length);
}
const dialog=document.createElement('dialog');dialog.id='csvDialog';dialog.className='csv-dialog';dialog.innerHTML=`<form method="dialog"><div class="dialog-heading"><h2>CSV出力</h2><button aria-label="閉じる">×</button></div></form><label>一覧<select id="csvSource"></select></label><label>出力範囲<select id="csvScope"><option value="page">表示中のページ</option><option value="all">絞り込み結果すべて</option></select></label><div class="csv-presets"><label>マイセット<select id="csvPreset"><option value="">表示列（デフォルト）</option></select></label><button id="csvApply">読み込む</button><input id="csvPresetName" maxlength="60" placeholder="マイセット名" aria-label="マイセット名"><button id="csvSave">保存</button><button id="csvDelete">削除</button></div><p>出力する列を選択し、矢印で順番を変更できます。</p><div id="csvColumns"></div><p id="csvMessage" role="status"></p><div class="csv-actions"><button id="csvDefault">表示列に戻す</button><button id="csvDownload" class="primary">CSVを保存</button><button id="csvCancel" hidden>中止</button></div>`;
document.body.append(dialog);const $=id=>document.getElementById(id);let sources=[],order=[],selected=new Set(),busy=false,cancelled=false;
const storageKey='allagan.csvPresets.v1';let presets=[];try{const p=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(p))presets=p.slice(0,100).filter(x=>typeof x.name==='string'&&typeof x.source==='string'&&Array.isArray(x.columns));}catch{}
const source=()=>sources.find(s=>s.id===$('csvSource').value);
function presetList(){$('csvPreset').innerHTML='<option value="">表示列（デフォルト）</option>'+presets.filter(p=>p.source===source()?.id).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');}
function renderColumns(){const columns=new Map(source().columns.map(c=>[c.id,c]));$('csvColumns').innerHTML=order.map((id,i)=>`<div class="csv-column"><label><input type="checkbox" data-csv-column="${esc(id)}" ${selected.has(id)?'checked':''}>${esc(columns.get(id).label)}</label><button data-csv-move="${i}" data-step="-1" aria-label="上へ" ${i===0?'disabled':''}>↑</button><button data-csv-move="${i}" data-step="1" aria-label="下へ" ${i===order.length-1?'disabled':''}>↓</button></div>`).join('');}
function defaults(){$('csvScope').querySelector('[value=all]').disabled=!!source().pageOnly;if(source().pageOnly)$('csvScope').value='page';order=source().columns.map(c=>c.id);selected=new Set(source().columns.filter(c=>c.default!==false).map(c=>c.id));renderColumns();}
export function openCsvExport(available){sources=available;if(!sources.length)return; $('csvSource').innerHTML=sources.map(s=>`<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');$('csvMessage').textContent='';$('csvPresetName').value='';defaults();presetList();dialog.showModal();}
$('csvSource').onchange=()=>{defaults();presetList();};$('csvDefault').onclick=defaults;
$('csvColumns').onchange=e=>{const id=e.target.dataset.csvColumn;if(id)e.target.checked?selected.add(id):selected.delete(id);};
$('csvColumns').onclick=e=>{const b=e.target.closest('[data-csv-move]');if(!b)return;const i=Number(b.dataset.csvMove),j=i+Number(b.dataset.step);[order[i],order[j]]=[order[j],order[i]];renderColumns();};
$('csvApply').onclick=()=>{const p=presets.find(p=>p.id===$('csvPreset').value);if(!p)return defaults();const valid=new Set(source().columns.map(c=>c.id)),saved=p.columns.filter(id=>valid.has(id));order=[...saved,...source().columns.map(c=>c.id).filter(id=>!saved.includes(id))];selected=new Set(saved);$('csvPresetName').value=p.name;renderColumns();};
function persist(next){try{localStorage.setItem(storageKey,JSON.stringify(next));presets=next;presetList();$('csvMessage').textContent='マイセットを保存しました。';}catch{$('csvMessage').textContent='マイセットを保存できません。このブラウザの保存設定を確認してください。';}}
$('csvSave').onclick=()=>{const name=$('csvPresetName').value.trim();if(!name||!selected.size){$('csvMessage').textContent='名前と出力列を指定してください。';return;}const existing=presets.find(p=>p.source===source().id&&p.name===name);if(!existing&&presets.length>=100){$('csvMessage').textContent='マイセットは100件まで保存できます。';return;}const p={id:existing?.id||crypto.randomUUID(),source:source().id,name,columns:order.filter(id=>selected.has(id))};persist([...presets.filter(x=>x.id!==p.id),p]);$('csvPreset').value=p.id;};
$('csvDelete').onclick=()=>{const id=$('csvPreset').value;if(id)persist(presets.filter(p=>p.id!==id));};
$('csvCancel').onclick=()=>{cancelled=true;};dialog.addEventListener('cancel',e=>{if(busy){e.preventDefault();cancelled=true;}});
$('csvDownload').onclick=async()=>{
 if(busy)return;const s=source(),keys=order.filter(id=>selected.has(id));if(!keys.length){$('csvMessage').textContent='出力列を選択してください。';return;}
 busy=true;cancelled=false;const controls=[...dialog.querySelectorAll('input,select,button')];for(const c of controls)c.disabled=true;$('csvCancel').hidden=false;$('csvCancel').disabled=false;
 const scope=$('csvScope').value;let writable,parts=[],bytes=0,count=0;const encoder=new TextEncoder();
 try{
  const name=(s.label.replace(/[\\/:*?"<>|]/g,'_').slice(0,60)||'export')+'.csv';
  if(window.showSaveFilePicker){const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'CSV',accept:{'text/csv':['.csv']}}]});writable=await handle.createWritable();}
  const append=async text=>{if(cancelled)throw new Error('出力を中止しました。');const data=encoder.encode(text);bytes+=data.length;if(writable)await writable.write(data);else{if(bytes>50*1024*1024)throw new Error('出力が50MBを超えました。期間などを絞り込んでください。');parts.push(data);}};
  await append('\uFEFF'+keys.map(id=>csvCell(translateText(s.columns.find(c=>c.id===id).label))).join(',')+'\r\n');let chunk='';
  for await(const row of s.rows(scope)){if(cancelled)throw new Error('出力を中止しました。');chunk+=keys.map(id=>csvCell(row[id])).join(',')+'\r\n';if(++count%100===0){await append(chunk);chunk='';$('csvMessage').textContent=`${count}件 出力中`;await new Promise(r=>setTimeout(r,0));}}
  if(chunk)await append(chunk);if(writable){await writable.close();writable=null;}else{const url=URL.createObjectURL(new Blob(parts,{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  $('csvMessage').textContent=`${count}件のCSVを保存しました。`;
 }catch(e){await writable?.abort().catch(()=>{});$('csvMessage').textContent=e.name==='AbortError'?'出力を中止しました。':e.message;}
 finally{busy=false;parts=[];for(const c of controls)c.disabled=false;$('csvCancel').hidden=true;renderColumns();}
};
