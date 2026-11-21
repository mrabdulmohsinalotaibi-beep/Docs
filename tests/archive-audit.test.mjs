import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const page=JSON.parse(src.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);
test('new archive audit keeps all scripts valid',()=>{
 const scripts=[...page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<[/]script>/g)];
 for(const [,js] of scripts)assert.doesNotThrow(()=>new vm.Script(js));
});
test('audit is account-scoped, covers A4 and guidance records and does not remove anything',()=>{
 const text=page.slice(page.indexOf('function auditEntries(){'),page.indexOf('function auditRender(){'));
 assert.match(text,/nativeA4Rows\(\)/);
 assert.match(text,/guidanceLoadedUser===activeUser/);
 assert.match(text,/guidanceRecords/);
 assert.match(text,/source:'a4:'\+id/);
 assert.match(text,/const contentKeys=new Map\(\),metadataKeys=new Map\(\),out=\[\]/);
 assert.doesNotMatch(text,/\.delete\(|\.clear\(|indexedDB\.deleteDatabase/);
});
test('missing content means no actual body fields, photos or signature',()=>{
 const text=page.slice(page.indexOf('function auditEntries(){'),page.indexOf('function auditRender(){'));
 assert.match(text,/const hasAnyContent=!!\(content\|\|imageCount\|\|hasSignature\)/);
 assert.match(text,/category='empty'/);
 assert.match(text,/category='incomplete'/);
 assert.match(text,/category='possible'/);
});
test('audit exposes coverage uncertainty and downloadable report in Hijri',()=>{
 assert.match(page,/id="auditCoverage"/);
 assert.match(page,/id="auditRefreshSources"/);
 assert.match(page,/id="auditExportReport"/);
 assert.match(page,/تاريخ إعداد التقرير \(هجري\)/);
 assert.match(page,/لا يثبت اكتمال نسخ جميع بيانات الحساب/);
 assert.match(page,/auditRefreshSources'\)\.onclick=async/);
 assert.match(page,/auditExportCsv'\)\.onclick/);
});
