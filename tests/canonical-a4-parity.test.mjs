import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(match,'Worker must embed its HTML');
const page=JSON.parse(match[1]);
const script=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
 .map(x=>x[1]).find(s=>s.includes('function originalA4Dom('));
const snapshot=JSON.parse(readFileSync(new URL('../data/athat-a4-style-reference.json',import.meta.url),'utf8'));
const css=page.match(/<style id="athatOriginalA4CSS">([\s\S]*?)<\/style>/)?.[1]?.replace(/^\n/,'').replace(/\n$/,'');
const originalTableCSS=readFileSync(new URL('../data/athat-a4-table-reference.css',import.meta.url),'utf8').trim();
const tableCSS=page.match(/<style id="athatOriginalA4TableCSS">([\s\S]*?)<\/style>/)?.[1];

test('original ATHAT styles are embedded byte-for-byte',()=>{
 assert.equal(css,snapshot.documentTemplateCSS+'\n'+snapshot.officialDocumentStyle);
 assert.equal(snapshot.origin,'mrabdulmohsinalotaibi-beep/AAA');
 assert.ok(snapshot.files['src/DocumentTemplate.tsx']);
 assert.ok(snapshot.files['src/document-template-official-style.ts']);
});

test('table styling and custom field schema come directly from ATHAT',()=>{
 assert.equal(tableCSS,originalTableCSS);
 assert.match(script,/function originalA4SchemaForSource\(p\)/);
 assert.match(script,/ga4-custom-data-table/);
});

test('the canonical A4 renderer compiles and uses original document classes',()=>{
 assert.ok(script,'Canonical renderer exists');
 assert.doesNotThrow(()=>new vm.Script(script));
 for(const cls of ['doc-a4','doc-header','doc-org','doc-ministry-logo','doc-reference','doc-title','doc-fields','doc-field','doc-attachments','doc-signatures','doc-footer','doc-page-counter']){
  assert.ok(script.includes(cls),cls);
 }
 assert.match(page,/id="docsOriginalPreview"/);
 assert.match(script,/function printDocs\(rows\)\{return printOriginalA4Docs\(rows\)\}/);
 assert.doesNotMatch(script,/const signBlock=/);
});

test('all 41 original source template field schemas are retained',()=>{
 const m=script.match(/const ORIGINAL_A4_TEMPLATES=(\[[^\n]+\]);/);
 assert.ok(m,'Original templates are embedded as source data');
 const schemas=JSON.parse(m[1]);
 assert.equal(schemas.length,41);
 assert.equal(new Set(schemas.map(s=>s.id)).size,41);
 for(const s of schemas){assert.ok(s.label);assert.ok(Array.isArray(s.fields));}
 assert.ok(schemas.some(s=>s.id==='integrated:parent-message'));
 assert.ok(schemas.some(s=>s.id==='noor:attendance'));
});

test('existing local copies and original cloud source remain distinct',()=>{
 assert.match(script,/const oldDerived=docs\.find\(x=>x\.sourceA4===sourceId\)/);
 assert.match(script,/oldDerived\?'athat-original-a4:'\+sourceId/);
 assert.match(script,/a4FieldDefinitions:sourceDefinitions/);
 assert.match(script,/sourceA4:sourceId/);
 assert.match(script,/function originalA4SourceModel\(r,p\)/);
 assert.match(script,/paper\.replaceChildren\(originalA4Dom\(originalA4SourceModel\(r,p\)\)\)/);
 assert.match(script,/function renderOriginalA4Live\(/);
});
