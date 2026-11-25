// Adapted from AAA/src/educational-measure-model.ts. Local descriptive analysis only.
export const OPTIONS=["لا أوافق بشدة","لا أوافق","محايد","أوافق","أوافق بشدة"];
export const MEASURE_DISCLAIMER="أداة استطلاعية تربوية غير مقننة؛ ليست تشخيصًا نفسيًا ولا تحدد حاجة الفرد إلى علاج. نتائجها وصفية للاسترشاد بتخطيط الدعم.";
export const STARTER_MEASURES=[
 {title:"التكيف المدرسي",audience:"الطلاب",description:"الانطباعات العامة عن التأقلم مع البيئة المدرسية.",questions:["أشعر بالارتياح أثناء وجودي في المدرسة.","أستطيع طلب المساعدة عندما أواجه صعوبة مدرسية.","لدي علاقة إيجابية مع زملائي.","أفهم ما تتوقعه المدرسة مني.","أجد صعوبة مستمرة في التأقلم مع يومي الدراسي."] ,reverse:[4]},
 {title:"الدافعية للتعلم",audience:"الطلاب",description:"اتجاهات الطالب نحو التعلم والمثابرة.",questions:["أحرص على فهم الدروس حتى عندما تكون صعبة.","أضع لنفسي هدفًا دراسيًا واضحًا.","أستمر في المحاولة بعد الخطأ.","أرى أن ما أتعلمه مهم لمستقبلي.","أؤجل أنشطتي الدراسية حتى اللحظة الأخيرة."] ,reverse:[4]},
 {title:"قلق الاختبارات",audience:"الطلاب",description:"استطلاع خبرات الطلاب المتعلقة بمواقف الاختبارات، دون فرز سريري.",questions:["أشعر بتوتر يؤثر في تركيزي قبل الاختبارات.","يصعب علي النوم بسبب التفكير في الاختبارات.","أواجه صعوبة في تذكر المعلومات عند الاختبار.","أشعر براحة أكبر عندما أضع خطة للمذاكرة.","أحتاج إلى تعلم طرق تساعدني على إدارة التوتر أثناء الاختبارات."] ,reverse:[3]},
 {title:"الانتماء المدرسي",audience:"الطلاب",description:"مؤشرات وصفية للإحساس بالأمان والاندماج والمشاركة.",questions:["أشعر أنني عضو مهم في مدرستي.","أجد من يستمع إلى رأيي في المدرسة.","أشارك في الأنشطة المدرسية عندما تتاح لي الفرصة.","أشعر باحترام الآخرين لي في المدرسة.","أشعر بالعزلة خلال اليوم الدراسي."] ,reverse:[4]},
 {title:"الاحتياجات الإرشادية",audience:"الطلاب",description:"تحديد موضوعات الدعم التي يرغب الطلاب في الحصول عليها.",questions:["أحتاج إلى إرشادات تساعدني على تنظيم وقتي.","أحتاج إلى دعم في مهارات الاستذكار.","أرغب في تعلم مهارات التواصل وحل الخلافات.","أحتاج إلى مساعدة في التعامل مع ضغوط الدراسة.","أرغب في معرفة طرق الحصول على المساعدة عند مواجهة مشكلة."] ,reverse:[]}
];

export function summarizeMeasure(rows, itemCount, reverse=[]){
 if(!Number.isInteger(itemCount)||itemCount<3||itemCount>100)throw new RangeError('Invalid item count');
 if(!Array.isArray(rows)||!Array.isArray(reverse)||reverse.some(i=>!Number.isInteger(i)||i<0||i>=itemCount))throw new TypeError('Invalid input');
 const valid=rows.filter(r=>Array.isArray(r)&&r.length===itemCount&&r.every(v=>Number.isInteger(v)&&v>=1&&v<=5));
 const adjusted=valid.map(r=>r.map((v,i)=>reverse.includes(i)?6-v:v));
 const n=valid.length,mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
 const variance=a=>{const m=mean(a);return a.length>1?a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1):null};
 const items=Array.from({length:itemCount},(_,i)=>({item:i+1,mean:mean(adjusted.map(r=>r[i])),distribution:[1,2,3,4,5].map(v=>valid.filter(r=>r[i]===v).length)}));
 const totals=adjusted.map(r=>r.reduce((x,y)=>x+y,0));
 const totalVariance=variance(totals);
 const alpha=n>=30&&totalVariance>0?itemCount/(itemCount-1)*(1-items.reduce((s,_,i)=>s+variance(adjusted.map(r=>r[i])),0)/totalVariance):null;
 return {count:n,rejected:rows.length-n,mean:mean(adjusted.map(r=>mean(r))),items,alpha,disclaimer:MEASURE_DISCLAIMER};
}
