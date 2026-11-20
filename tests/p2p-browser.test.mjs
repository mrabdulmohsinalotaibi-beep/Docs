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
  const requests=[],active=new Map(),mailbox=new Map();
  const http=createServer(async(req,res)=>{
    const url=new URL(req.url,"http://localhost");
    requests.push(url.pathname);
    if(url.pathname==="/api/device-sync"){
      const chunks=[];for await(const part of req)chunks.push(part);
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{data={};}
      if(!/^dev_[a-f0-9]{32}$/.test(data.device)){res.writeHead(400);res.end(JSON.stringify({ok:false}));return;}
      if(data.heartbeat||data.action==="signal")active.set(data.device,Date.now());
      const peers=[...active].filter(([id,ts])=>id!==data.device&&Date.now()-ts<300000).map(([id])=>({id}));
      if(data.action==="signal"){
        const pending=mailbox.get(data.to)||[];
        pending.push({id:data.id,from:data.device,type:data.type,sdp:data.sdp});
        mailbox.set(data.to,pending);
        res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({ok:true}));return;
      }
      if(data.action==="poll"){
        const messages=mailbox.get(data.device)||[];mailbox.delete(data.device);
        res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({ok:true,peers,messages}));return;
      }
      res.writeHead(400);res.end(JSON.stringify({ok:false}));return;
    }
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
      const r=indexedDB.open("athat-docs-unified-v2-"+userId);
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
      try{await page.locator("#appMain").waitFor({state:"visible",timeout:10000});}
      catch(err){throw Error("App startup failed: errors="+errors.join(" | ")+" authStatus="+await page.locator("#authMsg").textContent().catch(()=>"?")+" peerStatus="+await page.locator("#peerStatus").textContent().catch(()=>"?")+" / "+err.message);}
      // Peer sync is now intentionally located in the Settings workspace.
      await page.locator('#workspaceSettingsLink').click();
      await page.locator('#dsPairOpen').click();
      try{await page.locator("#athatPeerSync").waitFor({state:"visible",timeout:10000});}
      catch(error){
        const info=await page.evaluate(()=>{
          const el=document.querySelector("#athatPeerSync"),items=[];let curr=el;
          while(curr&&items.length<8){items.push({id:curr.id,hidden:curr.hidden,display:getComputedStyle(curr).display});curr=curr.parentElement;}
          return {ancestors:items,settingsVisible:!!document.querySelector("#workspace-settings")?.getClientRects().length,appHidden:document.querySelector("#appMain")?.hidden};
        });
        throw Error("Peer settings panel hidden: "+JSON.stringify(info)+" / "+error.message);
      }
    }
    await seed(a,fakeDocument("a-1","مستند الجهاز الأول"));
    await seed(b,fakeDocument("b-1","مستند الجهاز الثاني"));
    // The app can complete its async login initialization after the first navigation.
    // Open Settings once all test data is seeded, so sync controls are actually on screen.
    await a.locator('#workspaceSettingsLink').click();
    await b.locator('#workspaceSettingsLink').click();
    await a.locator('#workspace-settings').waitFor({state:'visible'});
    await b.locator('#workspace-settings').waitFor({state:'visible'});
    await a.locator('#peerOffer').click();
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
    // Poll both IndexedDB stores from the test process: avoids checking stale
    // page-render state while the two incoming transactions commit.
    let docsA=[],docsB=[];
    const deadline=Date.now()+30000;
    do{
      docsA=await getDocs(a);docsB=await getDocs(b);
      if(docsA.length>=2 && docsB.length>=2)break;
      await new Promise(resolve=>setTimeout(resolve,300));
    }while(Date.now()<deadline);
    if(docsA.length<2||docsB.length<2){
      throw Error("Incomplete transfer: A="+docsA.map(x=>x.id)+" B="+docsB.map(x=>x.id)+
        " status A="+await a.locator("#peerStatus").textContent()+
        " status B="+await b.locator("#peerStatus").textContent()+
        " errors="+errors.join(" | "));
    }
    for(const docSet of [docsA,docsB]){
      assert.equal(docSet.length,2);
      assert.equal(docSet.find(x=>x.id==="a-1")?.photos[0],avatarPng);
      assert.equal(docSet.find(x=>x.id==="b-1")?.photos[0],avatarPng);
    }
    assert.deepEqual(errors,[]);
    // Intentional verification when pairing/sending is allowed; idle session must not poll.
    const beforeIdle=requests.filter(p=>p==="/api/auth/me").length;
    await new Promise(resolve=>setTimeout(resolve,4200));
    const afterIdle=requests.filter(p=>p==="/api/auth/me").length;
    assert.equal(afterIdle,beforeIdle,"session must not poll authentication in the background");
    assert.equal(requests.some(p=>/upload|documents/.test(p)),false);
    await ctxA.close();await ctxB.close();
  }finally{if(browser)await browser.close();await new Promise(resolve=>http.close(resolve))}
});

test("signed-in devices exchange local sample documents automatically without pairing clicks",{timeout:105000},async()=>{
 const {http}=server();
 await new Promise(resolve=>http.listen(0,"127.0.0.1",resolve));
 const port=http.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage"]});
  const a=await browser.newPage(), b=await browser.newPage();
  for(const page of [a,b]){
   await page.addInitScript(()=>{
    const Native=window.RTCPeerConnection;
    window.RTCPeerConnection=function(cfg){return new Native({...cfg,iceServers:[]})};
    window.RTCPeerConnection.prototype=Native.prototype;
   });
  }
  await a.goto("http://127.0.0.1:"+port,{waitUntil:"domcontentloaded"});
  await a.locator("#appMain").waitFor({state:"visible",timeout:12000});
  await seed(a,fakeDocument("auto-a-1","وثيقة تجريبية - جهاز أ"));
  await b.goto("http://127.0.0.1:"+port,{waitUntil:"domcontentloaded"});
  await b.locator("#appMain").waitFor({state:"visible",timeout:12000});
  await seed(b,fakeDocument("auto-b-1","وثيقة تجريبية - جهاز ب"));
  let docsA=[],docsB=[];
  const deadline=Date.now()+75000;
  do{
   docsA=await getDocs(a);docsB=await getDocs(b);
   if(docsA.some(x=>x.id==="auto-b-1")&&docsB.some(x=>x.id==="auto-a-1"))break;
   await new Promise(resolve=>setTimeout(resolve,1000));
  }while(Date.now()<deadline);
  assert.ok(docsA.some(x=>x.id==="auto-b-1"),"first device should receive second device document");
  assert.ok(docsB.some(x=>x.id==="auto-a-1"),"second device should receive first device document");
  await a.close();await b.close();
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>http.close(resolve));
 }
});
