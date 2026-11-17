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
 const mount=appScript.indexOf('workspacePages.home.append(originalHero,originalMetrics,originalTemplates,originalWorks,originalEditor)');
 const attachHome=appScript.indexOf('docsMain.prepend(workspacePages.home)',mount);
 const programHandler=appScript.indexOf("$('editorPrograms').onclick=",attachHome);
 assert.ok(mount>=0,'Mount editor with home workspace');
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
