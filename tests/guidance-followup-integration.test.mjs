import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
const src=page.slice(page.indexOf('/* DOCS_FOLLOWUP_START */'),page.indexOf('/* DOCS_FOLLOWUP_END */'));
const {docsFollowupKey:key,docsFollowupDate:date,docsFollowupValidate:validate,docsFollowupStatus:status,docsFollowupSource:source}=vm.runInNewContext(src+';({docsFollowupKey,docsFollowupDate,docsFollowupValidate,docsFollowupStatus,docsFollowupSource})');
const draft={action:'متابعة',goal:'تحسين',due:'1448/6/9',metric:'عدد',before:'5',after:'2',result:'تحسن'};
test('one stable followup per source; no identity inferred from names',()=>{
 assert.equal(source({source_table:'attendance',source_record_id:'1',student_name:'اسم'}).id,key('attendance','1'));
 assert.equal(source({source_table:'attendance',source_record_id:'1',student_name:'اسم'}).studentKey,'');
 assert.notEqual(key('attendance','1'),key('programs','1'));
 assert.equal(source({accountSourceTable:'local',source_record_id:'a',sourceA4:'a'}).id,key('a4','a'));
});
test('Hijri due date and explicit approval with measured outcome',()=>{
 assert.equal(date('١٤٤٨/٦/٩'),'1448/06/09');
 assert.equal(date('1448/13/1'),'');
 assert.equal(validate(draft,true).change,-3);
 assert.equal(validate(draft,false).status,'draft');
 assert.throws(()=>validate({...draft,after:''},true));
 assert.throws(()=>validate({...draft,result:''},true));
 assert.equal(status({...validate(draft,false)},'1448/06/10'),'متأخرة');
 assert.equal(status(validate(draft,true),'1448/06/10'),'معتمدة');
});
test('plan saved in existing backup snapshot store and approved print uses saved content',()=>{
 assert.match(page,/dsStoreSnapshot\(\{id:source.id,kind:'local-followup',plan/);
 assert.match(page,/stored\?\.status!=='approved'\)return/);
 assert.match(page,/docsRenderStudentFollowups\(key\)/);
 assert.match(page,/confirm\('هل راجعت الإجراء والنتيجة/);
});
