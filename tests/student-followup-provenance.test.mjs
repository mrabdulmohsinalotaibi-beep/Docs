import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../src/page.html',import.meta.url),'utf8');

test('student followup stores and displays measurement provenance',()=>{
 assert.match(page,/sourceFile:source\?\.filename\|\|'ملف نتائج محلي'/);
 assert.match(page,/sourceCount:Array\.isArray\(source\?\.records\)\?source\.records\.length:null/);
 assert.match(page,/مصدر القياس/);
 assert.match(page,/حجم مصدر القياس/);
 assert.match(page,/التغير مقارنة وصفية بين قياسين/);
 assert.match(page,/لا يثبت أن الإجراء سبب النتيجة/);
});
