import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProfessionalPortfolio,buildProfessionalHighlights} from '../src/professional-portfolio.mjs';
const classify=s=>s;
test('professional portfolio exposes only fixed labels and aggregate ranges',()=>{
 const rows=[{kind:'الجلسات الفردية',status:'done',student_name:'SECRET_NAME',title:'SECRET_TITLE',fields:{note:'SECRET_NOTE'},photos:['SECRET_PHOTO'],source_record_id:'SECRET_ID'},{kind:'SECRET_KIND',status:'required'}];
 const result=buildProfessionalPortfolio(rows,classify,{signedIn:true,indexReady:true});
 assert.equal(result.total,'أقل من 5');assert.equal(result.completed,'أقل من 5');
 assert.equal(result.groups[3].total,'أقل من 5');assert.equal(result.groups[7].completed,'0');
 assert.doesNotMatch(JSON.stringify(result),/SECRET/);
 assert.equal(buildProfessionalPortfolio(rows,classify).total,null);
 assert.equal(buildProfessionalPortfolio(rows,classify,{signedIn:true}).coverage,'partial');
});
test('drafts and archived records are not counted as completed',()=>{
 const rows=Array.from({length:7},()=>({kind:'المبادرات',status:'required'}));rows.push({kind:'المبادرات',status:'archived'});
 const result=buildProfessionalPortfolio(rows,classify,{signedIn:true});
 assert.equal(result.total,'5+');assert.equal(result.completed,'0');
});
test('selected highlights expose safe metadata without student content',()=>{
 const rows=[{id:'local-1',kind:'برنامج توجيهي',title:'برنامج الانضباط',status:'done',hijriDate:'1448/04/02',photos:['photo'],fields:{notes:'PRIVATE_NOTE'}},{id:'local-2',kind:'جلسة فردية',title:'اسم طالب سري',studentKey:'student-1',status:'done',fields:{notes:'PRIVATE_NOTE'}}];
 const result=buildProfessionalHighlights(rows,{selectedKeys:['local-1','local-2']});
 assert.equal(result.length,2);assert.equal(result[0].evidence,1);assert.equal(result[1].title,'جلسة فردية');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_NOTE|اسم طالب سري/);
});
