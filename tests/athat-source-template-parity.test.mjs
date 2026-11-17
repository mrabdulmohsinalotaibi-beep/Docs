import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const raw=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const encoded=raw.match(/^const PAGE=("(?:\.|[^"\])*");/);
assert.ok(encoded,'embedded app page');
const page=JSON.parse(encoded[1]);
const script=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const A4_REF='));
assert.ok(script,'A4 application script');
const parseLiteral=key=>JSON.parse(script.match(new RegExp('const '+key+'=([^\n]+);'))[1]);
const source=parseLiteral('IMPORTED_SOURCE_A4_FIELDS');
const ref=parseLiteral('A4_REF');
const start=script.indexOf('const catalog=[');
const stop=script.indexOf('const groups=Object.keys(A4_REF.groups);',start);
assert.ok(start>=0&&stop>start);

test('all source blank templates retain exact label, field sequence and kind',()=>{
 const context=vm.createContext({A4_REF:ref,IMPORTED_SOURCE_A4_FIELDS:source});
 const catalog=vm.runInContext(script.slice(start,stop)+';catalog',context);
 const native=catalog.filter(x=>x.originalA4);
 assert.equal(native.length,source.length);
 for(const spec of source){
  const form=native.find(x=>x.sourceTemplateId===spec.id);
  assert.ok(form,spec.id);
  assert.equal(form.title,spec.label);
  assert.deepEqual(Array.from(form.fields,field=>field.split('|')[0]),spec.fields.map(field=>field.label),spec.id);
  assert.deepEqual(Array.from(form.officialDefinitions,field=>field.kind),spec.fields.map(field=>field.kind||'text'),spec.id);
 }
 const titles=catalog.map(x=>x.title);
 assert.equal(new Set(titles).size,titles.length,'no duplicate blank template titles');
});

test('blank A4 previews retain empty fields and existing saved files retain additional fields',()=>{
 assert.match(script,/showEmptyFields:true/);
 assert.match(script,/data\.showEmptyFields\|\|visible\(f\.value\)/);
 assert.match(script,/Object\.keys\(d\?\.fields\|\|\{\}\)/);
 assert.match(script,/d\?\.sourceTemplateId&&x\.sourceTemplateId===d\.sourceTemplateId/);
 assert.doesNotThrow(()=>new vm.Script(script));
});
