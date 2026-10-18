import {DatabaseSync} from 'node:sqlite';
import {statSync} from 'node:fs';
import {createHash} from 'node:crypto';

const columns='id,time,cid,character,home,world,item,name,hq,quantity,unit,tax,subtotal,total,listing,retainer,seller,city';
export function purchaseFilter(params,excluded=[]){
 const get=k=>String(params[k]||'').trim().slice(0,200);
 const date=k=>{const s=get(k);if(!s)return 0;if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw new Error('期間の日付が不正です。');return Date.parse(s+'T00:00:00+09:00')/1000;};
 const amount=k=>{const s=get(k);if(!s)return null;const n=Number(s);if(!/^\d+$/.test(s)||!Number.isSafeInteger(n))throw new Error('金額が不正です。');return n;};
 const from=date('from'),until=date('to'),min=amount('min'),max=amount('max');
 if(from&&until&&from>until)throw new Error('開始日は終了日以前にしてください。');
 if(max!=null&&min!=null&&min>max)throw new Error('金額の範囲が不正です。');
 const source=get('source')||'purchases',quality=get('quality')||'all',sort=get('sort')||'time',direction=get('direction')||'desc',bucket=get('bucket')||'day';
 if(!['purchases','all','0','1','2','3'].includes(source)||!['all','hq','nq'].includes(quality)||!['time','total','quantity','unit'].includes(sort)||!['asc','desc'].includes(direction)||!['day','month'].includes(bucket))throw new Error('フィルターが不正です。');
 return {character:get('character'),q:get('q'),world:get('world'),source,quality,sort,direction,bucket,from,until:until?until+86400:0,min,max,excluded:[...new Set(excluded.map(String))].sort()};
}
export const csvCell=value=>'"'+String(value??'').replace(/^(\s*[=+@-]|[\t\r\n])/,"'$1").replaceAll('"','""')+'"';

export class PurchaseStore{
 constructor(file){this.file=file;this.cache=new Map();this.summaries=new Map();this.metrics={reads:0,rows:0,writes:0};this.generation=0;}
 close(){this.db?.close();this.db=null;this.cache.clear();this.summaries.clear();}
 fresh(){
  let info;try{info=statSync(this.file);}catch{this.close();throw new Error('Gil Ledgerの購入履歴が見つかりません。プラグインを導入して購入を記録してください。');}
  const identity=info.dev+':'+info.ino+':'+info.birthtimeMs;
  if(!this.db||this.identity!==identity){this.close();this.db=new DatabaseSync(this.file,{readOnly:true,timeout:2000});this.identity=identity;this.db.exec('PRAGMA query_only=ON');const version=this.db.prepare('PRAGMA user_version').get().user_version;if(![1,2].includes(version)){this.close();throw new Error('購入履歴の保存形式に対応していません。');}this.schema=version;this.generation++;this.version=null;}
  const version=this.db.prepare('PRAGMA data_version').get().data_version;
  if(version!==this.version){this.version=version;this.generation++;this.cache.clear();this.summaries.clear();}
 }
 rows(sql,args=[]){this.metrics.reads++;const rows=this.db.prepare(sql).all(...args);this.metrics.rows+=rows.length;return rows;}
 where(f){
  const clauses=[],args=[],add=(sql,v)=>{clauses.push(sql);args.push(v);},source=this.schema===2?'source':'0';
  if(f.source==='purchases')clauses.push(source+' IN (0,1)');else if(f.source!=='all')add(source+'=?',Number(f.source));
  if(f.character)add('cid=?',f.character);if(f.world)add('world=? COLLATE NOCASE',f.world);
  if(f.quality!=='all'){clauses.push('item>0');add('hq=?',f.quality==='hq'?1:0);}
  if(f.from)add('time>=?',f.from);if(f.until)add('time<?',f.until);if(f.min!=null)add('total>=?',f.min);if(f.max!=null)add('total<=?',f.max);
  if(f.q){const term='%'+f.q.replace(/[\\%_]/g,'\\$&')+'%';clauses.push("(name LIKE ? ESCAPE '\\' OR seller LIKE ? ESCAPE '\\' OR CAST(item AS TEXT)=? OR retainer=?)");args.push(term,term,f.q,f.q);}
  if(f.excluded.length){clauses.push('cid NOT IN ('+f.excluded.map(()=>'?').join(',')+')');args.push(...f.excluded);}
  return {sql:clauses.length?' WHERE '+clauses.join(' AND '):'',args};
 }
 order(f){return `${f.sort} ${f.direction},time ${f.direction},id ${f.direction}`;}
 select(){return columns+(this.schema===2?',source,tax_known':',0 AS source,1 AS tax_known');}
 remember(map,key,value){const bytes=Buffer.byteLength(JSON.stringify(value));if(bytes>2*1024*1024)return;map.set(key,{value,expires:Date.now()+120000,bytes});while(map.size>12||[...map.values()].reduce((n,v)=>n+v.bytes,0)>8*1024*1024)map.delete(map.keys().next().value);}
 cached(map,key){const v=map.get(key);if(v&&v.expires>Date.now())return v.value;map.delete(key);}
 query(params,excluded=[],ifNoneMatch=''){
  this.fresh();const f=purchaseFilter(params,excluded),filterKey=JSON.stringify(f),page=Math.max(1,Math.min(1000000,Math.floor(Number(params.page))||1)),key=filterKey+':'+page;
  const etag='"'+createHash('sha256').update(this.identity+':'+this.generation+':'+key).digest('hex')+'"';
  if(etag===ifNoneMatch)return {etag,notModified:true};
  const saved=this.cached(this.cache,key);if(saved)return {etag,data:saved};
  const {sql,args}=this.where(f);let summary=this.cached(this.summaries,filterKey);
  this.db.exec('BEGIN');try{
   if(!summary){
    const unknown=this.schema===2?'CASE WHEN tax_known=0 THEN total ELSE 0 END':'0';
    const known=column=>this.schema===2?`CASE WHEN tax_known=1 THEN ${column} ELSE 0 END`:column;
    const sums=`COUNT(*) AS count,COALESCE(SUM(quantity),0) AS quantity,COALESCE(SUM(${known('subtotal')}),0) AS subtotal,COALESCE(SUM(${known('tax')}),0) AS tax,COALESCE(SUM(total),0) AS total,COALESCE(SUM(${unknown}),0) AS unknownTaxTotal`;
    const totals=this.rows('SELECT '+sums+' FROM purchases'+sql,args)[0];
    const bucket=f.bucket==='month'?"strftime('%Y-%m',time,'unixepoch','+9 hours')":"date(time,'unixepoch','+9 hours')";
    const chart=this.rows(`SELECT ${bucket} AS date,${sums} FROM purchases${sql} GROUP BY date ORDER BY date DESC LIMIT 367`,args).reverse(),truncated=chart.length>366;if(truncated)chart.shift();
    const groups=this.rows(`SELECT cid AS id,MAX(character) AS name,MAX(home) AS home,${sums} FROM purchases${sql} GROUP BY cid ORDER BY total DESC LIMIT 1001`,args),groupsTruncated=groups.length>1000;if(groupsTruncated)groups.pop();
    const excludedSql=f.excluded.length?' WHERE cid NOT IN ('+f.excluded.map(()=>'?').join(',')+')':'';
    const characters=this.rows('SELECT cid AS id,name,home FROM characters'+excludedSql+' ORDER BY name LIMIT 1000',f.excluded);
    const worlds=this.rows('SELECT DISTINCT world FROM purchases'+excludedSql+' ORDER BY world LIMIT 200',f.excluded).map(x=>x.world);
    summary={summary:totals,chart,chartTruncated:truncated,groups,groupsTruncated,characters,worlds};this.remember(this.summaries,filterKey,summary);
   }
   const pages=Math.max(1,Math.ceil(summary.summary.count/100)),actualPage=Math.min(page,pages);
   const items=this.rows('SELECT '+this.select()+' FROM purchases'+sql+' ORDER BY '+this.order(f)+' LIMIT 100 OFFSET ?', [...args,(actualPage-1)*100]);
   const data={...summary,revision:this.identity+':'+this.generation,items,page:actualPage,pages,source:'Gil Ledger',schema:this.schema};this.remember(this.cache,key,data);return {etag,data};
  }finally{this.db.exec('ROLLBACK');}
 }
 async export(params,excluded,emit){
  this.fresh();const f=purchaseFilter(params,excluded),{sql,args}=this.where(f);
  this.db.exec('BEGIN');try{
   await emit('\uFEFF'+['purchased_at_utc','purchased_at_jst','character_id','character','home_world','purchase_world','item_id','item_name','hq','quantity','unit_price','subtotal','tax','total','listing_id','retainer_id','seller_name','source','tax_known'].join(',')+'\r\n');
   const statement=this.db.prepare('SELECT '+this.select()+' FROM purchases'+sql+' ORDER BY '+this.order(f));let chunk='',count=0;
   for(const r of statement.iterate(...args)){
    const utc=new Date(r.time*1000).toISOString(),jst=new Date(r.time*1000+32400000).toISOString().slice(0,19)+'+09:00';
    chunk+=[utc,jst,r.cid,r.character,r.home,r.world,r.item||'',r.name,r.item?(r.hq?'HQ':'NQ'):'',r.quantity||'',r.quantity?r.unit:'',r.tax_known?r.subtotal:'',r.tax_known?r.tax:'',r.total,r.source===0?r.listing:'',r.retainer,r.seller,['Market','NpcShop','Unclassified','Transfer'][r.source],!!r.tax_known].map(csvCell).join(',')+'\r\n';
    if(++count%100===0){await emit(chunk);chunk='';}
   }if(chunk)await emit(chunk);
  }finally{this.db.exec('ROLLBACK');}
 }
}
