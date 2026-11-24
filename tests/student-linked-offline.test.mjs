import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
const start=page.indexOf('async function docsOfflineFetch('),end=page.indexOf('async function loadMigratedA4(',start);
assert.ok(start>=0&&end>start);
function fixture(){
 const cache=new Map(),db={};
 const ctx={URL,location:{origin:'https://example.invalid'},activeUser:'account-a',db,console,fetch:async()=>{throw Error('offline')},dsStoreSnapshot:async row=>cache.set(row.id,row),docsCachedItem:async key=>cache.get(key)};
 const read=vm.runInNewContext(page.slice(start,end)+';docsOfflineFetch',ctx);
 return {ctx,cache,read};
}
test('student guidance and timeline snapshots do not replace the full account index or another student',async()=>{
 const {ctx,cache,read}=fixture();
 ctx.fetch=async()=>({ok:true,json:async()=>({ok:true,records:[{title:'one'}]})});
 await read('/api/guidance/records?student=one');
 await read('/api/students/360?key=one');
 await read('/api/guidance/records');
 ctx.fetch=async()=>{throw Error('offline')};
 assert.equal(cache.size,3);
 assert.equal((await read('/api/guidance/records?student=one')).offline,true);
 assert.equal((await read('/api/students/360?key=one')).records[0].title,'one');
 await assert.rejects(read('/api/guidance/records?student=two'),/لا توجد نسخة/);
});
test('late responses cannot be written into or read from a different account',async()=>{
 const {ctx,cache,read}=fixture();
 ctx.fetch=async()=>({ok:true,json:async()=>{ctx.activeUser='account-b';ctx.db={};return {ok:true,records:[{title:'private'}]}}});
 await assert.rejects(read('/api/guidance/records?student=one'),/تغير الحساب/);
 assert.equal(cache.size,0);
});
test('student profile uses owner-scoped offline readers for both lists',()=>{
 assert.match(page,/await docsOfflineFetch\('\/api\/guidance\/records\?student='/);
 assert.match(page,/await docsOfflineFetch\('\/api\/students\/360\?key='/);
});
