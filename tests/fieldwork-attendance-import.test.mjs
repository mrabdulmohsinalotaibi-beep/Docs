import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAttendance,attendanceHijri,commitAttendanceBatch} from '../src/fieldwork-attendance-import.mjs';
test('preview rejects invalid and ambiguous identities and flags duplicate events',()=>{
 const students=[{key:'a',student_no:'001'},{key:'b',student_no:'002'},{key:'c',student_no:'002'}];
 const row={studentNumber:'٠٠١',date:'1448/06/01',kind:'غياب'};
 const rows=[row,row,{...row,kind:'تأخر'},{...row,studentNumber:'002'},{...row,studentNumber:'1'},{...row,date:'1448/13/01'}];
 const result=previewAttendance(rows,students,[{studentId:'a',date:'1448/06/01',kind:'late'}]);
 assert.deepEqual(result.counts,{candidate:1,existing:1,duplicate:1,invalid:3});
 assert.equal(result.rows[3].reason,'ambiguous-student');
 assert.equal(result.rows[4].reason,'unknown-student');
 assert.equal(result.rows[5].reason,'invalid-date');
});
test('validates actual Umm al-Qura calendar days',()=>{
 assert.equal(attendanceHijri('١٤٤٨/٦/١'),'1448/06/01');
 assert.equal(attendanceHijri('1448/06/31'),'');
 assert.equal(attendanceHijri('2026/11/26'),'');
});

 test('rejects inherited property names and tolerates malformed rows',()=>{
 const students=[null,{key:'a',student_no:'001'}];
 const row={studentNumber:'001',date:'1448/06/01',kind:'constructor'};
 const result=previewAttendance([row,{...row,kind:'__proto__'},null,{...row,kind:'غياب'}],students,[null]);
 assert.deepEqual(result.counts,{candidate:1,existing:0,duplicate:0,invalid:3});
 assert.equal(result.rows[0].reason,'invalid-kind');
 });

import {unlockCaseCipher} from '../src/fieldwork-case-crypto.mjs';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
test('encrypted attendance persists once, rejects unknown students and requires confirmation',async()=>{
 const rows=new Map();
 const database={transaction(name,mode){assert.equal(name,'cloudSnapshots');let pending=[],aborted=false;
 const tx={objectStore(){return {getAll(){const q={};queueMicrotask(()=>{q.result=structuredClone([...rows.values()]);q.onsuccess?.();if(!aborted){for(const row of pending)rows.set(row.id,structuredClone(row));tx.oncomplete?.()}});return q},add(row){assert.equal(mode,'readwrite');pending.push(row)}}},abort(){aborted=true;queueMicrotask(()=>tx.onabort?.())}};return tx}};
 const cipher=await unlockCaseCipher('fixture-password-1234');
 const session={accountId:'fixture-a',database,caseCipher:cipher};let current=session;
 const preview=previewAttendance([{studentNumber:'001',date:'1448/06/01',kind:'غياب'}],[{key:'fixture-student',student_no:'001'}],[]);
 const options={database,session,currentSession:()=>current,studentIds:()=>new Set(['fixture-student']),preview,confirmed:true};
 await assert.rejects(commitAttendanceBatch({...options,confirmed:false}));
 await assert.rejects(commitAttendanceBatch({...options,studentIds:()=>new Set()}));
 assert.equal(rows.size,0);
 assert.deepEqual(await commitAttendanceBatch(options),{added:1,skipped:0});
 assert.equal(rows.size,1);
 const encrypted=[...rows.values()][0];
 assert.ok(!JSON.stringify(encrypted).includes('fixture-student'));
 assert.deepEqual((await cipher.open(session.accountId,encrypted)).events,[{studentId:'fixture-student',date:'1448/06/01',kind:'absence'}]);
 await assert.rejects(cipher.open('fixture-b',encrypted));
 assert.deepEqual(await commitAttendanceBatch(options),{added:0,skipped:1});
 current=null;await assert.rejects(commitAttendanceBatch(options));assert.equal(rows.size,1);
});
