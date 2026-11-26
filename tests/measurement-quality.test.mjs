import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const page=await readFile(new URL('../src/page.html',import.meta.url),'utf8');
const start=page.indexOf('function gradeMeasurementQuality(');
const end=page.indexOf('function gradePlanBelongs(',start);
assert.ok(start>=0&&end>start);
const gradeMeasurementQuality=vm.runInNewContext(page.slice(start,end)+';gradeMeasurementQuality');
test('plan editor exposes live measurement quality status',()=>{
 assert.match(page,/id="gradePlanQuality"/);
 assert.match(page,/gradeRenderPlanQuality\(\{\.\.\.gradeEditingPlan,post:/);
});

test('complete verified measurements are comparable',()=>{
 const result=gradeMeasurementQuality({baseline:60,post:75,sourceFile:'اختبار 1.csv',period:'الفصل الأول',identityVerified:true});
 assert.equal(result.comparable,true);
 assert.equal(result.status,'قابل للمقارنة');
 assert.deepEqual(Array.from(result.missing),[]);
});

test('missing or invalid provenance requires review',()=>{
 const result=gradeMeasurementQuality({baseline:110,post:null,sourceFile:'',period:'',identityVerified:false});
 assert.equal(result.comparable,false);
 assert.equal(result.status,'يحتاج مراجعة');
 assert.deepEqual(Array.from(result.missing),['القياس القبلي','القياس البعدي','مصدر القياس','فترة القياس','ربط الطالب بمعرّف مؤكد']);
});
