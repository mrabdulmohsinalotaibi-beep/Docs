/* Public report returns only fixed labels and aggregate counts, never record content. */
export function buildProfessionalPortfolio(rows,classify,{signedIn=false,indexReady=false}={}){
 const labels=['التخطيط والإدارة','البرامج والمبادرات','الانضباط والمواظبة','الرعاية والمتابعة','التحصيل الدراسي','اللجان والتواصل','الشواهد والتوثيق','أعمال أخرى'];
 const types=new Map([
 ['plan_tasks',0],['programs',1],['attendance',2],['interviews',3],['counseling_cases',3],['referrals',3],['committees',5],
 ['خطة التوجيه الطلابي',0],['سجل العمل اليومي',0],['التقارير الإرشادية',0],['برامج الوزارة',1],['المبادرات',1],['الحضور والاستبانات',1],['تقرير التنفيذ',1],['البرامج والأعمال',1],
 ['سجل الانضباط',2],['الغياب والتأخر',2],['المخالفات السلوكية',2],['السلوك الإيجابي',2],['المواظبة',2],['سجل الانضباط المدرسي',2],['سجل حصر الغياب والتأخير',2],
 ['فتح الحالة الفردية',3],['الجلسات الفردية',3],['الجلسات الجماعية',3],['الخطة العلاجية',3],['الإغلاق والمتابعة',3],['الإحالات',3],['الحالات الطارئة',3],['الحالات والمتابعة',3],['المقابلات والاستشارات',3],
 ['تحليل النتائج',4],['الضعف الدراسي',4],['خطة الدعم',4],['لجنة التوجيه الطلابي',5],['مجلس الطلاب',5],['المراسلات',5],['الشواهد والتوثيق',6]]);
 if(!signedIn)return {coverage:'unavailable',groups:[],total:null,completed:null};
 const groups=labels.map(label=>({label,total:0,completed:0}));
 for(const row of rows){
  if(!row||row.kind==='ملف الإنجاز')continue;
  const g=groups[types.get(row.accountSourceTable)??types.get(row.kind)??7];
  const status=classify(row.status);g.total++;
  if(status==='done'||status==='approved')g.completed++;
 }
 const total=groups.reduce((n,g)=>n+g.total,0),completed=groups.reduce((n,g)=>n+g.completed,0);
 const safe=n=>n===0?'0':n<5?'أقل من 5':String(Math.floor(n/5)*5)+'+';
 return {coverage:indexReady?'indexed':'partial',total:safe(total),completed:safe(completed),groups:groups.map(g=>({label:g.label,total:safe(g.total),completed:safe(g.completed)}))};
}
