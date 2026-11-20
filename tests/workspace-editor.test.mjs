import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(match,'The worker must embed the HTML page');
const page=JSON.parse(match[1]);
const appScript=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m=>m[1]).find(script=>script.includes('workspacePages.home.append('));
assert.ok(appScript,'Workspace initialization script is present');

test('the editor and its input controls are unique',()=>{
 const ids=[...page.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 for(const id of ['editor','editorPrograms','saveDoc','saveDocCopy','docTitle','docStatus','officialFields','docsCompleteness']){
  assert.equal(ids.filter(value=>value===id).length,1,id+' must be present exactly once');
 }
});

test('the editor is mounted before the program button handler is wired',()=>{
 const mount=appScript.indexOf('workspacePages.documents.append(recordsHeader,selector,originalWorks,docsGuidancePanel,originalTemplates,programBundle,originalArchive,review,originalEditor)');
 const attachHome=appScript.indexOf('docsMain.prepend(workspacePages.home)',mount);
 const programHandler=appScript.indexOf("$('editorPrograms').onclick=",attachHome);
 assert.ok(mount>=0,'Mount editor once in Documents workspace');
 assert.ok(attachHome>mount,'Attach home workspace to the document');
 assert.ok(programHandler>attachHome,'Find editor controls only after they are in the document');
 assert.doesNotMatch(appScript,/originalEditor\.parentNode\?\.removeChild\(originalEditor\)/,'Do not orphan the editor');
});

test('local and migrated records can open the same editor without replacing originals',()=>{
 assert.match(appScript,/function edit\(d,t\)/);
 assert.match(appScript,/const editor=\$\('editor'\)/);
 assert.match(appScript,/const oldDerived=docs\.find\(x=>x\.sourceA4===sourceId\)/);
 assert.match(appScript,/sourceA4:sourceId/);
 assert.match(appScript,/await task\('readwrite',store=>store\.put\(row\)\);await refresh\(\)/);
 assert.match(appScript,/sourceA4:previous\?\.sourceA4\|\|null/);
 assert.match(appScript,/\$\('saveDoc'\)\.onclick=\(\)=>docsSaveUpdated\(false\)/);
 assert.match(appScript,/\$\('saveDocCopy'\)\.onclick=\(\)=>docsSaveUpdated\(true\)/);
});

test('the original-record inventory excludes linked references and generated copies',()=>{
 assert.match(worker,/review_group/);
 assert.match(worker,/counselor-rewrite:%/);
 assert.match(worker,/comprehensive_records/);
 assert.match(appScript,/if\(r\.review_group!=='أصل عملي'\)continue/);
 assert.match(appScript,/function docsReviewCounts\(\)/);
 assert.match(page,/id="docsReliableBreakdown"/);
 assert.match(page,/id="migratedA4Group"/);
});
test('opening an original prepopulates documented source fields without inventing data',()=>{
 assert.match(appScript,/const original=p\.migration_original/);
 assert.match(appScript,/attendance:\[\['student_name','اسم الطالب'\]/);
 assert.match(appScript,/programs:\[\['name','اسم البرنامج'\]/);
 assert.match(appScript,/const val=original\[key\]/);
 assert.match(appScript,/if\(oldDerived&&!options\.forceNew\)\{edit\(await hydrateNativeA4Evidence\(oldDerived,sourceId\)\);return\}/);
});

test('five primary navigation pages exist and Settings is separate',()=>{
 assert.match(appScript,/\['home','الرئيسية'\],\['documents','المستندات'\],\['students','الطلاب'\],\['reports','التقارير'\],\['messages','الرسائل'\]/);
 assert.match(page,/#workspaceNav\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(page,/#workspaceNav\{position:fixed!important;[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(appScript,/workspacePages\.messages/);
 assert.match(appScript,/settingsButton\.onclick=\(\)=>workspaceGoto\('settings'\)/);
 assert.match(appScript,/workspacePages\.documents\.append\(recordsHeader,selector,originalWorks,docsGuidancePanel,originalTemplates,programBundle,originalArchive,review,originalEditor\)/);
 assert.match(appScript,/workspacePages\.home\.append\(originalHero,premiumMetrics,quickHeading,homeActions,latestHeading,cards\)/);
});
test('duplicate records are not repeated across documents, archives, or student panel',()=>{
 assert.match(appScript,/uniqueLocal=new Map\(\)/);
 assert.match(appScript,/function docsCanonicalKey\(document\)/);
 assert.match(appScript,/const key=docsCanonicalKey\(d\)/);
 assert.match(appScript,/filter\(r=>r\.review_group!=='أصل عملي'\)/);
 assert.match(appScript,/const entries=new Map\(\)/);
 assert.match(appScript,/if\(r\.student_key===studentKey&&r\.review_group==='أصل عملي'/);
 assert.match(appScript,/button\.onclick=\(\)=>openMigratedA4\(rec\.source_record_id\)/);
 assert.match(appScript,/docsView='works'/);
});

test('care records use authenticated student IDs and never guess matches from names',()=>{
 assert.match(worker,/if\(path==="\/api\/students\/source-record"\|\|path==="\/api\/students\/care\/categories"\|\|path==="\/api\/students\/care\/save"\|\|path==="\/api\/students\/care\/import"/);
 const start=worker.indexOf('if(path==="/api/students/care"){');
 const end=worker.indexOf('if(path==="/api/students/insights"){',start);
 assert.ok(start>0&&end>start);
 const route=worker.slice(start,end);
 assert.match(route,/matches\.size!==1/);
 assert.match(route,/byId\.get\(id\)/);
 assert.match(route,/byNumber\.get\(no\)/);
 assert.match(route,/source_table='counseling_cases'/);
 assert.doesNotMatch(route,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|\w+\s+SET)\b/);
 assert.match(page,/id="student360CareRecords"/);
 assert.match(appScript,/fetch\('\/api\/students\/care\?key='/);
 assert.match(appScript,/new Set\(studentCareIndex\[studentKey\]\?\.a4_ids\|\|\[\]\)/);
});

test('health and special-care filters use only source confirmed care flags',async()=>{
 const start=appScript.indexOf('function s360Flags(s){');
 const end=appScript.indexOf('function drawStudentFilters()',start);
 assert.ok(start>=0&&end>start);
 const vm=await import('node:vm');
 const sandbox={studentInsights:{},studentCareIndex:{}};
 vm.runInNewContext(appScript.slice(start,end)+'\nthis.flags=s360Flags',sandbox);
 const student={key:'athat:test',health_status:'',social_status:'',special_care_tags:[]};
 assert.equal(sandbox.flags(student).health,false);
 sandbox.studentCareIndex[student.key]={health:1,special:0};
 assert.equal(sandbox.flags(student).health,true);
 assert.equal(sandbox.flags(student).special,true);
 sandbox.studentCareIndex[student.key]={health:0,special:1};
 assert.equal(sandbox.flags(student).health,false);
 assert.equal(sandbox.flags(student).social,true);
});

test('student profile has four tabs and exactly one care section',()=>{
 assert.match(page,/id="studentProfileTabs"/);
 for(const section of ['basics','care','followup','documents'])assert.match(page,new RegExp('data-s360page="'+section+'"'));
 assert.equal((page.match(/id="student360CareRecords"/g)||[]).length,1);
 assert.match(appScript,/activateStudentProfileTab\('basics'\)/);
 assert.match(appScript,/const CARE_GROUPS=\[/);
 assert.match(appScript,/let studentInsights=/);
});
test('care import is user-scoped and does not create document copies',()=>{
 const start=worker.indexOf('if(path==="/api/students/care/import"){');
 const end=worker.indexOf('if(path==="/api/students"){',start);
 assert.ok(start>0&&end>start);
 const route=worker.slice(start,end);
 assert.match(route,/format!=="athat-student-care-v1"/);
 assert.match(route,/source_record_id/);
 assert.match(route,/byId\.get\(id\)/);
 assert.match(route,/byNo\.get\(number\)/);
 assert.match(route,/INSERT INTO docs_student_care\(user_id,student_key,tags_json,notes/);
 assert.doesNotMatch(route,/INSERT INTO docs_a4_records|INSERT INTO docs_a4_student_links/);
 assert.match(appScript,/studentCareImportFile/);
 assert.match(appScript,/fetch\('\/api\/students\/care\/import'/);
});

test('care categories are selectable, per-account custom, and saved on the original student',()=>{
 assert.match(appScript,/className='student-care-choice'/);
 assert.match(appScript,/chip\.setAttribute\('aria-pressed',String\(selected\.has\(label\)\)\)/);
 assert.match(appScript,/إضافة تصنيف جديد/);
 assert.match(appScript,/حفظ التصنيفات والرعاية/);
 assert.match(appScript,/fetch\('\/api\/students\/care\/save'/);
 const categories=worker.slice(worker.indexOf('if(path==="/api/students/care/categories"){'),worker.indexOf('if(path==="/api/students/care/save"){'));
 assert.match(categories,/docs_care_categories WHERE user_id=\?1/);
 assert.match(categories,/INSERT OR IGNORE INTO docs_care_categories\(user_id,category_name,group_name\)/);
 const save=worker.slice(worker.indexOf('if(path==="/api/students/care/save"){'),worker.indexOf('if(path==="/api/students/care/import"){'));
 assert.match(save,/students\.some\(s=>s\.key===key\)/);
 assert.match(save,/INSERT INTO docs_student_care\(user_id,student_key,tags_json,notes,source,updated_at\)/);
 assert.doesNotMatch(save,/INSERT INTO docs_a4_records|UPDATE docs_a4_records|DELETE FROM docs_a4_records/);
});

test('student timeline links directly to the actual source record with an in-place editor',()=>{
 assert.match(page,/id="student360RealRecord"/);
 assert.match(page,/id="s360RealBack"/);
 assert.match(page,/id="s360RealPrint"/);
 assert.match(page,/id="s360RealSave"/);
 assert.match(appScript,/link\.onclick=\(\)=>openRealStudentRecord\(item,link\)/);
 assert.match(appScript,/open\.onclick=\(\)=>openRealStudentRecord\(item,open\)/);
 assert.match(appScript,/await openGuidanceRecord\(type,id\)/);
 assert.match(appScript,/window\.print\(\)/);
 assert.match(appScript,/function returnToStudentRecord\(\)/);
 assert.match(appScript,/activateStudentProfileTab\('followup'\)/);
 assert.match(appScript,/window\.scrollTo\(\{top:studentRecordScroll/);
 assert.doesNotMatch(appScript.slice(appScript.indexOf('async function openRealStudentRecord('),appScript.indexOf("$('s360RealSave').onclick=")),/createNativeFromA4|docs\.push|db\.transaction/);
});
test('source record edits are authenticated, scoped to the actual student, and do not rewrite ATHAT originals',()=>{
 assert.match(worker,/if\(path==="\/api\/students\/source-record"\|\|path==="\/api\/students\/care\/categories"/);
 const begin=worker.indexOf('if(path==="/api/students/source-record"){');
 const finish=worker.indexOf('if(path==="/api/students/360"){',begin);
 assert.ok(begin>0&&finish>begin);
 const api=worker.slice(begin,finish);
 assert.match(api,/students\.find\(x=>x\.key===key\)/);
 assert.match(api,/athat_import_records WHERE user_id=\?1 AND source_table=\?2 AND source_record_id=\?3/);
 assert.match(api,/RECORD_NOT_LINKED/);
 assert.match(api,/INSERT INTO docs_student_record_edits\(user_id,student_key,source_table,source_record_id,fields_json/);
 assert.doesNotMatch(api,/UPDATE athat_import_records|INSERT INTO docs_a4_records|DELETE FROM/);
});

test('reports dashboard has four distinct functional sections and no duplicated record lists',()=>{
 for(const id of ['reportsSubnav','reportsDashboard','reportsAnalytics','reportsOfficial','reportsExport','reportsTopMetrics','reportsStudentBars','reportsDraft','reportsExportExcel','reportsPrintSummary'])assert.match(appScript,new RegExp(id));
 for(const tab of ['dashboard','analytics','official','export'])assert.match(appScript,new RegExp('data-report-tab="'+tab+'"'));
 assert.match(appScript,/function openReportTab\(name\)/);
 assert.match(appScript,/if\(target==='reports'\)\{refreshReportSummary\(\);loadReportSources\(\)\}/);
 assert.match(appScript,/function reportsRows\(ignoreFilters=false\)/);
 assert.match(appScript,/nativeA4Rows\(\)/);
 assert.match(appScript,/docsCanonicalKey\(doc\)/);
 assert.match(appScript,/reportsStudentLink\(filter\)/);
 assert.match(appScript,/workspaceGoto\('documents'\);openDocsView\('works'\)/);
});
test('reports only aggregate private data and exports are derived without new DB records',()=>{
 assert.match(appScript,/reportsStudentReady\?String\(reportsStudents\.length\):'—'/);
 assert.match(appScript,/reportsCare\.filter\(r=>Number\(r\.health\|\|0\)>0\)/);
 assert.match(appScript,/Promise\.allSettled\(paths\.map/);
 assert.match(appScript,/if\(owner!==activeUser\)return/);
 assert.match(appScript,/function reportsCsvCell\(value\)/);
 assert.match(appScript,/textContent=text/);
 assert.match(appScript,/win\.print\(\)/);
 assert.match(appScript,/لم يُنشأ مستند أو سجل جديد/);
 const reporting=appScript.slice(appScript.indexOf('const reportIntro=document.createElement'),appScript.indexOf('workspacePages.students.append(docsStudentsNav'));
 assert.doesNotMatch(reporting,/INSERT INTO|docs\.push\(|db\.transaction\(|createNativeFromA4\(/);
 assert.doesNotMatch(reporting,/reportsDownload\([^;]*student\.name/);
});

test('portfolio opens all account records and does not inherit stale filters',()=>{
 assert.match(appScript,/function activateDocsTab\(nextTab\)/);
 assert.match(appScript,/if\(tab==='portfolio'\)/);
 assert.match(appScript,/\$\('search'\)\.value=''/);
 assert.match(appScript,/\$\('nativeDocsLink'\)\.value='all'/);
 assert.match(appScript,/\['portfolio','ملف الإنجاز'\]/);
 assert.match(appScript,/if\(view==='portfolio'\)activateDocsTab\('portfolio'\)/);
 assert.match(appScript,/loadGuidanceRecords\(\)\.catch/);
 assert.match(appScript,/جارٍ استرجاع أعمال حسابك لملف الإنجاز/);
 assert.match(appScript,/اختر الأعمال التي تريد إضافتها إلى ملف الإنجاز أولًا/);
});

test('legacy account controls no longer call removed ATHAT APIs',()=>{
 assert.doesNotMatch(appScript,/fetch\('\/api\/students\/a4-sync'/);
 assert.doesNotMatch(appScript,/fetch\('\/api\/students\/source-record/);
 assert.doesNotMatch(appScript,/fetch\('\/api\/sample-from-athat'/);
 assert.match(appScript,/await openGuidanceRecord\(type,id\)/);
 assert.match(appScript,/await docsMirrorCycle\(\)/);
});
test('portfolio exports imported and local selected records into the official A4 renderer',()=>{
 assert.match(appScript,/selectedA4=\[\.\.\.selected\]/);
 assert.match(appScript,/selectedGuidance=\[\.\.\.selected\]/);
 assert.match(appScript,/originalA4SourceModel\(item\.record,item\.record\.payload\|\|\{\}\)/);
 assert.match(appScript,/printOriginalA4Docs\(\[\],models,win\)/);
 assert.match(appScript,/if\(failed\)\{/);
 assert.match(appScript,/preparedWindow\|\|window\.open/);
 assert.match(appScript,/\$\('backupBtn'\)\.onclick=\(\)=>\{workspaceGoto\('settings'\)/);
});
