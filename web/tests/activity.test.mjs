import test from 'node:test';import assert from 'node:assert/strict';import {updateActivity,withActivity,WEEK_MS} from '../activity.mjs';
test('activity tracks changes, never invents a past update, and hides after seven observed days',()=>{
 const row={owner:'a',container:0,slot:0,id:5,quantity:1,hq:false,collectable:false},day='2026-10-01T00:00:00.000Z',start=Date.parse(day);
 const first=updateActivity({entries:{}},[row],day);assert.equal(first.state.entries.a.lastChangedAt,null);
 assert.equal(updateActivity(first.state,[row],'2026-10-02T00:00:00.000Z').changed,false);
 const owner=[{id:'a',type:'キャラクター'}];assert.equal(withActivity(owner,first.state,start+WEEK_MS-1)[0].stale,false);assert.equal(withActivity(owner,first.state,start+WEEK_MS)[0].stale,true);
 const changed=updateActivity(first.state,[{...row,quantity:2}],'2026-10-07T00:00:00.000Z');assert.equal(changed.state.entries.a.lastChangedAt,'2026-10-07T00:00:00.000Z');assert.equal(withActivity(owner,changed.state,start+WEEK_MS)[0].stale,false);
 assert.equal(withActivity([{id:'unknown',type:'キャラクター'}],changed.state,start+100*WEEK_MS)[0].stale,false);
 const retainer=updateActivity(changed.state,[row,{...row,owner:'r'}],'2026-10-08T00:00:00.000Z');const owners=[...owner,{id:'r',type:'リテイナー',parentIds:['a']}];assert.equal(withActivity(owners,retainer.state,start+2*WEEK_MS-1)[0].stale,false);
});
