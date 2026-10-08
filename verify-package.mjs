import {readdir,mkdtemp,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const stages=(await readdir(path.join(root,'artifacts'))).filter(x=>/^package-\d{8}-\d{6}$/.test(x)).sort();
const stage=path.join(root,'artifacts',stages.at(-1));
const data=await mkdtemp(path.join(root,'artifacts','package-test-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=spawn(path.join(stage,'runtime','node.exe'),[path.join(stage,'web','server.mjs')],{cwd:path.join(stage,'web'),windowsHide:true,env:{...process.env,PORT:String(port),ALLAGAN_DATA_DIR:data,ALLAGAN_CATALOG_DIR:data,ALLAGAN_SOURCE:path.join(data,'missing.csv'),ALLAGAN_SALES_SOURCE:path.join(data,'missing-sales.csv')}});
let output='';child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>output+=s);
try{
 const base=`http://127.0.0.1:${port}`;let ready=false;
 for(let i=0;i<50;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 assert(ready,output);assert.equal((await (await fetch(base+'/api/health')).json()).app,'allagan-local');
 assert((await (await fetch(base+'/')).text()).includes('/i18n.js'));
 let keys;
 for(const code of ['ja','en','de','fr','ko','zh-Hans','zh-Hant']){const response=await fetch(base+'/locales/'+code+'.json');assert(response.ok);const dictionary=await response.json();const current=Object.keys(dictionary).sort();if(keys)assert.deepEqual(current,keys);keys=current;assert(Object.values(dictionary).every(s=>typeof s==='string'&&s.length));}
 const bootstrap=await (await fetch(base+'/api/bootstrap')).json();assert.equal(bootstrap.state.source,path.join(data,'missing.csv'));assert.equal(bootstrap.state.favorites.length,0);
 const manifest=JSON.parse(await readFile(path.join(stage,'AllaganLocalPlugin.json'),'utf8'));assert.equal(manifest.Author,'Roxyz0501');assert(manifest.RepoUrl&&manifest.IconUrl);
 assert(!(await readdir(path.join(stage,'web'))).includes('data'));
 console.log(`PASS: packaged server, seven dictionaries (${keys.length} terms), isolated fresh data, manifest URLs, no bundled user data`);
}finally{child.kill();}
