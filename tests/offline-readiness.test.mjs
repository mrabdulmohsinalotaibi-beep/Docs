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
 assert.match(sw,/const CACHE_NAME='athat-docs-shell-v33';/);
 assert.doesNotMatch(sw,/const CACHE_NAME='athat-docs-shell-v32';/);
 for(const asset of ['/brand.svg?v=16','/app-icon.svg?v=16','/pwa-icon-192.png?v=16','/pwa-icon-512.png?v=16','/icon.png?v=16']) assert.ok(sw.includes(asset), 'Offline brand asset missing: '+asset);
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

test('explicit update link checks service worker without clearing local data or forcing reload',()=>{assert.match(page,/searchParams\.get\('update'\)==='1'/);assert.match(page,/await registration\.update\(\)/);assert.match(page,/addEventListener\('online',\(\)=>check\(true\)\)/);assert.match(page,/pending\.state==='activated'/);});

test('PWA manifest and service worker are permitted by restrictive application CSP',async()=>{const {default:app}=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));const base='https://docs.athat.app';const home=await app.fetch(new Request(base+'/'),{});assert.equal(home.status,200);const csp=home.headers.get('content-security-policy');assert.match(csp,/default-src 'none'/);assert.match(csp,/manifest-src 'self'/);assert.match(csp,/worker-src 'self'/);const manifest=await app.fetch(new Request(base+'/manifest.webmanifest?v=16'),{});assert.equal(manifest.status,200);assert.match(manifest.headers.get('content-type'),/application\/manifest\+json/);const data=await manifest.json();assert.equal(data.theme_color,'#484443');assert.equal(data.id,'/');assert.equal(data.start_url,'/');assert.equal(data.display,'standalone');for(const size of [192,512]){const icon=data.icons.find(i=>i.sizes===size+'x'+size);assert.ok(icon);const response=await app.fetch(new Request(base+icon.src),{});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');const png=Buffer.from(await response.arrayBuffer());assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}});
