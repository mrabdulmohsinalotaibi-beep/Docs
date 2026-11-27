import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,advanceCase} from '../src/fieldwork-case-engine.mjs';
import {projectFieldworkCases,readFieldworkView} from '../src/fieldwork-case-view.mjs';
const ids=new Set(['s1','s2']);
const make=(id,studentId,due)=>{let row=createCase({id,studentId,reason:'test',priority:'high',date:'1448/06/01',actor:'a'},ids);row=advanceCase(row,{status:'active',date:'1448/06/02',actor:'a'});return advanceCase(row,{status:'referred',date:'1448/06/03',actor:'a',recipient:'school',due,reason:'test'})};
test('student projection isolates timelines while agenda categorizes account cases',async()=>{
 const a=make('a','s1','1448/06/04'),b=make('b','s2','1448/06/05');
 const view=await readFieldworkView({list:async()=>[a,a,b]},{studentId:'s1',today:'1448/06/05'});
 assert.equal(view.student.total,1);assert.equal(view.student.timeline.length,3);
 assert.ok(view.student.timeline.every(x=>x.studentId==='s1'));
 assert.deepEqual(view.agenda.overdue.map(x=>x.id),['a']);assert.deepEqual(view.agenda.dueToday.map(x=>x.id),['b']);
 view.student.timeline[0].event.status='changed';assert.equal(a.history.at(-1).status,'referred');
});
test('closed cases remain in timeline but not in the daily queue',()=>{
 const row=advanceCase(make('a','s1','1448/06/04'),{status:'closed',date:'1448/06/05',actor:'a',response:'done',result:'done',approval:'a'});
 const view=projectFieldworkCases([row],{studentId:'s1',today:'1448/06/06'});
 assert.equal(view.student.closed,1);assert.equal(view.student.timeline[0].status,'closed');assert.equal(view.agenda.open.length,0);
});
