// Browser-based integration test. Fake account identities and synthetic documents only.
// No production credentials or real student data.
import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {chromium} from "playwright-core";
import worker from "../worker.js";

const mockId="usr_aaaaaaaaaaaaaaaaaaaa";
const mockUser={id:mockId,name:"موجّه اختبار",loginIdentifier:"test@example.invalid"};
const avatarPng="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlCl1cAAAAASUVORK5CYII=";
const fakeDocument=(id,title)=>({id,title,kind:"التقارير الإرشادية",group:"سجل التقارير الإرشادية في نور",fields:{"الأعمال المنفذة":"اختبار بلا بيانات حقيقية"},body:"نموذج اختبار فقط",photos:[avatarPng],status:"مسودة",created:new Date().toISOString(),updated:new Date().toISOString()});

function server(){
  const requests=[];
  const http=createServer(async(req,res)=>{
    const url=new URL(req.url,"http://localhost");
    requests.push(url.pathname);
    if(url.pathname==="/api/auth/me"){
      res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
      res.end(JSON.stringify({ok:true,user:mockUser}));return;
    }
    const response=await worker.fetch(new Request("https://docs.athat.app"+url.pathname),{});
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  return {http,requests};
}
const seed=async(page,doc)=>{
  await page.evaluate(async({userId,doc})=>{
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open("athat-docs-unified-v2-"+userId,1);
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    await new Promise((resolve,reject)=>{
      const tx=db.transaction("documents","readwrite");
      tx.objectStore("documents").put(doc);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
    db.close();
  },{userId:mockId,doc});
};
const getDocs=async page=>page.evaluate(async(userId)=>{
  const db=await new Promise((resolve,reject)=>{
    const r=indexedDB.open("athat-docs-unified-v2-"+userId);
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const all=await new Promise((resolve,reject)=>{
    const r=db.transaction("documents","readonly").objectStore("documents").getAll();
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  db.close();return all;
},mockId);

test("WebRTC transfers documents with photos between two independent accounts' local browser stores", {timeout:90000},async()=>{
  const {http,requests}=server();
  await new Promise(resolve=>http.listen(0,"127.0.0.1",resolve));
  const port=http.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage"]});
    const ctxA=await browser.newContext({permissions:["clipboard-read","clipboard-write"]});
    const ctxB=await browser.newContext({permissions:["clipboard-read","clipboard-write"]});
    const a=await ctxA.newPage(),b=await ctxB.newPage();
    const errors=[];
    a.on("pageerror",e=>errors.push("A:"+e.message));
    b.on("pageerror",e=>errors.push("B:"+e.message));
    for(const page of [a,b]){
      // Use host-only ICE in CI. The application still uses STUN in production.
      await page.addInitScript(()=>{
        const Native=window.RTCPeerConnection;
        window.RTCPeerConnection=function(cfg){return new Native({...cfg,iceServers:[]});};
        window.RTCPeerConnection.prototype=Native.prototype;
      });
      page.on("dialog",async d=>{
        if(d.message().includes("إعادة تحميل الصفحة"))await d.dismiss();
        else await d.accept();
      });
      await page.goto("http://127.0.0.1:"+port,{waitUntil:"domcontentloaded"});
      await page.locator("#appMain").waitFor({state:"visible"});
      await page.locator("#athatPeerSync").waitFor({state:"visible"});
    }
    await seed(a,fakeDocument("a-1","مستند الجهاز الأول"));
    await seed(b,fakeDocument("b-1","مستند الجهاز الثاني"));
    await a.locator("#peerOffer").click();
    try{await a.waitForFunction(()=>document.querySelector("#peerOutgoing").value.length>50,null,{timeout:28000});}
    catch(err){throw Error("Offer failed: "+await a.locator("#peerStatus").textContent()+" / "+errors.join(" | ")+" / "+err.message)}
    const offer=await a.locator("#peerOutgoing").inputValue();
    await b.locator("#peerIncoming").fill(offer);
    await b.locator("#peerAnswer").click();
    try{await b.waitForFunction(()=>document.querySelector("#peerOutgoing").value.length>50,null,{timeout:28000});}
    catch(err){throw Error("Answer failed: "+await b.locator("#peerStatus").textContent()+" / "+errors.join(" | ")+" / "+err.message)}
    const answer=await b.locator("#peerOutgoing").inputValue();
    await a.locator("#peerIncoming").fill(answer);
    await a.locator("#peerFinish").click();
    await a.waitForFunction(()=>document.querySelector("#peerFingerprint").textContent.includes("مطابقة"),{timeout:30000});
    await b.waitForFunction(()=>document.querySelector("#peerFingerprint").textContent.includes("مطابقة"),{timeout:30000});
    const codeA=await a.locator("#peerFingerprint").textContent();
    const codeB=await b.locator("#peerFingerprint").textContent();
    assert.equal(codeA,codeB,"fingerprint confirmation codes must match");
    await a.locator("#peerVerify").click();
    await b.locator("#peerVerify").click();
    await a.waitForFunction(async()=> (await new Promise(resolve=>{
      const r=indexedDB.open("athat-docs-unified-v2-"+ "usr_aaaaaaaaaaaaaaaaaaaa");
      r.onsuccess=()=>{const d=r.result;const q=d.transaction("documents").objectStore("documents").getAll();q.onsuccess=()=>{d.close();resolve(q.result.length>=2)}};
    })),{timeout:30000});
    await b.waitForFunction(async()=> (await new Promise(resolve=>{
      const r=indexedDB.open("athat-docs-unified-v2-"+ "usr_aaaaaaaaaaaaaaaaaaaa");
      r.onsuccess=()=>{const d=r.result;const q=d.transaction("documents").objectStore("documents").getAll();q.onsuccess=()=>{d.close();resolve(q.result.length>=2)}};
    })),{timeout:30000});
    const docsA=await getDocs(a),docsB=await getDocs(b);
    for(const docSet of [docsA,docsB]){
      assert.equal(docSet.length,2);
      assert.equal(docSet.find(x=>x.id==="a-1")?.photos[0],avatarPng);
      assert.equal(docSet.find(x=>x.id==="b-1")?.photos[0],avatarPng);
    }
    assert.deepEqual(errors,[]);
    assert.equal(requests.filter(p=>p==="/api/auth/me").length<=6,true,"authentication must not be polled every 3 seconds");
    assert.equal(requests.some(p=>/upload|documents/.test(p)),false);
    await ctxA.close();await ctxB.close();
  }finally{if(browser)await browser.close();await new Promise(resolve=>http.close(resolve))}
});
