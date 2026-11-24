import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const page=await readFile(new URL('../src/page.html',import.meta.url),'utf8');
test('status tiles are interactive and open underlying records',()=>{
 assert.match(page,/card=document.createElement\('button'\)/);
 assert.match(page,/card\.dataset\.workFilter=key/);
 assert.match(page,/open\.onclick=\(\)=>docsWorkOpen\(row\)/);
 assert.match(page,/id="docsWorkDetails"/);
});
test('counts and status lists share a classifier over original rows',()=>{
 assert.match(page,/counts\[docsWorkStatus\(row\)\]\+\+/);
 assert.match(page,/docsWorkSourceRows\.filter\(row=>docsWorkStatus\(row\)===docsWorkSelected\)/);
 assert.match(page,/docsRenderWorkCenter\(allOriginals\)/);
});
test('entries open existing edit or preview routes and reset on logout',()=>{
 assert.match(page,/edit\(doc\);return/);
 assert.match(page,/openMigratedA4\(sourceId\)/);
 assert.match(page,/openGuidanceRecord\(type,sourceId\)/);
 assert.match(page,/docsWorkSelected='';docsWorkSourceRows=\[\]/);
});
