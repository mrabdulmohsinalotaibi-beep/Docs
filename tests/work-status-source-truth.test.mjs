import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const page=await readFile(new URL('../src/page.html',import.meta.url),'utf8');
const start=page.indexOf('function docsWorkCenterCounts(');
const end=page.indexOf('function docsWorkTitle(',start);
const classify=vm.runInNewContext(page.slice(start,end)+';docsWorkCenterCounts');
test('maps only explicit original status labels and Arabic spelling variants',()=>{
 const states=['مسودة','جاري التنفيذ','قيد الإنجاز','مكتمل','مكتملة','تم الإنجاز','منجز','متأخرة','مؤرشف','بانتظار التنفيذ'];
 const count=classify(states.map(status=>({status})));
 assert.deepEqual(JSON.parse(JSON.stringify(count)),{required:2,active:2,done:4,overdue:1,archived:1,unknown:0});
});
test('unconfirmed approval or lack of source status stays unclassified',()=>{
 const count=classify([{status:'معتمد'},{status:''},{status:'تمت المراجعة'},{fields:{status:'مكتمل'}},{status:null,signature:'yes'}]);
 assert.equal(count.unknown,5);
});
test('local status fills missing A4 index status without overwriting explicit source',()=>{
 assert.match(page,/!String\(original\.status\?\?''\)\.trim\(\)&&String\(doc\.status\?\?''\)\.trim\(\)/);
 assert.match(page,/workStatusOrigin:'linked-local-status'/);
 assert.match(page,/الحالة الأصلية:/);
 assert.match(page,/لا تُستنتج حالة الاكتمال من النصوص أو الشواهد/);
});
