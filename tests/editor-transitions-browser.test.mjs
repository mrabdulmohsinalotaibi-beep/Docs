import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright-core';
import worker from '../worker.js';

const first='usr_aaaaaaaaaaaaaaaaaaaa',second='usr_bbbbbbbbbbbbbbbbbbbb';
async function fixture(run){
 let account=first,logouts=0;
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')){
   if(path==='/api/auth/logout'){logouts++;account=second}
   const user={id:account,name:'حساب تجريبي',loginIdentifier:'test@example.invalid'};
   const payload=path==='/api/auth/me'||path==='/api/auth/login'?{ok:true,user}
    :{ok:true,peers:[],messages:[],students:[],records:[],index:[],categories:[],insights:{},rows:[],hasMore:false};
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(payload));return;
  }
  const response=await worker.fetch(new Request('https://docs.athat.app'+path),{});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(id=>localStorage.setItem('athat-docs-local-write-consent-v1-'+id,'no'),first);
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
  await page.locator('#appMain').waitFor({state:'visible'});
  await page.locator('#newBtn').click();await page.locator('#templates button').first().click();
  await page.locator('#editor').waitFor({state:'visible'});
  await run(page,()=>logouts);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
const documents=(page,id)=>page.evaluate(async owner=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('athat-docs-unified-v2-'+owner);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 try{
  if(!db.objectStoreNames.contains('documents'))return [];
  return await new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 }finally{db.close()}
},id);

test('opening another template cannot replace an unsaved draft or a save still in progress',{timeout:55000},()=>fixture(async(page,logouts)=>{
 await page.locator('#docTitle').fill('مسودة يجب أن تبقى');
 await page.locator('#docsViewSelector [data-view="templates"]').click();
 await page.locator('#templates button').nth(1).click();
 assert.equal(await page.locator('#docTitle').inputValue(),'مسودة يجب أن تبقى','switch must preserve dirty inputs');
 assert.equal(await page.locator('#editor').isVisible(),true);
 await page.evaluate(()=>{
  const native=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,mode,...rest){
   const tx=native.call(this,names,mode,...rest);
   if(mode==='readwrite'&&names==='documents'){
    IDBDatabase.prototype.transaction=native;
    Object.defineProperty(tx,'oncomplete',{set(handler){tx.addEventListener('complete',()=>{window.finishSave=handler},{once:true})}});
   }
   return tx;
  };
 });
 await page.locator('#editor .a4-steps button').nth(4).click();await page.locator('#saveDoc').click();
 await page.waitForFunction(()=>typeof window.finishSave==='function');
 await page.locator('#docsViewSelector [data-view="templates"]').click();await page.locator('#templates button').nth(1).click();
 assert.equal(await page.locator('#docTitle').inputValue(),'مسودة يجب أن تبقى');
 await page.locator('#logoutDocs').click();
 assert.equal(logouts(),0,'logout must wait for the save acknowledgement');
 await page.evaluate(()=>window.finishSave());
 await page.waitForFunction(()=>document.getElementById('docsEditorSaveStatus').dataset.state==='saved');
 assert.deepEqual(await page.evaluate(()=>({timer:docsAutoSaveTimer,pending:docsAutoSavePending})),{timer:null,pending:false},'manual save consumes the queued autosave');
 assert.equal((await documents(page,first)).filter(row=>row.title==='مسودة يجب أن تبقى').length,1);
 await page.locator('#docsViewSelector [data-view="templates"]').click();await page.locator('#templates button').nth(1).click();
 assert.notEqual(await page.locator('#docTitle').inputValue(),'مسودة يجب أن تبقى','switch is allowed after saving');
}));

test('failed logout save preserves the account; retry saves before another account enters',{timeout:55000},()=>fixture(async(page,logouts)=>{
 await page.locator('#docTitle').fill('مسودة الحساب الأول');
 await page.evaluate(id=>{
  localStorage.setItem('athat-docs-local-write-consent-v1-'+id,'yes');
  window.originalPut=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){if(this.name==='documents')throw new DOMException('Synthetic quota failure','QuotaExceededError');return window.originalPut.apply(this,args)};
 },first);
 await page.locator('#logoutDocs').click();
 await page.waitForFunction(()=>document.getElementById('docsEditorSaveStatus').dataset.state==='error');
 assert.equal(logouts(),0);assert.equal(await page.locator('#appMain').isVisible(),true);
 assert.equal(await page.locator('#docTitle').inputValue(),'مسودة الحساب الأول');
 await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut});
 await page.locator('#logoutDocs').click();await page.locator('#authGate').waitFor({state:'visible'});
 assert.equal(logouts(),1);
 assert.equal((await documents(page,first)).filter(row=>row.title==='مسودة الحساب الأول').length,1);
 assert.equal(await page.locator('#docTitle').inputValue(),'','logout clears editor inputs');
 await page.locator('#emailInput').fill('test@example.invalid');await page.locator('#passwordInput').fill('synthetic-password');
 await page.locator('#submitAuth').click();await page.locator('#appMain').waitFor({state:'visible'});
 assert.equal(await page.locator('#editor').isVisible(),false);
 assert.deepEqual(await documents(page,second),[]);
 await page.waitForTimeout(1200);
 assert.deepEqual(await documents(page,second),[],'queued autosave must not migrate an old draft into the new account');
}));
