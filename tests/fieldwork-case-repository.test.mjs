import test from 'node:test';
import assert from 'node:assert/strict';
import {caseRepository} from '../src/fieldwork-case-repository.mjs';
// Deterministic transaction double; real browser IndexedDB verification remains required.
function fixture(){
 const rows=new Map();
 const database={transaction(name,mode){
  assert.equal(name,'cloudSnapshots');let aborted=false,pending;
  const tx={objectStore(){return {
   get(id){const req={};queueMicrotask(()=>{req.result=structuredClone(rows.get(id));req.onsuccess?.();if(!aborted){if(pending)rows.set(pending.id,structuredClone(pending));tx.oncomplete?.()}});return req},
   getAll(){const req={};queueMicrotask(()=>{req.result=structuredClone([...rows.values()]);req.onsuccess?.()});return req},
   put(row){assert.equal(mode,'readwrite');pending=row}
  }},abort(){aborted=true;queueMicrotask(()=>tx.onabort?.())}};return tx
 }};
 let current={accountId:'a',database,canApprove:false};const session=current;
 const repo=caseRepository({database,session,currentSession:()=>current,studentIds:()=>new Set(['s1'])});
 const input={id:'c1',studentId:'s1',reason:'متابعة',priority:'high',date:'1448/06/01',actor:'forged'};
 return {repo,rows,input,switchAccount(){current={...current,accountId:'b'}},allow(){current={...current,canApprove:true}}};
}
test('local case uses session actor and rejects duplicate IDs',async()=>{const f=fixture();const c=await f.repo.create(f.input);assert.equal(c.history[0].actor,'a');assert.equal(c.revision,1);await assert.rejects(f.repo.create(f.input));assert.equal((await f.repo.list()).length,1)});
test('rejects stale revisions and unverified student',async()=>{const f=fixture();await assert.rejects(f.repo.create({...f.input,studentId:'unknown'}));await f.repo.create(f.input);await f.repo.advance('c1',1,{status:'active',date:'1448/06/02'});await assert.rejects(f.repo.advance('c1',1,{status:'active',date:'1448/06/02'}));assert.equal((await f.repo.list())[0].revision,2)});
test('approval comes from current session not user input',async()=>{const f=fixture();await f.repo.create(f.input);await f.repo.advance('c1',1,{status:'active',date:'1448/06/02'});const close={status:'closed',date:'1448/06/03',result:'تم',approval:'forged'};await assert.rejects(f.repo.advance('c1',2,close));f.allow();const c=await f.repo.advance('c1',2,close);assert.equal(c.history.at(-1).approval,'a')});
test('account switch invalidates repository and pending reads',async()=>{const f=fixture();await f.repo.create(f.input);const pending=f.repo.list();f.switchAccount();await assert.rejects(pending);await assert.rejects(f.repo.list());assert.throws(()=>f.repo.create({...f.input,id:'c2'}));assert.equal(f.rows.size,1)});
test('foreign records excluded and cannot be modified',async()=>{const f=fixture();await f.repo.create(f.input);const row=f.rows.get('fieldwork-case:c1');row.owner='b';assert.equal((await f.repo.list()).length,0);await assert.rejects(f.repo.advance('c1',1,{status:'active',date:'1448/06/02'}))});
test('account switch before transaction read aborts write',async()=>{const f=fixture();const pending=f.repo.create(f.input);f.switchAccount();await assert.rejects(pending);assert.equal(f.rows.size,0)});
