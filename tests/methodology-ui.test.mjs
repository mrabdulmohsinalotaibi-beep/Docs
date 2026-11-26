import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');
const page=JSON.parse(worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);

test('user-facing methodology card states scientific limits and source status',()=>{
 assert.match(page,/class="unified-note docs-methodology-card"/);
 assert.match(page,/المنهجية وحدود التفسير/);
 assert.match(page,/المقاييس الاستطلاعية هنا وصفية وغير مقننة/);
 assert.match(page,/تغير قبلي\/بعدي:<\/strong> مقارنة وصفية لا تثبت السببية/);
 assert.match(page,/غير متاح أو غير مفحوص:<\/strong> لا يعني صفرًا/);
});
