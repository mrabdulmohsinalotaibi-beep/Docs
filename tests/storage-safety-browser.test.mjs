// Synthetic accounts only: no live credentials, student records, or external APIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import worker from '../worker.js';

const firstId='usr_aaaaaaaaaaaaaaaaaaaa',secondId='usr_bbbbbbbbbbbbbbbbbbbb';

test('failed close preserves edits; successful save persists; backup history is account scoped',{timeout:70000},async()=>{
 let accountId=firstId;
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')){
   const payload=path==='/api/auth/me'
    ?{ok:true,user:{id:accountId,name:'حساب تجريبي',loginIdentifier:'test@example.invalid'}}
    :path==='/api/auth/verify-deletion'?{ok:true}
    :path==='/api/device-sync'?{ok:true,peers:[],messages:[]}
    :{ok:true,students:[],records:[],index:[],categories:[],insights:{},rows:[],hasMore:false};
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify(payload));return;
  }
  const response=await worker.fetch(new Request('https://docs.athat.app'+path),{});
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept(dialog.type()==='prompt'?'synthetic-password-123':undefined));
  await page.addInitScript(id=>localStorage.setItem('athat-docs-local-write-consent-v1-'+id,'no'),firstId);
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
  await page.locator('#appMain').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  assert.equal(await page.locator('#docsStartupNotice').isVisible(),false,await page.locator('#docsStartupNotice').textContent());
  await page.locator('#docsStorageSummary').waitFor({state:'visible'});
  assert.match(await page.locator('#docsBackupExportStatus').innerText(),/لا يوجد ملف نسخة/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'summary must fit a mobile viewport');
  await page.locator('#newBtn').click();
  await page.locator('#templates button').first().click();
  await page.locator('#editor').waitFor({state:'visible'});
  assert.equal(await page.locator('#docsStorageSummary').isVisible(),false,'home summary belongs only to home');
  await page.locator('#docTitle').fill('مسودة اختبار فشل الحفظ');
  assert.equal(await page.locator('#docsEditorSaveStatus').getAttribute('data-state'),'pending');
  await page.evaluate(id=>{
   localStorage.setItem('athat-docs-local-write-consent-v1-'+id,'yes');
   window.originalTestPut=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(...args){
    if(this.name==='documents')throw new DOMException('Synthetic quota failure','QuotaExceededError');
    return window.originalTestPut.apply(this,args);
   };
  },firstId);
  await page.locator('#closeEditor').click();
  await page.waitForFunction(()=>document.getElementById('docsEditorSaveStatus').dataset.state==='error');
  assert.equal(await page.locator('#editor').isVisible(),true,'failed save must not close the editor');
  assert.equal(await page.locator('#docTitle').inputValue(),'مسودة اختبار فشل الحفظ');
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalTestPut});
  await page.locator('#closeEditor').click();
  await page.locator('#editor').waitFor({state:'hidden'});
  const saved=await page.evaluate(async id=>{
   const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('athat-docs-unified-v2-'+id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   try{return await new Promise((resolve,reject)=>{const req=db.transaction('documents').objectStore('documents').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}finally{db.close()}
  },firstId);
  assert.equal(saved.filter(row=>row.title==='مسودة اختبار فشل الحفظ').length,1);
  assert.equal(await page.locator('#docsEditorSaveStatus').getAttribute('data-state'),'saved');
  await page.locator('#workspaceNav [data-workspace="home"]').click();
  const downloadReady=page.waitForEvent('download');
  await page.locator('#docsStorageBackup').click();
  const download=await downloadReady;
  const encrypted=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(encrypted.format,'ATHAT-DOCS-ENCRYPTED-BACKUP');
  assert.equal(JSON.stringify(encrypted).includes('مسودة اختبار فشل الحفظ'),false);
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode('synthetic-password-123'),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:Buffer.from(encrypted.salt,'base64'),iterations:encrypted.iterations,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
  const payload=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(encrypted.iv,'base64')},key,Buffer.from(encrypted.ciphertext,'base64'))));
  assert.equal(payload.accountId,firstId);
  assert.equal(payload.documents.some(row=>row.title==='مسودة اختبار فشل الحفظ'),true,'downloaded backup must retain the saved draft');
  await page.waitForFunction(id=>Boolean(localStorage.getItem('docs-backup-download-v1-'+id)),firstId);
  assert.equal(await page.locator('[data-ds-tab="storage"]').getAttribute('aria-selected'),'true');
  await page.locator('#workspaceNav [data-workspace="home"]').click();
  assert.match(await page.locator('#docsBackupExportStatus').innerText(),/آخر ملف نسخة أُنشئ هنا/);
  await page.screenshot({path:'/tmp/docs-storage-home-mobile.png',fullPage:true});
  accountId=secondId;
  await page.reload({waitUntil:'load'});
  await page.locator('#docsStorageSummary').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('docsBackupExportStatus').textContent.includes('لا يوجد ملف نسخة'));
  assert.deepEqual(errors,[]);
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
