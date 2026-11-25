import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
const start=page.indexOf('function classifyDocsWorkStatus('),end=page.indexOf('function docsRenderWorkCenter(',start);
assert.ok(start>=0&&end>start);
const count=vm.runInNewContext(page.slice(start,end)+';docsWorkCenterCounts');
test('work center separates verified source statuses and never invents deadlines',()=>{
 const rows=['مسودة','مطلوبة','جارٍ التنفيذ','مكتمل','مؤرشف','متأخر','',null,'غير معروف'].map(status=>({status,created:'2000-01-01'}));
 assert.deepEqual(JSON.parse(JSON.stringify(count(rows))),{required:2,active:1,done:1,approved:0,overdue:1,archived:1,unknown:3});
});
test('work center is driven by canonical originals, not copied records',()=>{
 assert.match(page,/const allOriginals=docsAccountOriginals\(\);\s*docsRenderWorkCenter\(allOriginals\)/);
 assert.match(page,/data-work-note/);
 assert.match(page,/التأخر غير مستنتج من تاريخ الإنشاء/);
});
test('workspace initialization keeps moved elements connected and avoids removed shortcut access',()=>{
 assert.match(page,/workspacePages\[id\]=section;docsMain\.append\(section\)/);
 const removed=page.indexOf('dsPrivacyCard.remove()');
 assert.ok(removed>0);
 assert.doesNotMatch(page.slice(removed),/dsGet\('ds(?:Account|Danger)'\)\.onclick/);
});
