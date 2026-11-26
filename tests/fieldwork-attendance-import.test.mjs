import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAttendance,attendanceHijri} from '../src/fieldwork-attendance-import.mjs';
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
