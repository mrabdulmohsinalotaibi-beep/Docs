import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';
import {inflateSync} from 'node:zlib';
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/if\(path==="\/sw\.js"\)return new Response\(("(?:\\.|[^"\\])*"),\{headers:/);
assert.ok(match,'Embedded Service Worker source exists');
const sw=JSON.parse(match[1]);
const page=JSON.parse(worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);
test('offline shell installs only when all executable assets are cached',()=>{
 assert.match(sw,/const CACHE_NAME='athat-docs-shell-v37';/);
 assert.doesNotMatch(sw,/const CACHE_NAME='athat-docs-shell-v35';/);
 for(const asset of ['/brand.svg?v=19','/app-icon.svg?v=19','/pwa-icon-192.png?v=19','/pwa-icon-512.png?v=19','/icon.png?v=19']) assert.ok(sw.includes(asset), 'Offline brand asset missing: '+asset);
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

test('PWA manifest and service worker are permitted by restrictive application CSP',async()=>{const {default:app}=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));const base='https://docs.athat.app';const home=await app.fetch(new Request(base+'/'),{});assert.equal(home.status,200);const csp=home.headers.get('content-security-policy');assert.match(csp,/default-src 'none'/);assert.match(csp,/manifest-src 'self'/);assert.match(csp,/worker-src 'self'/);const manifest=await app.fetch(new Request(base+'/manifest.webmanifest?v=19'),{});assert.equal(manifest.status,200);assert.match(manifest.headers.get('content-type'),/application\/manifest\+json/);const data=await manifest.json();assert.equal(data.theme_color,'#484443');assert.equal(data.id,'/');assert.equal(data.start_url,'/');assert.equal(data.display,'standalone');for(const size of [192,512]){const icon=data.icons.find(i=>i.sizes===size+'x'+size);assert.ok(icon);const response=await app.fetch(new Request(base+icon.src),{});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');const png=Buffer.from(await response.arrayBuffer());assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}});

test('legacy manifest URLs serve the same updated metadata and maskable icons keep all artwork safe',async()=>{
 const {default:app}=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));
 const base='https://docs.athat.app';
 const current=await (await app.fetch(new Request(base+'/manifest.webmanifest'),{})).json();
 for(const suffix of ['?v=14','?v=17','?v=18','?v=19'])assert.deepEqual(await (await app.fetch(new Request(base+'/manifest.webmanifest'+suffix),{})).json(),current);
 assert.match(sw,/const installAsset=/);
 assert.match(sw,/fetch\(request,\{cache:'no-store'\}\)/);
 assert.match(page,/href="\/manifest\.webmanifest"/);
 for(const size of [192,512]){
  const icon=current.icons.find(i=>i.sizes===size+'x'+size&&i.purpose==='maskable');
  assert.ok(icon);
  const response=await app.fetch(new Request(base+icon.src),{});
  assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/no-cache/);
  const png=Buffer.from(await response.arrayBuffer());
  assert.equal(png.readUInt32BE(16),size);
  assert.equal(png.readUInt32BE(20),size);
  const chunks=[];for(let p=8;p<png.length;){const n=png.readUInt32BE(p);if(png.toString('ascii',p+4,p+8)==='IDAT')chunks.push(png.subarray(p+8,p+8+n));p+=12+n}
  const pixels=inflateSync(Buffer.concat(chunks));let artwork=0;
  for(let y=0;y<size;y++){const row=y*(size*4+1);assert.equal(pixels[row],0);for(let x=0;x<size;x++){const p=row+1+x*4;assert.equal(pixels[p+3],255);if(pixels[p]!==255||pixels[p+1]!==255||pixels[p+2]!==255){artwork++;assert.ok(Math.hypot(x+.5-size/2,y+.5-size/2)<=size*.4,'artwork outside Android safe zone')}}}
  assert.ok(artwork>size*size*.02);
 }
});

test('offline manifest is served from the local cache without attempting a network fetch',async()=>{
 const handlers={};let network=0;
 const manifest=new Response(JSON.stringify({name:'Fixture'}),{headers:{'content-type':'application/manifest+json'}});
 const cache={match:async key=>key==='/manifest.webmanifest'?manifest.clone():undefined};
 runInNewContext(sw,{URL,Response,self:{location:{origin:'https://docs.athat.app'},navigator:{onLine:false},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>cache},fetch:async()=>{network++;throw Error('offline')}});
 let response;handlers.fetch({request:new Request('https://docs.athat.app/manifest.webmanifest?v=19'),respondWith:promise=>response=promise});
 assert.equal((await response).status,200);assert.equal(network,0);assert.equal((await (await response).json()).name,'Fixture');
});
