export const languages={'ja':'日本語','en':'English','de':'Deutsch','fr':'Français','ko':'한국어','zh-Hans':'简体中文','zh-Hant':'繁體中文'};
export function normalize(value){
 if(typeof value!=='string')return null;
 const parts=value.trim().replaceAll('_','-').toLowerCase().split('-');
 if(parts[0]==='zh'){
  if(parts.includes('hans'))return 'zh-Hans';if(parts.includes('hant'))return 'zh-Hant';
  if(parts.slice(1).some(p=>['cn','sg'].includes(p)))return 'zh-Hans';
  if(parts.slice(1).some(p=>['tw','hk','mo'].includes(p)))return 'zh-Hant';return null;
 }
 return ['ja','en','de','fr','ko'].includes(parts[0])?parts[0]:null;
}
export function initialLanguage(requested,saved,plugin,seenRevision){
 return normalize(requested)||((plugin?.revision&&seenRevision&&seenRevision!==plugin.revision)?normalize(plugin.language):null)||normalize(saved)||normalize(plugin?.language)||'en';
}
