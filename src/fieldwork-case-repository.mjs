import {createCase,advanceCase,caseQueue} from './fieldwork-case-engine.mjs';
// Adapter for the existing account-scoped snapshot store. Callers must supply
// the current account session and verified student roster, never form values.
export function caseRepository({database,session,currentSession,studentIds}){
 const active=()=>{const now=currentSession();if(!session?.accountId||!now||now.accountId!==session.accountId||now.database!==database||session.database!==database)throw Error('تغير الحساب');return now};
 const key=id=>'fieldwork-case:'+id;
 const checkedId=id=>{if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(id))throw Error('معرف الحالة غير صالح');return id};
 const assertRecord=(row,id)=>{if(!row||row.kind!=='local-fieldwork-case'||row.id!==key(id)||row.record?.id!==id||row.owner!==session.accountId)throw Error('الحالة غير متاحة لهذا الحساب');return row};
 function write(id,change){
  active();checkedId(id);
  return new Promise((resolve,reject)=>{
   const tx=database.transaction('cloudSnapshots','readwrite'),store=tx.objectStore('cloudSnapshots');let saved,failure;
   const req=store.get(key(id));
   req.onsuccess=()=>{try{const now=active();saved=change(req.result,now);store.put(saved)}catch(e){failure=e;tx.abort()}};
   tx.oncomplete=()=>{try{active();resolve(saved.record)}catch(e){reject(e)}};
   tx.onabort=()=>reject(failure||tx.error||Error('تعذر حفظ الحالة'));
   tx.onerror=()=>reject(tx.error||Error('تعذر حفظ الحالة'));
  });
 }
 return {
  create(input){return write(input.id,(old,now)=>{if(old)throw Error('الحالة موجودة');const record=createCase({...input,actor:now.accountId},studentIds());return {id:key(record.id),kind:'local-fieldwork-case',owner:now.accountId,revision:1,record:{...record,revision:1}}})},
  advance(id,revision,input){return write(id,(old,now)=>{const row=assertRecord(old,id);if(row.revision!==revision)throw Error('تغيرت الحالة؛ أعد فتحها');if(!studentIds().has(row.record.studentId))throw Error('تعذر التحقق من الطالب');if(input.status==='closed'&&now.canApprove!==true)throw Error('لا توجد صلاحية اعتماد');const record=advanceCase(row.record,{...input,actor:now.accountId,approval:input.status==='closed'?now.accountId:''});return {...row,revision:revision+1,record:{...record,revision:revision+1}}})},
  async list(){active();const rows=await new Promise((resolve,reject)=>{const req=database.transaction('cloudSnapshots','readonly').objectStore('cloudSnapshots').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});active();return rows.filter(row=>row.kind==='local-fieldwork-case'&&row.owner===session.accountId&&row.record&&row.id===key(row.record.id)).map(row=>row.record)},
  async queue(today){return caseQueue(await this.list(),today)}
 };
}
