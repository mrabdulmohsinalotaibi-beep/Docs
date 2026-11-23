import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
const page=await readFile(new URL('../src/page.html',import.meta.url),'utf8');
const runtime=await readFile(new URL('../src/worker-runtime.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');
test('deployed worker matches source',()=>assert.equal(worker,'const PAGE='+JSON.stringify(page)+';\n'+runtime));
test('all inline page scripts parse',()=>{
 const inline=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(inline.length>0);
 for(const [i,m] of inline.entries())assert.doesNotThrow(()=>new Script(m[1],{filename:'page-inline-'+i+'.js'}));
});
test('administration and account settings are separate workspace pages',()=>{
 assert.ok(page.includes("'settings','admin'"));
 assert.ok(page.includes("workspacePages.admin.append(docsAdminPageHeader,adminPanel)"));
 assert.ok(page.includes("dsPanel('Account').append(originalProfile);"));
 assert.ok(!page.includes("dsPanel('Account').append(originalProfile,adminPanel)"));
 assert.ok(page.includes("settingsButton.textContent='⚙ إعدادات حسابي'"));
});
test('only verified owner can navigate into administration',()=>{
 assert.ok(page.includes("docsAdminAuthorized=owner"));
 assert.ok(page.includes("if(target==='admin'&&!docsAdminAuthorized)target='home'"));
 assert.ok(page.includes("if(!docsAdminAuthorized)return;"));
 assert.ok(page.includes("docsAdminAuthorized=false;"));
 assert.ok(page.includes("workspaceGoto('admin')"));
});
