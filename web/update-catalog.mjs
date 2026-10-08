import {mkdir,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=process.env.ALLAGAN_CATALOG_DIR||process.env.ALLAGAN_DATA_DIR||path.join(path.dirname(fileURLToPath(import.meta.url)),'data');
async function sheet(name,fields,progress) {
  let after='',version='',rows=[];
  for(;;){
    const url=new URL(`https://v2.xivapi.com/api/sheet/${name}`);
    for(const [k,v] of Object.entries({limit:'500',language:'ja',fields,...(after?{after}:{}),...(version?{version}:{})}))url.searchParams.set(k,v);
    let data;
    for(let attempt=0;attempt<4;attempt++){
      try { const res=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw new Error(`XIVAPI: HTTP ${res.status}`);data=await res.json();break; }
      catch(e){if(attempt===3)throw e;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
    }
    version=data.version; if(!data.rows?.length)break;
    rows.push(...data.rows);const last=data.rows.at(-1);const next=`${last.row_id}${last.subrow_id===undefined?'':':'+last.subrow_id}`;
    if(next===after)throw new Error('APIページ送りが停止しました。');after=next;
    progress(`${name}: ${rows.length.toLocaleString()}件`);
  }
  return {rows,version};
}
export async function updateCatalog(progress=console.log){
  const [items,shops,worldRows]=await Promise.all([sheet('Item','Name,PriceMid,PriceLow,ItemUICategory.Name',progress),sheet('GilShopItem','Item@as(raw)',progress),sheet('World','Name',progress)]);
  if(items.version!==shops.version)throw new Error('APIのデータ版が変更されました。再実行してください。');
  const sold=new Set(shops.rows.map(r=>r.fields['Item@as(raw)']));
  const catalog={updatedAt:new Date().toISOString(),version:items.version,items:items.rows.filter(r=>r.row_id&&r.fields.Name).map(r=>({id:r.row_id,name:r.fields.Name,category:r.fields.ItemUICategory?.fields?.Name||'その他',sell:r.fields.PriceLow,buy:sold.has(r.row_id)?r.fields.PriceMid:null}))};
  await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'worlds.json.tmp'),JSON.stringify(Object.fromEntries(worldRows.rows.map(r=>[r.row_id,r.fields.Name]))));await rename(path.join(dir,'worlds.json.tmp'),path.join(dir,'worlds.json'));await writeFile(path.join(dir,'catalog.json.tmp'),JSON.stringify(catalog));await rename(path.join(dir,'catalog.json.tmp'),path.join(dir,'catalog.json'));progress(`完了: ${catalog.items.length}アイテム`);return catalog;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))updateCatalog().catch(e=>{console.error(e.message);process.exitCode=1;});
