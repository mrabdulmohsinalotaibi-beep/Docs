import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const page=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
const date=page.slice(page.indexOf('function docsFollowupDate('),page.indexOf('function docsFollowupValidate('));
const review=page.slice(page.indexOf('function docsFollowupReviewQueue('),page.indexOf('let docsFollowupCenterToken='));
const queue=runInNewContext(date+review+'\ndocsFollowupReviewQueue');
const base={id:'a',status:'active',due:'1448/06/20',action:'متابعة',goal:'هدف',before:0,after:null,result:''};
test('overdue real plans are first and approved plans excluded',()=>{
 const rows=[{plan:base},{plan:{...base,id:'b',due:'1448/06/01'}},{plan:{...base,id:'c',status:'approved'}}];
 const result=queue(rows,'1448/06/10');
 assert.equal(result.length,2);assert.equal(result[0].id,'b');assert.equal(result[0].overdue,true);
 assert.ok(result[0].reasons.includes('القياس البعدي غير مسجل'));
});
test('zero post score is recorded, not missing',()=>{
 const r=queue([{plan:{...base,after:0,result:'موثق'}}],'1448/06/10');
 assert.equal(r[0].reasons.length,1);assert.equal(r[0].reasons[0],'جاهزة للمراجعة اليدوية');
});
