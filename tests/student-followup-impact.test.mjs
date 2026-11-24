import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
const start=page.indexOf('function gradeImpact('),end=page.indexOf('function gradePlanStore(',start);
assert.ok(start>=0&&end>start);
const {gradeImpact,gradePlanBelongs}=vm.runInNewContext(page.slice(start,end)+';({gradeImpact,gradePlanBelongs})');
test('measure impact in percentage points, including zero and decline',()=>{
 assert.equal(gradeImpact(40,65),25);
 assert.equal(gradeImpact(80,0),-80);
 assert.equal(gradeImpact(75,75),0);
 assert.equal(gradeImpact(0,100),100);
 for(const value of [null,'','  ',NaN,Infinity,-1,101])assert.equal(gradeImpact(50,value),null);
});
test('student profile never guesses a link when matching is ambiguous',()=>{
 assert.equal(gradePlanBelongs({studentKey:'a'},'a',()=>null),true);
 assert.equal(gradePlanBelongs({studentKey:'b'},'a',()=>({key:'a'})),false);
 assert.equal(gradePlanBelongs({name:'student'},'a',()=>null),false);
 assert.equal(gradePlanBelongs({name:'student'},'a',()=>({key:'a'})),true);
});
test('impact is captured locally and shown in student profile',()=>{
 assert.match(page,/id="gradePlanPost"/);
 assert.match(page,/gradeEditingPlan,post,action/);
 assert.match(page,/gradeImpact\(plan.baseline,plan.post\)/);
 assert.match(page,/tx.oncomplete=\(\)=>resolve\(req.result\)/);
});
