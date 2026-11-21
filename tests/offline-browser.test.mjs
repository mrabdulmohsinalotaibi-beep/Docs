// Synthetic account and records only. No live student data or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright-core';
import worker from '../worker.js';

const id='usr_aaaaaaaaaaaaaaaaaaaa';
const email='offline@example.invalid';
const password='test-offline-password-123';
const user={id,name:'حساب تجريبي',loginIdentifier:email};

test('cached app reopens account-specific local documents with no network',{timeout:95000},async()=>{
 const requests=[];
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;requests.push(path);
  if(path==='/api/auth/me'){
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,user}));return;
  }
  if(path==='/api/auth/verify-device-password'){
   let raw='';for await(const chunk of req)raw+=chunk;
   const data=JSON.parse(raw),ok=data.password===password&&data.email===email;
   res.writeHead(ok?200:403,{'content-type':'application/json'});
   res.end(JSON.stringify({ok,verified:ok,...(ok?{}:{code:'INVALID_PASSWORD'})}));return;
  }
  const response=await worker.fetch(new Request('https://docs.athat.app'+path),{});
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({serviceWorkers:'allow'}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:25000});
  await page.locator('#appMain').waitFor({state:'visible',timeout:15000});
  await page.locator('#workspaceSettingsLink').click();
  await page.locator('[data-ds-tab="account"]').click();
  await page.locator('#docsOfflineAccessCard').waitFor({state:'visible',timeout:10000});
  await page.locator('#docsOfflineEmail').fill(email);
  await page.locator('#docsOfflinePassword').fill(password);
  await page.locator('#docsOfflineEnable').click();
  await page.waitForFunction(()=>Boolean(localStorage.getItem('athat-docs-offline-unlock-v2')),null,{timeout:20000});
  await page.waitForFunction(async()=>{
   const r=await navigator.serviceWorker.getRegistration('/');
   return Boolean(r?.active&&(await caches.match('/'))&&(await caches.match('/peer-sync.js'))&&(await caches.match('/auto-sync.js')));
  },null,{timeout:25000});
  await page.evaluate(async id=>{
   const db=await new Promise((ok,no)=>{const r=indexedDB.open('athat-docs-unified-v2-'+id);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
   await new Promise((ok,no)=>{const t=db.transaction('documents','readwrite');t.objectStore('documents').put({id:'offline-test-document',title:'سجل تجريبي محفوظ',kind:'التقارير الإرشادية',group:'السجلات',fields:{'العنوان':'اختبار دون إنترنت'},body:'بيانات تجريبية',photos:[],status:'مسودة',created:new Date().toISOString(),updated:new Date().toISOString()});t.oncomplete=ok;t.onerror=()=>no(t.error)});
   db.close();
  },id);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:25000});
  await page.locator('#authGate').waitFor({state:'visible',timeout:16000});
  await page.locator('#docsOfflineOpenBtn').waitFor({state:'visible',timeout:16000});
  await page.locator('#passwordInput').fill('incorrect-password');
  await page.locator('#docsOfflineOpenBtn').click();
  assert.equal(await page.locator('#authGate').isVisible(),true,'wrong password must not open cached account');
  await page.locator('#passwordInput').fill(password);
  await page.locator('#docsOfflineOpenBtn').click();
  await page.locator('#appMain').waitFor({state:'visible',timeout:25000});
  const saved=await page.evaluate(async id=>{
   const db=await new Promise((ok,no)=>{const r=indexedDB.open('athat-docs-unified-v2-'+id);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
   const row=await new Promise((ok,no)=>{const req=db.transaction('documents','readonly').objectStore('documents').get('offline-test-document');req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
   db.close();return row;
  },id);
  assert.equal(saved?.title,'سجل تجريبي محفوظ');
  assert.ok(requests.includes('/api/auth/verify-device-password'));
  assert.deepEqual(errors,[]);
 }finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
 }
});
