import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const pageMatch=source.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
const page=JSON.parse(pageMatch[1]);
test('all inline scripts remain parseable',()=>{
 const scripts=[...page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<[/]script>/g)];
 assert.ok(scripts.length>=4);
 for(const [,script] of scripts)assert.doesNotThrow(()=>new vm.Script(script));
});
test('deleting locally requires server-side verified password and final confirmation',()=>{
 assert.match(source,/async function docsVerifyDestructivePassword/);
 assert.match(source,/const user=await docsIdent\(request,env\)/);
 assert.match(source,/account\.id===user\.id/);
 assert.match(source,/if\(!valid\)/);
 assert.match(page,/docsRequireDestructiveConfirmation\('مسح كل مستندات/);
 assert.match(page,/docsRequireDestructiveConfirmation\('حذف المستند/);
 assert.match(page,/docsRequireDestructiveConfirmation\('حذف رسالة/);
});
test('full local backup covers documents, cloud snapshots, messages and plans without overwriting on restore',()=>{
 assert.match(page,/docsBackupExtra\('athat-docs-message-center-v1-'/);
 assert.match(page,/docsBackupExtra\('athat-docs-planfiles-v1-'/);
 assert.match(page,/localSettings:docsBackupSettings\(\)/);
 assert.match(page,/backup\.version>=2/);
 assert.match(page,/if\(q\.result\)skipped\+\+/);
});

test('portable full backups use authenticated encryption rather than plaintext JSON',()=>{
 assert.match(page,/AES-GCM/);
 assert.match(page,/PBKDF2/);
 assert.match(page,/docsExportSecureBackup\(payload,password\)/);
 assert.match(page,/docsOpenSecureBackup\(backup,password\)/);
});
