import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const page=await readFile(new URL('../src/page.html',import.meta.url),'utf8');
const runtime=await readFile(new URL('../src/worker-runtime.js',import.meta.url),'utf8');
const build=await readFile(new URL('../worker.js',import.meta.url),'utf8');

test('deployable worker is rebuilt from source',()=>{
 assert.equal(build,'const PAGE='+JSON.stringify(page)+';\n'+runtime);
});
test('all inline scripts parse',()=>{
 const scripts=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>0);
 for(const [i,m] of scripts.entries())assert.doesNotThrow(()=>new Script(m[1],{filename:'page-inline-'+i+'.js'}));
});
test('OneDrive cannot claim successful backup from local save alone',()=>{
 assert.ok(page.includes('id="docsOneDriveIndicator"'));
 assert.ok(page.includes('docs:onedrive-status'));
 assert.ok(page.includes('لا توجد نسخة احتياطية مؤكدة'));
});
test('OAuth authorizes only personal app-folder with PKCE and validates account and state',()=>{
 assert.ok(page.includes("code_challenge_method:'S256'"));
 assert.ok(page.includes("response_type:'code'"));
 assert.ok(page.includes('state!==pending.state'));
 assert.ok(page.includes('pending.account!==activeUser'));
 assert.ok(page.includes("Files.ReadWrite.AppFolder offline_access"));
 assert.ok(!page.includes('localStorage.setItem("access_token"'));
 assert.ok(!page.includes('localStorage.setItem("refresh_token"'));
});
test('OneDrive config requires authenticated Docs account and exposes no secret',()=>{
 assert.ok(runtime.includes('if(path==="/api/onedrive/config")'));
 assert.ok(runtime.includes('const identity=await docsIdent(request,env)'));
 assert.ok(runtime.includes('DOCS_ONEDRIVE_CLIENT_ID'));
 assert.ok(!runtime.includes('DOCS_ONEDRIVE_CLIENT_SECRET'));
 assert.ok(runtime.includes("https://login.microsoftonline.com https://graph.microsoft.com"));
});
