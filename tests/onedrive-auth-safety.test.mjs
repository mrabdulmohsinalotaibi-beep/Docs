import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const page=await readFile(new URL('../src/page.html',import.meta.url),'utf8');
const runtime=await readFile(new URL('../src/worker-runtime.js',import.meta.url),'utf8');
const build=await readFile(new URL('../worker.js',import.meta.url),'utf8');

test('deployable worker is rebuilt from source',()=>{
  assert.equal(build,'const PAGE='+JSON.stringify(page)+';\n'+runtime);
});
test('all inline scripts parse',()=>{
  const scripts=[...page.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)];
  assert.ok(scripts.length>0);
  for(const [index,script] of scripts.entries())assert.doesNotThrow(()=>new Script(script[1],{filename:'inline-'+index+'.js'}));
});
test('OneDrive never claims backup succeeded just because a document was saved locally',()=>{
  assert.match(page,/id="docsOneDriveIndicator"/);
  assert.match(page,/docs:onedrive-status/);
  assert.match(page,/لا توجد نسخة احتياطية مؤكدة/);
  assert.match(page,/رموز|النسخ الاحتياطي|النسخ السحابي/);
});
test('OAuth uses PKCE/state, does not store tokens in localStorage, and uses personal app-folder scope',()=>{
  assert.match(page,/code_challenge_method:'S256'/);
  assert.match(page,/response_type:'code'/);
  assert.match(page,/state!==pending.state/);
  assert.match(page,/pending.account!==activeUser/);
  assert.match(page,/docsMsScope='Files.ReadWrite.AppFolder offline_access'/);
  assert.doesNotMatch(page,/localStorage\\.setItem\\([^\\n]*(?:access_token|refresh_token)/);
});
test('configuration is authenticated and only public client ID is exposed',()=>{
  assert.match(runtime,/path==="\\/api\\/onedrive\\/config"/);
  assert.match(runtime,/await docsIdent\\(request,env\\)/);
  assert.match(runtime,/DOCS_ONEDRIVE_CLIENT_ID/);
  assert.doesNotMatch(runtime,/DOCS_ONEDRIVE_CLIENT_SECRET/);
  assert.match(runtime,/connect-src 'self' https:\\/\\/login\\.microsoftonline\\.com https:\\/\\/graph\\.microsoft\\.com/);
});
