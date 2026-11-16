import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const raw=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const m=raw.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(m,'Worker embeds PAGE string');
const page=JSON.parse(m[1]);
const script=page.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
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
 assert.match(script,/signBlock/);
});
test('no document uploads added by A4 work',()=>{
 assert.doesNotMatch(script,/\/api\/documents\/upload|\/api\/a4\/upload/);
});
