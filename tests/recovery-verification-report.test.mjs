import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=source.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(match);
const page=JSON.parse(match[1]);

test('all inline scripts remain syntactically valid',()=>{
 const scripts=[...page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<[/]script>/g)];
 assert.ok(scripts.length>=4);
 for(const [,js] of scripts)assert.doesNotThrow(()=>new Script(js));
});
test('restore report only appears after a verified recovery',()=>{
 assert.match(page,/id="docsRestoreReportPanel"/);
 assert.match(page,/id="docsRestoreReportPrint" disabled/);
 assert.match(page,/before=await docsIntegrityRead\(\)/);
 assert.match(page,/const after=await docsIntegrityRead\(\)/);
 assert.match(page,/const remainingPlan=await docsRestorePreviewRead\(\)/);
 assert.match(page,/docsRestoreReportShow\(\{owner:activeUser/);
 assert.match(page,/docsRestoreReportClear\(\)/);
});
test('A4 print is account gated and reports only aggregated statistics',()=>{
 const a=page.indexOf('function docsRestoreReportText(result){');
 const b=page.indexOf('function docsRestoreReportShow(result){',a);
 assert.ok(a>=0&&b>a);
 const report=page.slice(a,b);
 assert.match(report,/السجلات المعروفة الناقصة/);
 assert.match(report,/المرفقات المعروفة الناقصة/);
 assert.match(report,/غير معروف/);
 assert.match(report,/تاريخ التقرير \(هجري\)/);
 assert.doesNotMatch(report,/student_name|national_id|student_key|\.body|\.photos/);
 assert.match(page,/docsRestoreReport\.owner!==activeUser/);
 assert.match(page,/reportsPrintText\(docsRestoreReportText\(docsRestoreReport\)/);
});
test('add-only recovery remains intact and reports remaining local candidates',()=>{
 assert.match(page,/store\.add\(row\)/);
 assert.match(page,/fresh\.backupId!==plan\.backupId/);
 assert.match(page,/remainingPlan\.doc\.additions\.length\+remainingPlan\.snap\.additions\.length/);
});
