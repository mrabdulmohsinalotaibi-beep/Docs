import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const root=new URL('../',import.meta.url);
const page=await readFile(new URL('src/page.html',root),'utf8');
const runtime=await readFile(new URL('src/worker-runtime.js',root),'utf8');
const worker=await readFile(new URL('worker.js',root),'utf8');

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
test('all inline scripts parse and generated worker matches the sources',()=>{
 for(const [index,match] of [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries()){
  new Script(match[1],{filename:'embedded-'+(index+1)+'.js'});
 }
 assert.equal(worker,'const PAGE='+JSON.stringify(page)+';\n'+runtime);
});
