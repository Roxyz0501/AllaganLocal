const languages={'ja':'日本語','en':'English','de':'Deutsch','fr':'Français','ko':'한국어','zh-Hans':'简体中文','zh-Hant':'繁體中文'};
const requested=new URL(location.href).searchParams.get('lang');
let saved;try{saved=localStorage.getItem('allagan.language');}catch{}
const browserLanguage=navigator.language.startsWith('zh')?(navigator.language.match(/TW|HK|Hant/i)?'zh-Hant':'zh-Hans'):navigator.language.split('-')[0];
let language=Object.hasOwn(languages,requested)?requested:Object.hasOwn(languages,saved)?saved:Object.hasOwn(languages,browserLanguage)?browserLanguage:'en';
let dictionary={},pattern,languageRequest=0;const originals=new WeakMap();
const ignore='script,style,textarea,[translate="no"],.item-name:not(.qty),.storage-item-name,.owner-card-name,#lists,#detailName,#slotName,#nameInput,.profile-heading h2,.owner-table-link b,.token-card span,.item-identity>span';
function translate(source){
 if(language==='ja'||!pattern)return source;
 const exact=dictionary[source.trim()];if(exact)return source.replace(source.trim(),exact);
 return source.replace(pattern,key=>dictionary[key]);
}
function text(node){
 if(node.parentElement?.closest(ignore))return;
 const old=originals.get(node);const source=old&&node.nodeValue===old.output?old.source:node.nodeValue;
 const output=translate(source);originals.set(node,{source,output});if(node.nodeValue!==output)node.nodeValue=output;
}
function scan(root){
 if(root.nodeType===Node.TEXT_NODE){text(root);return;}
 if(root.nodeType!==Node.ELEMENT_NODE||root.matches(ignore))return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())text(walker.currentNode);
 for(const el of [root,...root.querySelectorAll('[title],[placeholder],[aria-label]')]){
  if(el.closest(ignore))continue;
  for(const attr of ['title','placeholder','aria-label'])if(el.hasAttribute(attr)){
   const key='i18n-'+attr;const prev=el.getAttribute('data-'+key+'-out');const source=prev===el.getAttribute(attr)?el.getAttribute('data-'+key):el.getAttribute(attr);
   const output=translate(source);el.setAttribute('data-'+key,source);el.setAttribute('data-'+key+'-out',output);if(el.getAttribute(attr)!==output)el.setAttribute(attr,output);
  }
 }
}
const observer=new MutationObserver(records=>{
 observer.disconnect();
 for(const r of records){if(r.type==='characterData')text(r.target);else if(r.type==='attributes')scan(r.target);else for(const node of r.addedNodes)scan(node);}
 observe();
});
function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']});}
async function setLanguage(next){
 const request=++languageRequest;
 const response=await fetch('/locales/'+next+'.json');if(!response.ok)throw Error('Translation unavailable');
 const loaded=await response.json();if(request!==languageRequest)return;
 dictionary=loaded;language=next;try{localStorage.setItem('allagan.language',next);}catch{}
 // Prefer complete phrases over shared terms. Data names are excluded from this presentation layer.
 pattern=new RegExp(Object.keys(dictionary).sort((a,b)=>b.length-a.length).map(k=>(k.length===1?'(?<=\\d\\s*)':'')+k.replace(/[.*+?^${}()|[\]\\]/g,c=>'\\'+c)).join('|'),'g');
 observer.disconnect();document.documentElement.lang=next;scan(document.body);document.title='Allagan Local';observe();
}
await new Promise(resolve=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolve,{once:true});else resolve();});
const control=document.createElement('label');control.className='language-picker';control.append('言語 ');
const select=document.createElement('select');select.id='languageSelect';select.setAttribute('aria-label','言語');
for(const [code,label] of Object.entries(languages)){const option=new Option(label,code);option.translate=false;select.add(option);}select.value=language;
control.append(select);document.querySelector('.sidebar-bottom').prepend(control);
select.addEventListener('change',()=>setLanguage(select.value).catch(console.error));
await setLanguage(language);
