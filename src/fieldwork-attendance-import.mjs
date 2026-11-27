// Pure attendance import preview. Never writes records or guesses student identity.
const norm=v=>String(v??'').trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
export function attendanceHijri(value){
 const m=norm(value).match(/^(14\d{2})[/-](\d{1,2})[/-](\d{1,2})$/);
 if(!m||+m[2]<1||+m[2]>12||+m[3]<1||+m[3]>30)return '';
 const d=m[1]+'/'+m[2].padStart(2,'0')+'/'+m[3].padStart(2,'0');
 const fmt=new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'UTC'});
 const target=+m[1]*10000+ +m[2]*100+ +m[3];
 let lo=Math.floor(Date.UTC(1970,0,1)/86400000),hi=Math.floor(Date.UTC(2100,0,1)/86400000);
 while(lo<=hi){const mid=Math.floor((lo+hi)/2),p=fmt.formatToParts(new Date(mid*86400000)),n=k=>Number(p.find(x=>x.type===k)?.value);const actual=n('year')*10000+n('month')*100+n('day');if(actual===target)return d;if(actual<target)lo=mid+1;else hi=mid-1}
 return '';
}
const attendanceTypes=new Map([['غياب','absence'],['تأخر','late'],['التأخر','late'],['التأخر الصباحي','late'],['absence','absence'],['late','late']]);
const type=v=>attendanceTypes.get(norm(v))||'';
const key=(id,date,kind)=>JSON.stringify([id,date,kind]);
export function previewAttendance(rows,students,existing){
 if(!Array.isArray(rows)||!Array.isArray(students)||!Array.isArray(existing)||rows.length>20000)throw Error('بيانات المعاينة غير صالحة');
 const byNumber=new Map();
 for(const s of students){if(!s||typeof s!=='object')continue;const n=norm(s.student_no);if(!n||!s.key)continue;const ids=byNumber.get(n)||new Set();ids.add(s.key);byNumber.set(n,ids)}
 const known=new Set(),seen=new Set(),result=[];
 for(const r of existing){if(!r||typeof r!=='object')continue;const d=attendanceHijri(r.date),k=type(r.kind);if(r.studentId&&d&&k)known.add(key(r.studentId,d,k))}
 for(const [i,r] of rows.entries()){
  const ids=byNumber.get(norm(r?.studentNumber)),date=attendanceHijri(r?.date),kind=type(r?.kind);
  if(!ids||ids.size!==1||!date||!kind){result.push({line:i+1,status:'invalid',reason:!ids?'unknown-student':ids.size!==1?'ambiguous-student':!date?'invalid-date':'invalid-kind'});continue}
  const studentId=[...ids][0],fingerprint=key(studentId,date,kind);
  const status=known.has(fingerprint)?'existing':seen.has(fingerprint)?'duplicate':'candidate';
  seen.add(fingerprint);result.push({line:i+1,status,studentId,date,kind});
 }
 return {rows:result,counts:Object.fromEntries(['candidate','existing','duplicate','invalid'].map(k=>[k,result.filter(r=>r.status===k).length]))};
}
