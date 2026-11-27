import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFile} from 'node:fs/promises';

test('native IndexedDB persists cases and isolates accounts and concurrent revisions',async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  const engine=await readFile(new URL('../src/fieldwork-case-engine.mjs',import.meta.url),'utf8');
  const attendance=await readFile(new URL('../src/fieldwork-attendance-import.mjs',import.meta.url),'utf8');
  const repository=await readFile(new URL('../src/fieldwork-case-repository.mjs',import.meta.url),'utf8');
  await page.route('https://fieldwork.test/**',route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({contentType:path.endsWith('.mjs')?'text/javascript':'text/html',body:path==='/fieldwork-attendance-import.mjs'?attendance:path==='/engine.mjs'?engine:path==='/repository.mjs'?repository.replace('./fieldwork-case-engine.mjs','./engine.mjs'):'<!doctype html><title>Native IndexedDB test</title>'})});
  await page.goto('https://fieldwork.test/');
  const result=await page.evaluate(async()=>{
   const {caseRepository}=await import('/repository.mjs');
   const open=()=>new Promise((resolve,reject)=>{const req=indexedDB.open('fieldwork-test',1);req.onupgradeneeded=()=>req.result.createObjectStore('cloudSnapshots',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   let database=await open();
   let session={accountId:'a',database,canApprove:false};
   const make=()=>caseRepository({database,session,currentSession:()=>session,studentIds:()=>new Set(['s1'])});
   let repo=make();
   await repo.create({id:'c1',studentId:'s1',reason:'test',priority:'high',date:'1448/06/01'});
   const results=await Promise.allSettled([repo.advance('c1',1,{status:'active',date:'1448/06/02'}),repo.advance('c1',1,{status:'active',date:'1448/06/02'})]);
   database.close();database=await open();session={...session,database};repo=make();
   const persisted=await repo.list();
   const close={status:'closed',date:'1448/06/03',result:'done',approval:'forged'};
   const denied=await repo.advance('c1',2,close).then(()=>false,()=>true);
   session={...session,canApprove:true};const closed=await repo.advance('c1',2,close);
   session={accountId:'b',database,canApprove:false};
   const stale=await repo.list().then(()=>false,()=>true);
   const foreign=await make().list();
   database.close();
   return {successes:results.filter(x=>x.status==='fulfilled').length,revision:persisted[0]?.revision,denied,approval:closed.history.at(-1).approval,stale,foreign:foreign.length};
  });
  assert.deepEqual(result,{successes:1,revision:2,denied:true,approval:'a',stale:true,foreign:0});
 } finally {await browser.close()}
});
