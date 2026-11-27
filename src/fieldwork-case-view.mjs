// Read-only projections for the existing student profile and daily agenda.
import {caseQueue} from './fieldwork-case-engine.mjs';
export function projectFieldworkCases(records,{studentId,today}){
 if(!Array.isArray(records))throw TypeError('Invalid case collection');
 const cases=records.filter(row=>row&&typeof row.id==='string'&&typeof row.studentId==='string'&&Array.isArray(row.history));
 const unique=[...new Map(cases.map(row=>[row.id,row])).values()];
 const studentCases=unique.filter(row=>row.studentId===studentId);
 const timeline=studentCases.flatMap(row=>row.history.map((event,index)=>({caseId:row.id,studentId:row.studentId,index,date:event.date,status:event.status,event:structuredClone(event)}))).sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.caseId.localeCompare(b.caseId)||b.index-a.index);
 const queue=caseQueue(unique,today);
 return {student:{total:studentCases.length,open:studentCases.filter(row=>row.status!=='closed').length,closed:studentCases.filter(row=>row.status==='closed').length,timeline},agenda:{overdue:queue.filter(row=>row.overdue),dueToday:queue.filter(row=>{const source=unique.find(c=>c.id===row.id);return row.status==='referred'&&!source.referral?.resolved&&source.referral?.due===today}),open:queue}};
}
export async function readFieldworkView(repository,options){
 return projectFieldworkCases(await repository.list(),options);
}
