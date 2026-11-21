import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const src=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const page=JSON.parse(src.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);

test('all inline scripts parse',()=>{
 for(const [,js] of page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<[/]script>/g))assert.doesNotThrow(()=>new Script(js));
});
test('archive audit provides a direct peer recovery shortcut',()=>{
 assert.match(page,/id="docsRestoreFromPeer"/);
 assert.match(page,/\$\('docsRestoreFromPeer'\)\.onclick=/);
 assert.match(page,/\$\('workspaceSettingsLink'\)/);
 assert.match(page,/\$\('dsPairOpen'\)/);
 assert.match(page,/peerRecover/);
});
test('peer recovery previews missing ids and writes add-only after two confirmations',()=>{
 assert.match(src,/recovery-list-request/);
 assert.match(src,/recovery-data-request/);
 assert.match(src,/recoverySaveMissing/);
 assert.match(src,/objectStore\(group.name\)\.add\(row\)/);
 assert.match(src,/الجهاز الآخر يطلب/);
 assert.match(src,/تأكيد حفظ/);
});
