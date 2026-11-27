import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProfessionalPortfolio} from '../src/professional-portfolio.mjs';
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
