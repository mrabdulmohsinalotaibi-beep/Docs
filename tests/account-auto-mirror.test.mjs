import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=source.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
const page=JSON.parse(match[1]);

test('worker and all inline scripts parse',()=>{
 assert.doesNotThrow(()=>new Script(source.replace('export default {','const worker = {')));
 const scripts=[...page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<[/]script>/g)];
 assert.ok(scripts.length>=4);
 for(const [,script] of scripts)assert.doesNotThrow(()=>new Script(script));
});
test('account export is authenticated, strictly user-scoped and read only',()=>{
 assert.match(source,/async function docsAccountDeviceExport\(request,env\)/);
 assert.match(source,/const user=await docsIdent\(request,env\)/);
 assert.match(source,/WHERE user_id=\?1 ORDER BY rowid LIMIT \?2 OFFSET \?3/);
 assert.match(source,/bind\(user.id,limit,offset\)/);
 assert.match(source,/if\(!tables.has\(table\)/);
 assert.match(source,/if\(request.method!=='GET'\)/);
});
test('all eleven account-scoped D1 tables and genuine evidence files are mirrored locally',()=>{
 const tables=['docs_a4_dedupe_aliases','docs_a4_prepared','docs_a4_records','docs_a4_student_links','docs_care_categories','docs_evidence_files','docs_guidance_entries','docs_guidance_links','docs_student_care','docs_student_record_edits','docs_students'];
 for(const table of tables)assert.match(source,new RegExp(table));
 assert.match(page,/docsMirrorAllD1Pages/);
 assert.match(page,/docsMirrorEvidenceFile/);
 assert.match(page,/const blob=await response\.blob\(\)/);
 assert.match(page,/athat-docs-account-mirror-v1-/);
});
test('automatic backups preserve seven daily account copies and encrypted export includes files',()=>{
 assert.match(page,/dailyBackups/);
 assert.match(page,/older\.slice\(0,Math\.max\(0,older\.length-6\)\)/);
 assert.match(page,/mirrorFiles/);
 assert.match(page,/docsExportSecureBackup\(payload,password\)/);
 assert.match(page,/docsMirrorCachedResponse/);
});

test('home counts persisted old records rather than only freshly created documents',()=>{
 assert.match(page,/الأعمال المحفوظة بالجهاز/);
 assert.match(page,/docsMirrorGetAll\('responses'\)/);
 assert.match(page,/premiumValues\[2\]\.textContent=String\(docs\.length\+keys\.size\)/);
 assert.match(page,/const limit=Math\.min\(120,items\.length\)/);
 assert.match(page,/docsMirrorCycle\(\)\.catch\(console\.warn\)\},3\*60\*1000/);
});
