import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const registry=JSON.parse(await readFile(resolve(root,'docs/source-registry.json'),'utf8'));

test('source registry has unique qualified entries',()=>{
 assert.ok(registry.entries.length>=1);
 const ids=registry.entries.map(entry=>entry.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const entry of registry.entries){
  assert.ok(entry.repositoryPath);
  assert.ok(Array.isArray(entry.claims)&&entry.claims.length);
  assert.ok(Array.isArray(entry.limitations)&&entry.limitations.length);
 }
});

test('unverified sources are explicitly qualified',()=>{
 for(const entry of registry.entries){
  if(entry.status!=='official')assert.ok(entry.limitations.some(text=>/ليس|لا |غير|مراجعة|تحقق|استرشادي|تشخيص/i.test(text)),entry.id);
 }
});
