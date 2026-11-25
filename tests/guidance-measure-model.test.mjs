import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMeasure,STARTER_MEASURES,MEASURE_DISCLAIMER} from '../src/guidance/measure-model.mjs';
test('five original exploratory templates are not diagnostic',()=>{assert.equal(STARTER_MEASURES.length,5);assert.match(MEASURE_DISCLAIMER,/ليست تشخيصًا/)});
test('reverse scoring and response rejection',()=>{const r=summarizeMeasure([[5,1,5],[0,1,5],[1,2]],3,[1]);assert.equal(r.count,1);assert.equal(r.rejected,2);assert.equal(r.mean,5);assert.equal(r.alpha,null)});
test('identical varying items yield alpha one',()=>{const r=summarizeMeasure(Array.from({length:30},(_,i)=>Array(3).fill(1+i%5)),3);assert.ok(Math.abs(r.alpha-1)<1e-10)});
test('constant and empty samples never invent reliability',()=>{assert.equal(summarizeMeasure(Array.from({length:30},()=>[3,3,3]),3).alpha,null);assert.equal(summarizeMeasure([],3).mean,null)});
test('out of range reverse items are rejected',()=>assert.throws(()=>summarizeMeasure([],3,[3])));
