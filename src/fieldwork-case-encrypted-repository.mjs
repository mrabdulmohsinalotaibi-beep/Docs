import {createCase,advanceCase,caseQueue} from './fieldwork-case-engine.mjs';
// Encryption occurs outside the IndexedDB transaction; compare the exact
// previously read envelope inside the write transaction to prevent lost updates.
export function encryptedCaseRepository({database,session,currentSession,studentIds,cipher}){
 const active=()=>{const now=currentSession();if(!session?.accountId||now?.accountId!==session.accountId||now.database!==database||session.database!==database||now.caseCipher!==cipher||!cipher)throw Error('جلسة الحالات مقفلة أو تغير الحساب');return now};
 const key=id=>{if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(id))throw Error('معرف غير صالح');return 'fieldwork-encrypted:'+id};
 const read=async id=>{active();const row=await new Promise((ok,no)=>{const q=database.transaction('cloudSnapshots','readonly').objectStore('cloudSnapshots').get(key(id));q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});active();return row};
 async function commit(record,previous,requiresApproval=false){
  const owner=active().accountId,row=await cipher.seal(owner,record);active();
  await new Promise((ok,no)=>{
   const tx=database.transaction('cloudSnapshots','readwrite'),store=tx.objectStore('cloudSnapshots');let failure;
   const q=store.get(key(record.id));q.onsuccess=()=>{try{const now=active();if(requiresApproval&&now.canApprove!==true)throw Error('لا توجد صلاحية اعتماد');if(!studentIds().has(record.studentId))throw Error('الطالب غير متاح');if(JSON.stringify(q.result)!==JSON.stringify(previous))throw Error('تغيرت الحالة؛ أعد فتحها');store.put(row)}catch(e){failure=e;tx.abort()}};
   tx.oncomplete=ok;tx.onabort=()=>no(failure||tx.error||Error('تعذر الحفظ'));tx.onerror=()=>no(tx.error);
  });active();return record;
 }
 return {
  async create(input){const now=active();const previous=await read(input.id);if(previous)throw Error('الحالة موجودة');const record=createCase({...input,actor:now.accountId},studentIds());return commit({...record,revision:1},undefined)},
  async advance(id,revision,input){const previous=await read(id),now=active();if(!previous||previous.revision!==revision)throw Error('تغيرت الحالة أو غير موجودة');const record=await cipher.open(now.accountId,previous);const current=active();if(!studentIds().has(record.studentId))throw Error('الطالب غير متاح');if(input.status==='closed'&&current.canApprove!==true)throw Error('لا توجد صلاحية اعتماد');const next=advanceCase(record,{...input,actor:current.accountId,approval:input.status==='closed'?current.accountId:''});return commit({...next,revision:revision+1},previous,input.status==='closed')},
  async list(){const owner=active().accountId;const rows=await new Promise((ok,no)=>{const q=database.transaction('cloudSnapshots','readonly').objectStore('cloudSnapshots').getAll();q.onsuccess=()=>ok(q.result||[]);q.onerror=()=>no(q.error)});active();const records=[];for(const row of rows){if(row.kind!=='local-fieldwork-encrypted'||row.owner!==owner)continue;records.push(await cipher.open(owner,row));active()}return records},
  async queue(today){return caseQueue(await this.list(),today)}
 };
}
