import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const page=JSON.parse(source.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);
const peer=JSON.parse(source.match(/const PEER_SYNC=("(?:\\.|[^"\\])*");/)[1]);

test('main and peer scripts parse',()=>{
 for(const [,code] of page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<[/]script>/g))assert.doesNotThrow(()=>new Script(code));
 assert.doesNotThrow(()=>new Script(peer));
});
test('backup recovery announces only successful committed writes for current account',()=>{
 assert.match(page,/docsRestoreReportShow\(\{owner:activeUser/);
 assert.match(page,/new CustomEvent\('athat-docs-data-restored',\{detail:\{userId:activeUser,source:'daily-backup',restored\}\}\)/);
});
test('peer restore and sync notify host only after their add-only import succeeds',()=>{
 const recovery=peer.indexOf('const total=result.restored+files.added+responses.added;');
 const event=peer.indexOf('source:"peer-recovery"');
 assert.ok(event>recovery);
 assert.match(peer,/source:"peer-sync"/);
 assert.match(peer,/recoverySaveMissing/);
});
test('account-scoped refresh recomputes home, archive, portfolio and reports',()=>{
 const start=page.indexOf('async function docsRefreshAfterRecovery(){');
 const end=page.indexOf("document.addEventListener('athat-docs-login'",start);
 assert.ok(start>=0&&end>start);
 const body=page.slice(start,end);
 for(const fn of ['refresh()','loadMigratedA4()','loadGuidanceRecords()','refreshModernHome()','draw()','refreshReportSummary()','auditRender()'])assert.ok(body.includes(fn),fn);
 assert.match(body,/event\.detail\?\.userId!==activeUser/);
 assert.match(body,/if\(owner!==activeUser\)break/);
 assert.doesNotMatch(body,/\.delete\(|\.clear\(|store\.put\(/);
});
