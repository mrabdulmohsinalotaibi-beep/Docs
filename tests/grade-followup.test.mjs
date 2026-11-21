import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(match,'embedded page exists');
const page=JSON.parse(match[1]);
const start=page.indexOf('/* DOCS_GRADE_MODULE_START */');
const end=page.indexOf('/* DOCS_GRADE_MODULE_END */');
assert.ok(start>0&&end>start);
const moduleSource=page.slice(start,end);
test('grade followup can be edited and retained locally',()=>{
 assert.match(moduleSource,/indexedDB\.open\('athat-docs-grades-v1-'\+currentUser,2\)/);
 assert.match(moduleSource,/objectStoreNames\.contains\('plans'\)/);
 assert.match(moduleSource,/function gradePlanStore\(method,arg\)/);
 assert.match(moduleSource,/gradePlanStore\('put',item\)/);
 assert.match(moduleSource,/gradeOpenPlan\(r\)/);
 assert.match(page,/id="student360GradePlans"/);
 assert.match(page,/gradeRenderPlansForStudent\(key\)/);
});
test('print and CSV protect names as selected',()=>{
 assert.match(moduleSource,/const mode=el\('gradeReportMode'\)\.value,privacy=el\('gradeReportNames'\)\.value/);
 assert.match(moduleSource,/privacy==='anonymous'\?\['الصف'/);
 assert.match(moduleSource,/privacy==='coded'\?\['رمز الطالب'/);
 assert.match(moduleSource,/privacy==='named'\)cells\.unshift\(r\.name,r\.id\)/);
 assert.match(moduleSource,/privacy!=='anonymous'\)cells\.unshift\(identity\(s\)\)/);
});
test('safe area and A4 print rules are present',()=>{
 assert.match(page,/env\(safe-area-inset-top\)/);
 assert.match(page,/#gradePrintOverlay \.grade-print-toolbar/);
 assert.match(page,/@page\{size:A4 portrait;margin:14mm\}/);
});
