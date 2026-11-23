import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const page=await readFile(new URL('../src/page.html',import.meta.url),'utf8');
const runtime=await readFile(new URL('../src/worker-runtime.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');

test('worker build matches source',()=>{
  assert.equal(worker,'const PAGE='+JSON.stringify(page)+';\n'+runtime);
});
test('all inline page scripts parse',()=>{
  const inline=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(inline.length>0);
  for(const [i,s] of inline.entries())assert.doesNotThrow(()=>new Script(s[1],{filename:'inline-'+i+'.js'}));
});
test('encrypted backup remains manual and locally created',()=>{
  assert.ok(page.includes("dsGet('dsBackup').onclick=async()=>"));
  assert.ok(page.includes("await docsExportSecureBackup(payload,password)"));
  assert.ok(page.includes('docsBackupWriteFolder(chosen,file)'));
  assert.ok(page.includes('docsBackupDownload(file)'));
  assert.ok(!page.includes('docsMsAuthorize'));
});
test('selected folder handle is account-scoped and its permissions can be revoked',()=>{
  assert.ok(page.includes("athat-docs-backup-folder-v1-"));
  assert.ok(page.includes("window.showDirectoryPicker"));
  assert.ok(page.includes("requestPermission?.({mode:'readwrite'})"));
  assert.ok(page.includes("actual.size!==file.size"));
  assert.ok(page.includes("crypto.subtle.digest('SHA-256',await actual.arrayBuffer())"));
});
test('Google Drive sharing uses the native share sheet, never uploads without selection',()=>{
  assert.ok(page.includes('navigator.share({files:[file]'));
  assert.ok(page.includes('navigator.canShare({files:[file]})'));
  assert.ok(page.includes('تأكد بنفسك من اكتمال رفعه في Google Drive'));
  assert.ok(!page.includes('https://www.googleapis.com/upload/drive'));
});
