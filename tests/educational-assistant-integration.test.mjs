import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';

const root=new URL('../',import.meta.url);
const page=await readFile(new URL('src/page.html',root),'utf8');

test('student assistant is integrated into the existing student profile exactly once',()=>{
 for(const marker of ['data-s360page="assistant"','id="student360Assistant"','async function docsAssistRender(key)','docsAssistRender(key).catch']){
   assert.equal(page.split(marker).length-1,1,marker);
 }
 assert.match(page,/\['basics','care','followup','documents','assistant'\]/);
});
test('assistant reuses existing local followup and A4 review without modifying original student records',()=>{
 assert.match(page,/docsFollowupKey\('educational_assistant'/);
 assert.match(page,/docsOpenFollowup\(/);
 assert.match(page,/educational-assistant:v1:/);
 assert.match(page,/status:'draft',hijriDate:hijriToday\(\)/);
});
test('followup prefills reviewed intervention fields and remains in followup tab',()=>{
 assert.match(page,/suggestedGoal:row.goal/);
 assert.match(page,/suggestedAction:item.steps.join/);
 assert.match(page,/source.suggestedGoal/);
 assert.match(page,/root.dataset.s360section='followup'/);
 assert.match(page,/docsStudentGradeResultsLink/);
});
test('all inline scripts parse and generated worker matches the sources',()=>{
 for(const [index,match] of [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries()){
  new Script(match[1],{filename:'embedded-'+(index+1)+'.js'});
 }
 // The canonical builder injects the fieldwork bundle before comparing the complete generated worker.
 assert.doesNotThrow(()=>execFileSync(process.execPath,['scripts/build-worker.mjs','--check'],{cwd:root,stdio:'pipe'}));
});
