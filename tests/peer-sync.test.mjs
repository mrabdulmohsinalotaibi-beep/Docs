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

test('blocks transfer until users verify matching WebRTC fingerprints',()=>{
 assert.match(peer,/async function pairingCode\(\)/);
 assert.match(peer,/crypto\.subtle\.digest\("SHA-256"/);
 assert.match(peer,/if\(!paired \|\| !peerReady\)throw Error/);
 assert.match(peer,/if\(!paired \|\| !peerReady \|\| sending/);
 assert.match(peer,/el\("peerVerify"\)\.onclick/);
 assert.match(peer,/paired=true/);
});

test('auto-sync after both devices approve; idempotent conflict names',()=>{
 assert.match(peer,/async function autoSync\(\)/);
 assert.match(peer,/if\(paired && channel\?\.readyState/);
 assert.match(peer,/type:"ready"/);
 assert.match(peer,/const conflictId="sync-"/);
 assert.match(peer,/store\.get\(conflictId\)/);
});

test('worker embeds exactly the current peer-sync client',()=>{
 const match=worker.match(/const PEER_SYNC=(.+);\nconst UPSTREAM=/);
 assert.ok(match,'embedded client should exist');
 assert.equal(JSON.parse(match[1]),peer);
});
