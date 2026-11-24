/**
 * المساند التربوي: pure, offline-first suggestion engine.
 * Reference: دليل التدخلات التربوية - وزارة التعليم - 1445هـ.
 * No automatic diagnosis, approval, network access or persistence.
 */
export const reference=Object.freeze({title:'دليل التدخلات التربوية',edition:'1445هـ',publisher:'وزارة التعليم'});
export const interventions=Object.freeze([
{id:'absence',label:'حل المشكلات',page:41,steps:['مقابلة الطالب وتحديد المشكلة','جمع أسبابها والتحقق منها','مناقشة الحلول الممكنة','اعتماد خطة متابعة','مراجعة النتائج']},
{id:'dropout',label:'إعادة البناء المعرفي',page:42,steps:['بناء علاقة مهنية داعمة','استكشاف أفكار الطالب','مناقشة بدائل واقعية','متابعة الموقف والإحالة عند الحاجة']},
{id:'failure',label:'طريقة SQ4R',page:43,steps:['التصفح','صياغة الأسئلة','القراءة','الاسترجاع','المراجعة']},
{id:'lowAchievement',label:'تنظيم الوقت والمذاكرة',page:44,steps:['مراجعة العادات الدراسية','إنشاء جدول مذاكرة','التنسيق مع الأسرة والمعلم','متابعة التقدم']},
{id:'examAnxiety',label:'مهارات الاستعداد للاختبارات',page:35,steps:['استكشاف مصادر القلق دون تشخيص','تنظيم المراجعة','التدرب على مهارات الاختبار','الإحالة للمختص عند الحاجة']}
]);
/** Only explicitly validated signals may trigger recommendations. */
export function signalsFromRecords({attendance,academic,caseRecord}={}){
 return {absence:attendance?.requiresCounselorReview===true,
 lowAchievement:academic?.requiresCounselorReview===true,
 dropout:caseRecord?.flags?.dropout===true,
 failure:caseRecord?.flags?.failure===true,
 examAnxiety:caseRecord?.flags?.examAnxiety===true};
}
export function suggest({signals={},studentId}={}){
 return interventions.filter(i=>signals[i.id]===true).map(i=>({...i,studentId:studentId??null,reference,approved:false,status:'suggested'}));
}
export function draft({studentId,ownerId,interventionId,hijriDate,goal,baseline,reviewDate}={}){
 const chosen=interventions.find(i=>i.id===interventionId);
 if(!chosen||!studentId||!ownerId||!hijriDate) throw new Error('Missing required reviewed intervention fields');
 return {type:'educational-intervention',studentId,ownerId,interventionId,reference:{...reference,page:chosen.page},
 steps:[...chosen.steps],hijriDate,goal:goal??null,baseline:baseline??null,reviewDate:reviewDate??null,
 status:'draft',approvedAt:null,executedAt:null};
}
export function compare({before,after,lowerIsBetter=true}={}){
 if(![before,after].every(v=>Number.isFinite(v)&&v>=0))return null;
 const delta=after-before;return {before,after,delta,improvement:lowerIsBetter?-delta:delta,
 percentChange:before===0?null:Math.round(delta/before*10000)/100,
 note:'مقارنة وصفية، لا تثبت علاقة سببية'};
}
