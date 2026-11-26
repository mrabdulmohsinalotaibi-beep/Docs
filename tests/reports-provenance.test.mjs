import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');
const page=JSON.parse(worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);

test('reports expose provenance, coverage and sample context',()=>{
 assert.match(page,/id="reportsProvenance"/);
 assert.match(page,/function reportsRenderProvenance\(rows\)/);
 assert.match(page,/حجم العينة\/الفهرس/);
 assert.match(page,/البيانات غير المتاحة لا تُحتسب صفرًا/);
 assert.match(page,/حجم العينة بعد الفلاتر/);
 assert.match(page,/حالة مصدر الأعمال/);
 assert.match(page,/غير متاح/);
});
