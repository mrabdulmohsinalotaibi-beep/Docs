import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const peer=readFileSync(new URL('../peer-sync.js',import.meta.url),'utf8');
test('serves peer client from same origin without exporting docs',()=>{
 assert.match(worker,/path==="\/peer-sync\.js"/);
 assert.match(worker,/script-src 'self'/);
 assert.match(worker,/PEER_SYNC/);
});
test('keeps documents local, transfers via data channel only',()=>{
 assert.match(peer,/RTCPeerConnection/);
 assert.match(peer,/indexedDB\.open/);
 assert.match(peer,/channel\.send/);
 assert.doesNotMatch(peer,/\/api\/sync|\/api\/documents|fetch\(["']https:/);
});
test('explicit user approval and conflict-safe import',()=>{
 assert.match(peer,/confirm\("سيتم إرسال/);
 assert.match(peer,/confirm\("وصل /);
 assert.match(peer,/\(نسخة مستلمة\)/);
 assert.match(peer,/if \(!existing\)/);
 assert.match(peer,/if \(msg\.user!==accountId\)/);
});
