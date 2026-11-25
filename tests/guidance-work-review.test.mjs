import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewGuidanceWork} from '../src/guidance/work-review.mjs';
const base={source:'local',sourceId:'1',studentId:'s1',status:'pending',due:'1448-06-01'};
test('identical records count once and due work is visible',()=>{
 const r=reviewGuidanceWork([base,{...base}], '1448-06-02');
 assert.equal(r.pending.length,1);assert.equal(r.due.length,1);
});
test('conflicting sources are not silently overwritten',()=>{
 const r=reviewGuidanceWork([base,{...base,status:'approved'}], '1448-06-02');
 assert.equal(r.conflicts.length,1);assert.equal(r.approved.length,0);assert.equal(r.pending.length,0);
});
test('unknown status and missing provenance are not treated as completed',()=>{
 const r=reviewGuidanceWork([{...base,status:'unknown'},{studentId:'s2'}], '1448-06-02');
 assert.equal(r.unknown.length,1);assert.equal(r.unlinkedCount,1);
});
test('approved and future work are not overdue',()=>{
 const r=reviewGuidanceWork([{...base,status:'approved'},{...base,sourceId:'2',due:'1448-07-01'}], '1448-06-02');
 assert.equal(r.approved.length,1);assert.equal(r.pending.length,1);assert.equal(r.due.length,0);
});

import {classifyDocsWorkStatus,summarizeDocsOriginals} from '../src/guidance/work-review.mjs';
test('Arabic explicit completion and approval remain distinct',()=>{
 assert.equal(classifyDocsWorkStatus('مُكتملة'),'done');
 assert.equal(classifyDocsWorkStatus('معتمد'),'approved');
 assert.equal(classifyDocsWorkStatus('غير مكتمل'),'unknown');
});
test('student summaries use keys rather than names',()=>{
 const r=summarizeDocsOriginals([{student_key:'a',status:'مكتمل'},{studentKey:'b',status:'مسودة'},{studentName:'a',status:'معتمد'}],{signedIn:true});
 assert.equal(r.coverage,'partial');assert.equal(r.students.length,2);assert.equal(r.unlinked,1);assert.equal(r.counts.approved,1);
});
test('signed out summaries never expose account rows',()=>{
 const r=summarizeDocsOriginals([{student_key:'a',status:'مكتمل'}]);
 assert.equal(r.counts,null);assert.deepEqual(r.students,[]);
});
