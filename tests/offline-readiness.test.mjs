import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/if\(path==="\/sw\.js"\)return new Response\(("(?:\\.|[^"\\])*"),\{headers:/);
assert.ok(match,'Embedded Service Worker source exists');
const sw=JSON.parse(match[1]);
const page=JSON.parse(worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);
test('offline shell installs only when all executable assets are cached',()=>{
 assert.match(sw,/const CACHE_NAME='athat-docs-shell-v26';/);
 assert.doesNotMatch(sw,/const CACHE_NAME='athat-docs-shell-v24';/);
 assert.match(sw,/OFFLINE_CORE_MISSING/);
 assert.match(sw,/Promise\.all\(\['\/', '\/peer-sync\.js', '\/auto-sync\.js'\]/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.doesNotThrow(()=>new Script(sw));
});
test('offline setup requires authenticated password and same verified account',()=>{
 assert.match(worker,/path==="\/api\/auth\/verify-device-password"/);
 assert.match(worker,/docsVerifyDestructivePassword\(request,env,"device"\)/);
 assert.match(worker,/purpose==="device"&&docsEmail\(data\.email\)!==docsEmail\(user\.loginIdentifier\)/);
 assert.match(worker,/device-unlock-verify:/);
 assert.match(page,/docsOfflineAccessCard/);
 assert.match(page,/docsAuth\('verify-device-password',\{password,email\}\)/);
 assert.match(page,/docsOfflineShellReady/);
});
test('home counts persisted original and local derived record only once',()=>{
 assert.match(page,/unique\.add\('a4:'\+String\(document\.sourceA4\)\)/);
 assert.match(page,/unique\.add\('a4:'\+id\)/);
 assert.doesNotMatch(page,/docs\.length\+keys\.size/);
});
