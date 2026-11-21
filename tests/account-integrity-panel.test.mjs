import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=source.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(match,'PAGE is available');
const page=JSON.parse(match[1]);
test('all inline scripts parse',()=>{
 const scripts=[...page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<[/]script>/g)];
 assert.ok(scripts.length>=4);
 for(const [,script] of scripts)assert.doesNotThrow(()=>new Script(script));
});
test('health check only reads account-scoped IndexedDB data',()=>{
 const section=page.slice(page.indexOf('async function docsIntegrityRead(){'),page.indexOf('function docsIntegrityText('));
 assert.match(section,/const owner=activeUser/);
 assert.match(section,/if\(owner!==activeUser\)/);
 assert.match(section,/docsMirrorGetAll\('responses'\)/);
 assert.match(section,/docsMirrorGetAll\('files'\)/);
 assert.match(section,/docsMirrorGetAll\('dailyBackups'\)/);
 assert.match(section,/dsStoreItems\('cloudSnapshots'\)/);
 assert.match(section,/all\(\)/);
 assert.doesNotMatch(section,/\.delete\(|\.clear\(|\.put\(|fetch\(/);
});
test('unknown index is never displayed as zero missing records',()=>{
 assert.match(page,/missingRecordCount:allA4===null\|\|allGuidance===null\?null:missingRecordPaths.length/);
 assert.match(page,/missingRecordCount\?\?'غير معروف'/);
 assert.match(page,/latest\?'/);
 assert.match(page,/لم يتم اختبار استعادتها/);
});
test('printable report contains aggregated statistics but not personal identifiers',()=>{
 assert.match(page,/id="docsIntegrityPanel"/);
 assert.match(page,/id="docsIntegrityScan"/);
 assert.match(page,/id="docsIntegrityPrint"/);
 assert.match(page,/reportsPrintText\(docsIntegrityText\(docsIntegrityLast\)/);
 const report=page.slice(page.indexOf('function docsIntegrityText('),page.indexOf('function docsIntegrityShow('));
 assert.match(report,/تاريخ الفحص \(هجري\)/);
 assert.match(report,/المرفقات المعروفة غير المحفوظة/);
 assert.match(report,/آخر نسخة يومية/);
 assert.doesNotMatch(report,/student_name|national_id|loginIdentifier/);
});
