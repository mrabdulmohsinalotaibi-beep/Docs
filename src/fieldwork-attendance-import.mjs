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

 
// Local encrypted attendance batch. Writes only after confirmation and rechecks
// the live session and roster inside the transaction. No network access.
export async function commitAttendanceBatch({database,session,currentSession,studentIds,preview,confirmed}){
 const active=()=>{const now=currentSession();if(!session?.accountId||now!==session||now.database!==database||!now.caseCipher)throw Error('جلسة الحفظ مقفلة أو تغير الحساب');return now};
 active();
 if(confirmed!==true||!Array.isArray(preview?.rows)||preview.rows.length>20000)throw Error('تأكيد المعاينة مطلوب');
 const candidates=preview.rows.filter(r=>r?.status==='candidate'), staged=new Map();
 for(const r of candidates){
  active();
  if(typeof r.studentId!=='string'||!studentIds().has(r.studentId)||attendanceHijri(r.date)!==r.date||!['absence','late'].includes(r.kind))throw Error('تغيرت بيانات المعاينة');
  const fingerprint=key(r.studentId,r.date,r.kind);
  if(staged.has(fingerprint))continue;
  // A deterministic account-keyed digest is not available on the case cipher.
  // Use a random encrypted batch and compare decrypted prior batches before commit.
  staged.set(fingerprint,{studentId:r.studentId,date:r.date,kind:r.kind});
 }
 const readAll=()=>new Promise((ok,no)=>{const q=database.transaction('cloudSnapshots','readonly').objectStore('cloudSnapshots').getAll();q.onsuccess=()=>ok(q.result||[]);q.onerror=()=>no(q.error)});
 const prior=(await readAll()).filter(r=>r.kind==='local-fieldwork-encrypted'&&r.owner===session.accountId&&r.caseId?.startsWith('attendance-'));
 const known=new Set();
 for(const row of prior){active();const clear=await session.caseCipher.open(session.accountId,row);if(!Array.isArray(clear.events))throw Error('سجل مواظبة غير صالح');for(const event of clear.events)known.add(key(event.studentId,event.date,event.kind))}
 const events=[...staged].filter(([k])=>!known.has(k)).map(([,v])=>v);
 if(!events.length)return {added:0,skipped:candidates.length};
 const envelopes=[];
 for(let i=0;i<events.length;i+=250){active();envelopes.push(await session.caseCipher.seal(session.accountId,{id:'attendance-'+crypto.randomUUID(),revision:1,events:events.slice(i,i+250)}))}
 active();
 await new Promise((ok,no)=>{
  const tx=database.transaction('cloudSnapshots','readwrite'),store=tx.objectStore('cloudSnapshots');let failure;
  const q=store.getAll();q.onsuccess=()=>{try{active();const latest=(q.result||[]).filter(r=>r.kind==='local-fieldwork-encrypted'&&r.owner===session.accountId&&r.caseId?.startsWith('attendance-'));if(JSON.stringify(latest)!==JSON.stringify(prior))throw Error('تغيرت المواظبة؛ أعد المعاينة');if(events.some(r=>!studentIds().has(r.studentId)))throw Error('تغير دليل الطلاب');for(const row of envelopes)store.add(row)}catch(e){failure=e;tx.abort()}};
  tx.oncomplete=ok;tx.onabort=()=>no(failure||tx.error||Error('تعذر الحفظ'));tx.onerror=()=>no(tx.error);
 });
 active();return {added:events.length,skipped:candidates.length-events.length};
}
