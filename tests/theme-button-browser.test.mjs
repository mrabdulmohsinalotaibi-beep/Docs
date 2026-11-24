import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright-core';
import worker from '../worker.js';
test('compact theme button opens accessible choices and persists selection',{timeout:60000},async()=>{
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')){res.writeHead(401,{'content-type':'application/json'});res.end('{"ok":false}');return}
  const response=await worker.fetch(new Request('https://docs.athat.app'+path),{});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
  const button=page.locator('#docsThemeButton'),menu=page.locator('#docsThemeMenu');
  assert.equal(await page.locator('#docsThemeSelect').count(),0);
  assert.equal(await menu.isVisible(),false);
  await button.click();
  await menu.locator('[data-theme-choice="mono"]').click();
  assert.equal(await page.locator('body').getAttribute('data-docs-theme'),'mono');
  assert.equal(await menu.isVisible(),false);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.locator('body').getAttribute('data-docs-theme'),'mono');
  await button.click();
  await page.keyboard.press('Escape');
  assert.equal(await menu.isVisible(),false);
  assert.equal(await button.getAttribute('aria-expanded'),'false');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});
