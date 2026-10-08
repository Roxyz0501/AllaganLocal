import {languages,normalize,initialLanguage} from './language-policy.js';
import {createTranslator} from './translation.js';
const requested=new URL(location.href).searchParams.get('lang');
let saved,seenRevision;try{saved=localStorage.getItem('allagan.language');seenRevision=localStorage.getItem('allagan.pluginLanguageRevision');}catch{}
async function pluginLanguage(){try{const response=await fetch('/api/ui-language');return response.ok?await response.json():{};}catch{return {};}}
const initial=await pluginLanguage();
let language=initialLanguage(requested,saved,initial,seenRevision);
if(initial.revision){seenRevision=initial.revision;try{localStorage.setItem('allagan.pluginLanguageRevision',seenRevision);}catch{}}
if(requested){const url=new URL(location.href);url.searchParams.delete('lang');history.replaceState(history.state,'',url);}
const english=await fetch('/locales/en.json').then(r=>r.ok?r.json():{}).catch(()=>({}));
let dictionary={},translate=source=>source,languageRequest=0;const originals=new WeakMap();
export const translateText=source=>translate(source);
const ignore='script,style,textarea,[translate="no"],.item-name:not(.qty),.storage-item-name,.owner-card-name>b,#lists,#detailName,#detailTitle,#addItemName,#slotName,#nameInput,.profile-heading h2,.owner-table-link b,.token-card span,.item-identity>span,#destination option,#addItemList option:not([value="new"]),#owner option:not([value=""]),#retainer option:not([value=""]),#currencyOwner option:not([value=""]),#salesCharacter option:not([value=""]),#salesRetainer option:not([value=""]),#itemHistoryCharacter option:not([value=""])';
function text(node){
 if(node.parentElement?.closest(ignore))return;
 const old=originals.get(node);const source=old&&node.nodeValue===old.output?old.source:node.nodeValue;
 const output=translate(source);originals.set(node,{source,output});if(node.nodeValue!==output)node.nodeValue=output;
}
function scan(root){
 if(root.nodeType===Node.TEXT_NODE){text(root);return;}
 if(root.nodeType!==Node.ELEMENT_NODE||root.matches(ignore))return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())text(walker.currentNode);
 for(const el of [root,...root.querySelectorAll('[title],[placeholder],[aria-label],optgroup[label]')]){
  if(el.closest(ignore))continue;
  for(const attr of ['title','placeholder','aria-label',...(el.tagName==='OPTGROUP'?['label']:[])])if(el.hasAttribute(attr)){
   const key='i18n-'+attr;const prev=el.getAttribute('data-'+key+'-out');const source=prev===el.getAttribute(attr)?el.getAttribute('data-'+key):el.getAttribute(attr);
   const output=translate(source,el.dataset.i18nName);el.setAttribute('data-'+key,source);el.setAttribute('data-'+key+'-out',output);if(el.getAttribute(attr)!==output)el.setAttribute(attr,output);
  }
 }
}
const observer=new MutationObserver(records=>{
 observer.disconnect();
 for(const r of records){if(r.type==='characterData')text(r.target);else if(r.type==='attributes')scan(r.target);else for(const node of r.addedNodes)scan(node);}
 observe();
});
function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','label','translate']});}
async function setLanguage(next){
 const request=++languageRequest;
 const response=await fetch('/locales/'+next+'.json');if(!response.ok)throw Error('Translation unavailable');
 const loaded=await response.json();if(request!==languageRequest)return;
 dictionary={...english,...loaded};language=next;try{localStorage.setItem('allagan.language',next);}catch{}
 document.cookie='allaganLanguage='+next+'; Path=/; SameSite=Strict';
 // Prefer complete phrases over shared terms. Data names are excluded from this presentation layer.
 translate=createTranslator(dictionary,next);
 observer.disconnect();document.documentElement.lang=next;scan(document.body);document.title='Allagan Local';observe();
 document.dispatchEvent(new CustomEvent('allagan-language-changed'));
}
await new Promise(resolve=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolve,{once:true});else resolve();});
const control=document.createElement('label');control.className='language-picker';control.translate=false;control.append('言語 / Language ');
const select=document.createElement('select');select.id='languageSelect';select.setAttribute('aria-label','言語');
for(const [code,label] of Object.entries(languages)){const option=new Option(label,code);option.translate=false;select.add(option);}select.value=language;
control.append(select);document.querySelector('.sidebar-bottom').prepend(control);
select.addEventListener('change',()=>setLanguage(select.value).catch(console.error));
await setLanguage(language);
setInterval(async()=>{
 const choice=await pluginLanguage();if(!choice.revision||choice.revision===seenRevision||!normalize(choice.language))return;
 seenRevision=choice.revision;try{localStorage.setItem('allagan.pluginLanguageRevision',seenRevision);}catch{}
 select.value=normalize(choice.language);await setLanguage(select.value).catch(console.error);
},2000);
