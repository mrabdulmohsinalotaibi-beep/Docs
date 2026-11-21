import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(match,'Worker has its embedded HTML');
const page=JSON.parse(match[1]);
const matchStart='/* DOCS_GRADE_MODULE_START */';
const matchEnd='/* DOCS_GRADE_MODULE_END */';
const start=page.indexOf(matchStart),end=page.indexOf(matchEnd);
assert.ok(start>0&&end>start,'Grade analysis is integrated in the original workspace script');
const script=page.slice(start+matchStart.length,end);
const mainStart=page.indexOf('<script>\n(()=>{\'use strict\';');
const workspaceCatch=page.indexOf('}catch(workspaceError){');
assert.ok(mainStart>=0&&start>mainStart&&end<workspaceCatch,'The grade analyzer executes within the workspace scope');

test('grade analysis script parses and is reachable from site navigation',()=>{
 assert.doesNotThrow(()=>new Script(script));
 assert.match(script,/workspacePages\.grades=panel/);
 assert.match(script,/workspaceGoto\('grades'\)/);
 assert.match(script,/athat-docs-grades-v1-/);
 assert.doesNotMatch(script,/\bfetch\s*\(/,'Student grades must not be sent to any server');
 assert.match(page,/gradePrint-only|grade-print-only/);
});
function analyzer(){
 const ix=script.indexOf('function notice(');
 assert.ok(ix>0);
 const prefix=script.slice(0,ix)+'globalThis.__gradeTest={csvRows,numeric,parseGrades,fieldMap,detectHeader,stats,subjects,norm};})();';
 const context={document:{getElementById:()=>({})},workspacePages:{},globalThis:null};
 context.globalThis=context;
 runInNewContext(prefix,context,{timeout:2000});
 return context.__gradeTest;
}
test('CSV correctly parses Arabic columns, quoted commas and newlines',()=>{
 const a=analyzer();const rows=a.csvRows('\uFEFFاسم الطالب,الصف,الرياضيات\n"محمد, أحمد",الأول المتوسط,٣٠/٥٠\nعلي,الثاني المتوسط,٤٠/٥٠');
 assert.equal(rows.length,3);
 assert.equal(rows[1][0],'محمد, أحمد');
 assert.equal(a.numeric('٣٠/٥٠').n,30);
 assert.equal(a.numeric('٣٠/٥٠').max,50);
});
test('wide results respect maximum grades and reject invalid entries',()=>{
 const a=analyzer(),rows=[['اسم الطالب','الصف','الفصل','رياضيات','علوم'],['محمد','الأول المتوسط','1','٣٠/٥٠','٧٠'],['علي','الأول المتوسط','1','100','120']];
 const map=a.fieldMap(rows[0]);assert.equal(map.name,0);
 const cols=a.subjects(rows[0],map).map(x=>({i:x.i,name:x.name}));
 const report=a.parseGrades(rows,0,map,'wide',cols,100);
 assert.equal(report.records.length,3);
 assert.equal(report.records[0].pct,60);
 assert.equal(report.records[1].pct,70);
 assert.equal(report.bad.length,1);
});
test('long result tables compute per-subject averages and flags without a pass/fail verdict',()=>{
 const a=analyzer(),rows=[['اسم الطالب','الصف','المادة','الدرجة','النهاية العظمى'],['أحمد','الأول المتوسط','الرياضيات','30','50'],['أحمد','الأول المتوسط','العلوم','45','50'],['خالد','الأول المتوسط','الرياضيات','10','50']];
 const result=a.parseGrades(rows,0,a.fieldMap(rows[0]),'long',[],100);
 assert.equal(result.records.length,3);
 const totals=a.stats(result.records,60,90);
 assert.equal(totals.students,2);
 assert.equal(totals.low,1);
 assert.equal(totals.high,1);
 assert.equal(totals.subjects.find(s=>s.name==='الرياضيات').average,40);
});
