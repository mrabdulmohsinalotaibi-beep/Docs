import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const page=JSON.parse(source.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);
test('all inline scripts parse after unifying account original records',()=>{
 const scripts=[...page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<[/]script>/g)];
 for(const [,script] of scripts)assert.doesNotThrow(()=>new vm.Script(script));
});
test('one canonical account view drives main work counter and filtered reports',()=>{
 assert.match(page,/function docsAccountOriginals\(\)/);
 assert.match(page,/const allOriginals=docsAccountOriginals\(\)/);
 assert.match(page,/const all=docsAccountOriginals\(\)\.map/);
 assert.match(page,/const key='guidance:'\+type\+':'\+id/);
 assert.match(page,/originals\.set\('a4:'\+id/);
 assert.match(page,/const id=docsCanonicalKey\(doc\),key='local:'\+id/);
});
test('archived copies count once without destructive deduplication',()=>{
 assert.match(page,/new Set\(docs\.filter\(d=>d\.status==='مؤرشف'\)\.map\(d=>docsCanonicalKey\(d\)\)\)\.size/);
 assert.match(page,/const originals=new Map\(\)/);
 assert.doesNotMatch(page,/docs\.filter\(d=>d\.status==='مؤرشف'\)\.length/);
});
test('reports load from owner-scoped local mirror if internet is down',()=>{
 assert.match(page,/const results=await Promise\.allSettled\(paths\.map\(path=>docsMirrorAccountRead\(path\)\)\)/);
 assert.match(page,/if\(result\.status!=='fulfilled'\|\|!result\.value\?\.ok\)/);
 assert.match(page,/async function docsMirrorCachedResponse\(path\)/);
});

test('unverified account indices are not mislabeled as incomplete records',()=>{
 assert.match(page,/\['لم توسم مكتملًا \(لم يُفحص المحتوى\)',/);
 assert.match(page,/الاكتمال غير معروف: أصل A4 مفهرس/);
 assert.match(page,/الاكتمال غير معروف: فهرس سجل الحساب/);
 assert.match(page,/عدم وجود وسم مكتمل لا يعني نقص السجل/);
 assert.doesNotMatch(page,/\['تحتاج مراجعة',reportsSourcesReady&&guidanceLoadedUser===activeUser\?unverified/);
});

test('bulk inspection remains read-only and distinguishes unavailable record content',()=>{
 assert.match(page,/id="auditScanContent"/);
 assert.match(page,/function docsContentClassify\(record,kind\)/);
 assert.match(page,/classification:'unavailable'/);
 assert.match(page,/await Promise\.all\(Array\.from\(\{length:Math\.min\(3,total\)\}/);
 assert.match(page,/token!==docsContentScanToken/);
 assert.match(page,/لا يُعتبر ناقصًا تلقائيًا/);
 assert.match(page,/لم تُغيّر أي سجلات/);
});
