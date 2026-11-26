// Pure local workflow rules. No I/O, identity inference or automatic approvals.
const transitions={new:['active'],active:['referred','closed'],referred:['active','closed'],closed:[]};
const priorities=['routine','high','urgent'];
const clean=v=>typeof v==='string'?v.trim():'';
function date(v){const m=clean(v).match(/^(14\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|30)$/);return m?m[0]:''}
export function createCase(input,studentIds){
 const studentId=clean(input.studentId),id=clean(input.id),reason=clean(input.reason),actor=clean(input.actor),created=date(input.date);
 if(!id||!studentId||!studentIds.has(studentId)||!reason||!actor||!created||!priorities.includes(input.priority))throw Error('بيانات الحالة أو هوية الطالب غير مكتملة');
 return {id,studentId,reason,priority:input.priority,status:'new',referral:null,history:[{status:'new',actor,date:created}]};
}
export function advanceCase(record,input){
 const next=input.status,actor=clean(input.actor),day=date(input.date),last=record.history.at(-1);
 if(!transitions[record.status]?.includes(next)||!actor||!day||day<last.date)throw Error('انتقال الحالة غير صالح');
 let referral=record.referral;
 if(next==='referred'){
  const recipient=clean(input.recipient),due=date(input.due),reason=clean(input.reason);
  if(!recipient||!due||due<day||!reason)throw Error('الجهة والمهلة وسبب الإحالة مطلوبة');
  referral={recipient,due,reason,sent:day,response:'',resolved:false};
 }
 if(record.status==='referred'){
  const response=clean(input.response),justification=clean(input.justification);
  if(!response&&!justification)throw Error('وثق رد الإحالة أو مبرر إنهائها');
  referral={...referral,response,justification,resolved:true,resolvedDate:day};
 }
 const result=clean(input.result),approval=clean(input.approval);
 if(next==='closed'&&(!result||!approval))throw Error('النتيجة واعتماد الإغلاق مطلوبان');
 return {...record,status:next,referral,history:[...record.history,{status:next,actor,date:day,...(next==='referred'?{referral}:{}),...(record.status==='referred'?{referralResolution:referral}:{}),...(next==='closed'?{result,approval}:{})}]};
}
export function caseQueue(records,today){
 if(!date(today))throw Error('تاريخ المراجعة غير صالح');
 return records.filter(r=>r.status!=='closed').map(r=>({id:r.id,studentId:r.studentId,priority:r.priority,status:r.status,overdue:r.status==='referred'&&!r.referral?.resolved&&!!date(r.referral?.due)&&r.referral.due<today})).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||priorities.indexOf(b.priority)-priorities.indexOf(a.priority));
}
