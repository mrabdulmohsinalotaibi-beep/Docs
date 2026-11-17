import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const raw=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const m=raw.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(m,'Worker embeds PAGE string');
const page=JSON.parse(m[1]);
const script=[...page.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)].map(match=>match[1]).find(source=>source.includes('const A4_REF='));
test('inner application script parses',()=>{assert.ok(script);assert.doesNotThrow(()=>new vm.Script(script));});
test('11 Noor-oriented A4 groups and 18 weekly plans',()=>{
 const data=JSON.parse(readFileSync(new URL('../data/a4-guidance-1448.json',import.meta.url),'utf8'));
 assert.equal(Object.keys(data.groups).length,11);
 assert.equal(data.weeklyPrograms.length,18);
 for(const w of data.weeklyPrograms){assert.ok(w.week>=1&&w.week<=18);assert.ok(Array.isArray(w.programs))}
 assert.match(script,/const A4_REF=/);
 assert.match(script,/const groups=Object.keys\(A4_REF.groups\)/);
});
test('A4 official header, account profile and preserved evidence',()=>{
 assert.match(page,/id="officialMinistryLogo"/);
 assert.match(page,/id="profileDepartment"/);
 assert.match(page,/id="profileCounselor"/);
 assert.match(page,/id="signaturePad"/);
 assert.match(script,/MOE_OFFICIAL_LOGO/);
 assert.match(script,/hijriToday\(\)/);
 assert.match(script,/signature:signatureData/);
 assert.match(script,/photos:\[\.\.\.photos\]/);
 assert.match(script,/const evidence=/);
 assert.match(script,/function originalA4Dom\(/);
 assert.match(script,/function printDocs\(rows\)\{return printOriginalA4Docs\(rows\)\}/);
});
test('no document uploads added by A4 work',()=>{
 assert.doesNotMatch(script,/\/api\/documents\/upload|\/api\/a4\/upload/);
});

test('directory selection includes all 16 primary administrations and local subdivisions',()=>{
 const data=JSON.parse(readFileSync(new URL('../data/department-programs-1448.json',import.meta.url),'utf8'));
 assert.equal(data.directories.heads.length,16);
 assert.equal(data.departments.length,47);
 assert.equal(data.nationalPrograms.length,10);
 assert.equal(data.departments.find(x=>x.name==='مكة المكرمة').weeks.length,18);
 assert.equal(data.departments.find(x=>x.name==='عسير').weeks.length,1);
 for(const dep of data.departments){
  assert.ok(['weekly','partial','reference_only','unavailable'].includes(dep.status));
  if(dep.status==='unavailable')assert.equal(dep.weeks.length,0);
 }
});
test('regional scope, program search, stage profile and local source review are present',()=>{
 assert.match(page,/id="programScope"/);
 assert.match(page,/id="programSearch"/);
 assert.match(page,/id="profileStage"/);
 assert.match(page,/id="localPlanFile"/);
 assert.match(page,/id="localProgramText"/);
 assert.match(page,/id="programCustom"/);
 assert.match(script,/const DEPT_REF=/);
 assert.match(script,/const regionalByName=/);
 assert.match(script,/function availablePrograms\(/);
 assert.match(script,/localStorage\.setItem\(localProgramsKey\(\)/);
 assert.match(script,/indexedDB\.open\('athat-docs-planfiles-v1-'/);
 assert.doesNotMatch(script,/\/api\/plans\/upload/);
});
