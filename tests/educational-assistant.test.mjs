import test from 'node:test';
import assert from 'node:assert/strict';
import {signalsFromRecords,suggest,draft,compare} from '../src/educational-assistant.mjs';
test('no guesses without verified data',()=>assert.equal(suggest().length,0));
test('attendance suggestion references guide and is unapproved',()=>{
 const flags=signalsFromRecords({attendance:{requiresCounselorReview:true}});
 const items=suggest({signals:flags,studentId:'student'});
 assert.equal(items.length,1);assert.equal(items[0].page,41);assert.equal(items[0].approved,false);
});
test('draft requires owner and remains draft',()=>{
 assert.throws(()=>draft({studentId:'s'}));
 const d=draft({studentId:'s',ownerId:'o',interventionId:'absence',hijriDate:'1448/05/15'});
 assert.equal(d.status,'draft');assert.equal(d.approvedAt,null);
});
test('measurement reports change without claiming causality',()=>{
 assert.equal(compare({before:0,after:1}).percentChange,null);
 assert.equal(compare({before:8,after:2}).improvement,6);
});
