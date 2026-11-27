// Password-derived, account-bound encryption for local case records.
// The key is non-extractable and must stay in the unlocked session only.
const encoder=new TextEncoder(),decoder=new TextDecoder();
const bytes=(v,n)=>{if(!Array.isArray(v)||v.length!==n||v.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('Invalid encryption parameters');return Uint8Array.from(v)};
const identity=(owner,id,revision)=>{if(typeof owner!=='string'||!owner||typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(id)||!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid case identity');return encoder.encode(JSON.stringify(['athat-fieldwork',1,owner,id,revision]))};
export async function unlockCaseCipher(password,salt=Array.from(crypto.getRandomValues(new Uint8Array(16)))){
 if(typeof password!=='string'||password.length<12)throw Error('Use a password of at least 12 characters');
 const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(salt,16),iterations:600000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 return {salt:[...salt],async seal(owner,record){
  const aad=identity(owner,record.id,record.revision),iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,encoder.encode(JSON.stringify(record)));
  return {id:'fieldwork-encrypted:'+record.id,kind:'local-fieldwork-encrypted',owner,caseId:record.id,revision:record.revision,version:1,iv:Array.from(iv),cipher:Array.from(new Uint8Array(ciphertext))};
 },async open(owner,row){
  if(row.version!==1||row.kind!=='local-fieldwork-encrypted'||row.owner!==owner||row.id!=='fieldwork-encrypted:'+row.caseId||!Array.isArray(row.cipher)||row.cipher.length<16||row.cipher.length>2000000)throw Error('Invalid encrypted case');
  const aad=identity(owner,row.caseId,row.revision);
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(row.iv,12),additionalData:aad},key,bytes(row.cipher,row.cipher.length));
  const record=JSON.parse(decoder.decode(clear));
  if(record.id!==row.caseId||record.revision!==row.revision)throw Error('Invalid case payload');
  return record;
 }};
}
