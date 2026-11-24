import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright-core';
import worker from '../worker.js';
const uid='usr_aaaaaaaaaaaaaaaaaaaa';
const record={source_table:'attendance',source_record_id:'synthetic-1',title:'متابعة تجريبية للمواظبة',student_key:'student-test',student_name:'طالب تجريبي',date_hijri:'1448/05/01',status:'مطلوب'};
test('followup browser workflow persists draft, requires outcome, approves and renders saved A4',{timeout:90000},async()=>{
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')){
   const data=path==='/api/auth/me'?{ok:true,user:{id:uid,name:'حساب تجريبي',loginIdentifier:'test@example.invalid'}}:path==='/api/guidance/records'?{ok:true,records:[record]}:path==='/api/device-sync'?{ok:true,peers:[],messages:[]}:{ok:true,students:[],records:[],index:[],categories:[],insights:{},rows:[],hasMore:false};
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));return;
  }
  const response=await worker.fetch(new Request('https://docs.athat.app'+path),{});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(id=>localStorage.setItem('athat-docs-local-write-consent-v1-'+id,'yes'),uid);
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
  const root=page.locator('#docsFollowupCenter');
  await root.locator('option[value="followup:attendance:synthetic-1"]').waitFor({state:'attached'});
  await root.locator('select').selectOption('followup:attendance:synthetic-1');
  await root.getByRole('button',{name:'فتح خطة متابعة السجل'}).click();
  const dialog=page.locator('#docsFollowupDialog'),field=k=>dialog.locator('[data-followup-field="'+k+'"]');
  await field('action').fill('لقاء ومتابعة');
  await field('goal').fill('خفض الغياب');
  await field('due').fill('1448/06/15');
  await field('metric').fill('عدد الأيام');
  await field('before').fill('5');
  await dialog.locator('[data-save]').click();
  await dialog.locator('[data-state]').filter({hasText:'متابعة محفوظة محليًا'}).waitFor();
  await dialog.locator('[data-close]').click();
  await page.reload({waitUntil:'load'});
  await root.getByRole('button',{name:/متابعة تجريبية للمواظبة ·/}).click();
  await field('action').waitFor();
  assert.equal(await field('action').inputValue(),'لقاء ومتابعة');
  assert.equal(await dialog.locator('[data-print]').isDisabled(),true);
  await dialog.locator('[data-approve]').click();
  await dialog.locator('[data-state]').filter({hasText:'لا يعتمد العمل'}).waitFor();
  await field('after').fill('2');
  await field('result').fill('انخفاض الغياب');
  await dialog.locator('[data-approve]').click();
  await dialog.locator('[data-state]').filter({hasText:'متابعة معتمدة محفوظة محليًا'}).waitFor();
  assert.equal(await field('action').isDisabled(),true);
  const popupPromise=page.waitForEvent('popup');
  await dialog.locator('[data-print]').click();
  const popup=await popupPromise;
  await popup.locator('.doc-a4').waitFor();
  const printed=await popup.locator('.doc-a4').innerText();
  assert.match(printed,/تقرير متابعة تربوية/);
  assert.match(printed,/انخفاض الغياب/);
  assert.match(printed,/خفض الغياب/);
  assert.match(printed,/-3/);
  await popup.close();
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});
