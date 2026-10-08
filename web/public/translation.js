const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Translation is presentational: never feed translated text into stored values.
export function createTranslator(dictionary,language){
 const keys=Object.keys(dictionary).sort((a,b)=>b.length-a.length);
 const templates=keys.filter(k=>/\{\d+\}/.test(k)).map(key=>{
  const slots=[];let last=0,expression='';
  for(const match of key.matchAll(/\{(\d+)\}/g)){expression+=escape(key.slice(last,match.index))+'([\\d,]+)';slots.push(match[1]);last=match.index+match[0].length;}
  return {regex:new RegExp(expression+escape(key.slice(last)),'g'),slots,value:dictionary[key]};
 });
 const plain=keys.filter(k=>!k.includes('{'));
 const pattern=plain.length?new RegExp(plain.map(k=>(k.length===1?'(?<=\\d\\s*)':'')+escape(k)).join('|'),'g'):null;
 return function translate(source,protectedName){
  if(language==='ja')return source;
  if(protectedName&&source.includes(protectedName))return source.split(protectedName).map(part=>translate(part)).join(protectedName);
  const exact=dictionary[source.trim()];if(exact)return source.replace(source.trim(),exact);
  // Save template outputs separately so term replacement cannot modify them.
  const saved=[];
  for(const {regex,slots,value} of templates)source=source.replace(regex,(...matches)=>{
   const vars=Object.fromEntries(slots.map((slot,i)=>[slot,matches[i+1]]));
   saved.push(value.replace(/\{(\d+)\}/g,(_,slot)=>vars[slot]));return '\uE000'+(saved.length-1)+'\uE001';
  });
  return (pattern?source.replace(pattern,key=>dictionary[key]):source).replace(/\uE000(\d+)\uE001/g,(_,i)=>saved[Number(i)]);
 };
}
