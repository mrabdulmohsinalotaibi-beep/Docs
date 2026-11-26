import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright-core';
import worker from '../worker.js';

test('mobile workspace preserves routes, recent originals, account isolation and error visibility',{timeout:65000},async()=>{
 let account='usr_mobile_fixture_a';
 const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){
   if(req.url==='/api/auth/logout')account='usr_mobile_fixture_b';
   const payload=/^\/api\/auth\/(me|login)$/.test(req.url)?{ok:true,user:{id:account,name:'حساب تجريبي',loginIdentifier:'fixture@example.invalid'}}:{ok:true,peers:[],messages:[],students:[],records:[],index:[],categories:[],insights:{},rows:[],hasMore:false};
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify(payload));return;
  }
  const r=await worker.fetch(new Request('https://docs.athat.app'+req.url),{});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});await page.locator('#appMain').waitFor({state:'visible'});
  await page.evaluate(async()=>{
   const db=await new Promise((r,j)=>{const q=indexedDB.open('athat-docs-unified-v2-usr_mobile_fixture_a');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});
   await new Promise((r,j)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({id:'mobile-recent-original',title:'مسودة حديثة للحساب الأول',kind:'محضر اجتماع',body:'محتوى تجريبي',fields:{},photos:[],signers:[],status:'مسودة',created:'2026-11-25T09:00:00Z',updated:'2026-11-26T09:00:00Z'});tx.oncomplete=r;tx.onerror=()=>j(tx.error)});db.close();
  });
  await page.reload({waitUntil:'load'});
  const recent=page.locator('#docsMobileRecentList button');await recent.waitFor({state:'visible'});
  assert.match(await recent.innerText(),/مسودة حديثة للحساب الأول/);
  await recent.click();await page.locator('#editor.visible').waitFor();assert.equal(await page.locator('#docTitle').inputValue(),'مسودة حديثة للحساب الأول');await page.locator('#closeEditor').click();
  await page.locator('#workspaceNav [data-workspace="home"]').click();
  await page.locator('#docsMobileBackup>summary').click();assert.equal(await page.locator('#docsStorageBackup').isVisible(),true);
  await page.locator('#workspaceNav [data-workspace="documents"]').click();await page.locator('#docsMobileViews>summary').click();await page.locator('#docsViewSelector [data-view="programs"]').click();assert.equal(await page.locator('#docsProgramBundle').isVisible(),true);
  await page.locator('#docsViewSelector [data-view="works"]').click();await page.locator('#docsMobileArchiveFilter').selectOption('archive');assert.equal(await page.locator('[data-tab="archive"]').getAttribute('class'),'active');
  await page.setViewportSize({width:1280,height:900});assert.equal(await page.locator('#docsViewSelector [data-view="programs"]').isVisible(),true);assert.equal(await page.locator('[data-tab="archive"]').isVisible(),true);
  await page.setViewportSize({width:320,height:760});await page.locator('#workspaceNav [data-workspace="home"]').click();assert.equal(await page.locator('#docsMobileRecentList button').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('docs:local-status',{detail:{state:'red',message:'الحفظ التلقائي متوقف على هذا الجهاز'}})));assert.equal(await page.locator('#docsLocalIndicator').getAttribute('data-state'),'neutral');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('docs:local-status',{detail:{state:'red',message:'تعذر حفظ المستند'}})));assert.equal(await page.locator('#docsLocalIndicator').getAttribute('data-state'),'red');assert.equal(await page.locator('#docsMobileHealthWarning').isVisible(),true);assert.equal(await page.locator('#docsMobileHealthWarning').getAttribute('role'),'status');assert.equal(await page.locator('#docsMobileHealth').getAttribute('open'),null,'background error must not shift the controls during a tap');await page.locator('#docsMobileHealth>summary').click();assert.equal(await page.locator('#docsLocalIndicator').isVisible(),true);
  await page.locator('#logoutDocs').click();await page.locator('#authGate').waitFor({state:'visible'});assert.equal(await page.locator('#docsMobileRecentList button').count(),0);
  await page.locator('#emailInput').fill('fixture@example.invalid');await page.locator('#passwordInput').fill('FixturePassword123');await page.locator('#submitAuth').click();await page.locator('#appMain').waitFor({state:'visible'});assert.equal(await page.locator('#docsMobileRecentList button').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
