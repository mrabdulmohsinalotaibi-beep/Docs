import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const text=fs.readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const auto=text.match(/const AUTO_SYNC=("(?:\\.|[^"\\])*");/);
test('automatic sync script can be parsed',()=>{
 assert.ok(auto,'auto-sync script exists');
 assert.doesNotThrow(()=>new vm.Script(JSON.parse(auto[1])));
});
test('device signaling requires an authenticated Docs session and same-origin request',()=>{
 assert.match(text,/async function docsAutoSyncApi\(request,env\)/);
 assert.match(text,/const user=await docsIdent\(request,env\)/);
 assert.match(text,/origin!==new URL\(request.url\).origin/);
 assert.match(text,/if\(!user\)return json\(\{ok:false,code:'UNAUTHORIZED'\},401\)/);
});
test('signaling only sends SDP, not documents to server KV',()=>{
 assert.match(text,/await env.DOCS_AUTH_KV.put\(base\+'signal:'\+to/);
 const script=JSON.parse(auto[1]);
 assert.match(script,/new RTCPeerConnection/);
 assert.match(script,/channel.send\(JSON.stringify\(\{type:'chunk'/);
 assert.doesNotMatch(script,/fetch\(['"]\/api\/upload/);
});
test('conflicting documents use stable id rather than replacing existing file',()=>{
 const script=JSON.parse(auto[1]);
 assert.match(script,/const conflictId='sync-'/);
 assert.match(script,/else if\(JSON.stringify\(query.result\)!==JSON.stringify\(doc\)/);
});
