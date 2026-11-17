/* ATHAT Docs — optional, local-only WebRTC transfer. No document API or server persistence. */
(() => {
  "use strict";
  const STORAGE_PREFIX = "athat-docs-unified-v2-";
  const MAX_BYTES = 32 * 1024 * 1024;
  const CHUNK = 12 * 1024;
  let pc, channel, accountId = "", received = "", sending = false, paired = false, peerReady = false, autoSent = false;
  const ui = document.createElement("section");
  ui.id = "athatPeerSync";
  ui.dir = "rtl";
  ui.hidden = true;
  ui.style.cssText = "margin:15px 0;padding:17px;background:#fff;border:1px solid #d9cbb6;border-radius:15px;color:#503821;line-height:1.8";
  ui.innerHTML = '<h2 style="margin:0 0 8px">مزامنة أجهزتي مباشرة</h2>'+
    '<p style="margin:0 0 12px">تظل المستندات والشواهد على الأجهزة فقط. يلزم فتح الموقع على الجهازين، وتسجيل الدخول لنفس الحساب، وتبادل رموز الاتصال يدويًا. لن تُرفع مستنداتك إلى الخادم.</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="peerOffer">هذا الجهاز: إنشاء اتصال</button><button type="button" id="peerAnswer">الجهاز الآخر: قبول اتصال</button><button type="button" id="peerFinish">إتمام الاتصال</button><button type="button" id="peerVerify" disabled>تأكيد رمز المطابقة على الجهازين</button><button type="button" id="peerSend" disabled>إرسال مستنداتي للجهاز الآخر</button><button type="button" id="peerClose">قطع الاتصال</button></div>'+
    '<label style="display:block;margin-top:12px">رمز الاتصال الوارد من الجهاز الآخر<textarea id="peerIncoming" rows="4" style="display:block;width:100%;direction:ltr;text-align:left;border:1px solid #d9cbb6;border-radius:9px;padding:8px" placeholder="الصق رمز الاتصال هنا"></textarea></label>'+
    '<label style="display:block;margin-top:9px">رمز هذا الجهاز<textarea id="peerOutgoing" rows="4" readonly style="display:block;width:100%;direction:ltr;text-align:left;border:1px solid #d9cbb6;border-radius:9px;padding:8px"></textarea></label>'+
    '<button type="button" id="peerCopy">نسخ الرمز</button><p id="peerFingerprint" style="font-weight:bold"></p><p id="peerStatus" role="status" aria-live="polite" style="font-size:13px"></p>'+
    '<small>المزامنة تضيف المستندات الجديدة وتحفظ النسخ المتعارضة بدل استبدالها. لا تعمل إذا كان أحد الجهازين مغلقًا. بعض الشبكات تتطلب خادم TURN غير مهيأ حاليًا.</small>';
  const el = id => ui.querySelector("#" + id);
  const note = s => { el("peerStatus").textContent = s; };
  function reset() {
    if (channel) { try { channel.close(); } catch {} }
    if (pc) { try { pc.close(); } catch {} }
    pc = null; channel = null; received = ""; sending = false; paired = false; peerReady = false; autoSent = false;
    el("peerVerify").disabled = true;el("peerFingerprint").textContent="";
    el("peerSend").disabled = true;
  }
  async function identity() {
    const response = await fetch("/api/auth/me", {credentials:"same-origin",cache:"no-store"});
    if (!response.ok) throw Error("يجب تسجيل الدخول أولًا.");
    const data = await response.json();
    const id = data?.user?.id;
    if (typeof id !== "string" || !/^usr_[\w-]{10,}$/.test(id)) throw Error("تعذر التحقق من حسابك.");
    if (accountId && accountId !== id) reset();
    accountId = id;
    return id;
  }
  function dbFor(id) {
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(STORAGE_PREFIX + id,1);
      req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains("documents"))req.result.createObjectStore("documents",{keyPath:"id"}); };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function allDocs() {
    const id = await identity();
    const db = await dbFor(id);
    try { return await new Promise((resolve,reject)=>{
      const req=db.transaction("documents","readonly").objectStore("documents").getAll();
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    }); } finally { db.close(); }
  }
  async function addDocs(incoming) {
    const id = await identity();
    const db = await dbFor(id);
    let added=0,conflicts=0,unchanged=0;
    try {
      // Import-only; no deletions, and never overwrite differing documents.
      for (const doc of incoming) {
        if (!doc || typeof doc!=="object" || typeof doc.id!=="string" || doc.id.length>200 || !Array.isArray(doc.photos||[])) continue;
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(doc))));
        const checksum = Array.from(digest.slice(0,16), x=>x.toString(16).padStart(2,"0")).join("");
        const conflictId="sync-"+checksum;
        await new Promise((resolve,reject)=>{
          const tx=db.transaction("documents","readwrite"),store=tx.objectStore("documents");
          const req=store.get(doc.id);
          req.onsuccess=()=>{
            const existing=req.result;
            if (!existing) { store.put(doc); added++; }
            else if (JSON.stringify(existing)===JSON.stringify(doc)) unchanged++;
            else {
              // Stable hash-derived conflict ID makes repeated exchanges idempotent.
              const copyReq=store.get(conflictId);
              copyReq.onsuccess=()=>{
                if(!copyReq.result){
                  store.put({...doc,id:conflictId,title:String(doc.title||"مستند").slice(0,150)+" (نسخة مستلمة)"});
                  conflicts++;
                }else unchanged++;
              };
            }
          };
          tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
      }
      return {added,conflicts,unchanged};
    } finally { db.close(); }
  }
  const encode = text => btoa(String.fromCharCode(...new TextEncoder().encode(text))); // SDP short in modern browsers
  const decode = raw => new TextDecoder().decode(Uint8Array.from(atob(raw.trim()),c=>c.charCodeAt(0)));
  async function gather() {
    if (!pc) throw Error("لم يبدأ الاتصال.");
    if (pc.iceGatheringState!=="complete") await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{pc?.removeEventListener("icegatheringstatechange",done);reject(Error("تعذّر تجهيز الاتصال."));},20000);
      function done(){if(pc?.iceGatheringState==="complete"){clearTimeout(timeout);pc.removeEventListener("icegatheringstatechange",done);resolve();}}
      pc.addEventListener("icegatheringstatechange",done);
    });
    el("peerOutgoing").value=encode(JSON.stringify(pc.localDescription));
    note("انسخ الرمز وأرسله إلى جهازك الآخر بشكل خاص. لا تشاركه علنًا.");
  }
  async function pairingCode() {
    if(!pc?.localDescription || !pc?.remoteDescription)throw Error("أكمل تبادل رموز الاتصال أولًا.");
    const regex=/a=fingerprint:sha-256\s+([0-9A-F:]+)/i;
    const local=pc.localDescription.sdp.match(regex)?.[1]?.toUpperCase();
    const remote=pc.remoteDescription.sdp.match(regex)?.[1]?.toUpperCase();
    if(!local || !remote || local===remote)throw Error("تعذر التحقق من هوية اتصال WebRTC.");
    const material=[local,remote].sort().join("|");
    const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(material)));
    const value=((hash[0]<<16)|(hash[1]<<8)|hash[2])%1000000;
    return String(value).padStart(6,"0");
  }
  async function showPairing() {
    const code=await pairingCode();
    el("peerFingerprint").textContent="رمز مطابقة الاتصال: "+code+" — تأكد أنه نفسه على الجهازين.";
    el("peerVerify").disabled=false;
    el("peerSend").disabled=true;
    note("تأكد من تطابق الرمز على الجهازين قبل السماح بإرسال المستندات.");
  }
  function start() {
    reset();
    pc = new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
    pc.onconnectionstatechange=()=>{
      if(pc?.connectionState==="failed") note("فشل الاتصال المباشر؛ قد تتطلب الشبكة خادم TURN.");
      else if(pc?.connectionState==="connected") showPairing().catch(e=>note(e.message));
      else if(pc?.connectionState==="disconnected") note("انقطع الاتصال بالجهاز الآخر.");
    };
    pc.ondatachannel=event=>configure(event.channel);
  }
  async function sendReady(){
    if(paired && channel?.readyState==="open"){
      channel.send(JSON.stringify({type:"ready",user:accountId}));
      if(peerReady && !autoSent)await autoSync();
    }
  }
  async function autoSync(){
    if(autoSent)return;
    autoSent=true;
    try{await send(true);}catch(e){autoSent=false;note("المزامنة التلقائية لم تكتمل: "+e.message);}
  }
  function configure(c) {
    channel=c;c.binaryType="arraybuffer";
    c.onopen=()=>{showPairing().then(sendReady).catch(e=>note(e.message));};
    c.onclose=()=>{el("peerSend").disabled=true;note("أُغلق الاتصال.");};
    c.onmessage=async event=>{
      try{
        const msg=JSON.parse(event.data);
        if(msg.type==="ready"){
          if(msg.user!==accountId)throw Error("الحساب مختلف.");
          peerReady=true;
          if(paired && !autoSent)await autoSync();
          return;
        }
        if(!paired || !peerReady)throw Error("يجب تأكيد رمز المطابقة على الجهازين قبل نقل المستندات.");
        if (msg.type==="begin") {
          if (!Number.isSafeInteger(msg.length)||msg.length<0||msg.length>MAX_BYTES){received="";throw Error("حجم النقل يتجاوز الحد الآمن.");}
          if (msg.user!==accountId) {reset();throw Error("الحساب على الجهاز الآخر مختلف.");}
          received="";note("جارٍ استقبال المستندات المشفرة عبر WebRTC...");
        } else if (msg.type==="chunk") {
          if(typeof msg.data!=="string" || received.length+msg.data.length>MAX_BYTES){received="";throw Error("تجاوز النقل الحجم المسموح.");}
          received+=msg.data;
        } else if (msg.type==="end") {
          if(received.length!==msg.length)throw Error("النقل غير مكتمل.");
          const docs=JSON.parse(received);received="";
          if(!Array.isArray(docs)||docs.length>3000)throw Error("بيانات النقل غير صالحة.");
          if(!confirm("وصل "+docs.length+" مستندًا مع المرفقات. هل توافق على إضافتها إلى الأرشيف المحلي لهذا الحساب؟")){note("تم رفض الاستيراد. لم تُحفظ البيانات.");return;}
          const result=await addDocs(docs);
          note("اكتملت المزامنة: "+result.added+" جديد، "+result.conflicts+" نسخة تعارض، "+result.unchanged+" موجود.");
          // Existing app owns its IndexedDB connection; reload to refresh its list.
          if(confirm("اكتمل الاستيراد. هل تريد إعادة تحميل الصفحة لعرض المستندات؟")) location.reload();
        }
      }catch(err){note("تعذّر الاستقبال: "+err.message);}
    };
  }
  async function send(automatic=false) {
    if(!paired || !peerReady || sending || !channel || channel.readyState!=="open")throw Error("أكّد رمز المطابقة على الجهازين أولًا.");
    sending=true;el("peerSend").disabled=true;
    try{
      const docs=await allDocs();
      const payload=JSON.stringify(docs);
      if(payload.length>MAX_BYTES)throw Error("حجم المستندات يتجاوز 32 ميجابايت في عملية واحدة؛ استخدم نسخة JSON يدوية.");
      if(!automatic && !confirm("سيتم إرسال "+docs.length+" مستندًا وشواهدها إلى جهازك الآخر. متابعة؟"))return;
      channel.send(JSON.stringify({type:"begin",user:accountId,length:payload.length}));
      for(let i=0;i<payload.length;i+=CHUNK){
        if(channel.readyState!=="open")throw Error("انقطع الاتصال.");
        while(channel.bufferedAmount>512*1024)await new Promise(r=>setTimeout(r,50));
        channel.send(JSON.stringify({type:"chunk",data:payload.slice(i,i+CHUNK)}));
      }
      channel.send(JSON.stringify({type:"end",length:payload.length}));
      note("تم إرسال المستندات. وافق على الحفظ من الجهاز الآخر.");
    }finally{sending=false;el("peerSend").disabled=channel?.readyState!=="open";}
  }
  function job(fn){return async()=>{try{await fn();}catch(err){note(err.message||"تعذّر إتمام العملية.");}};}
  el("peerOffer").onclick=job(async()=>{
    await identity();start();configure(pc.createDataChannel("athat-docs",{ordered:true}));
    await pc.setLocalDescription(await pc.createOffer());await gather();
  });
  el("peerAnswer").onclick=job(async()=>{
    await identity();const remote=JSON.parse(decode(el("peerIncoming").value));
    if(remote.type!=="offer")throw Error("ألصق رمز طلب اتصال صحيحًا.");
    start();await pc.setRemoteDescription(remote);await pc.setLocalDescription(await pc.createAnswer());await gather();
  });
  el("peerFinish").onclick=job(async()=>{
    await identity();if(!pc||pc.signalingState!=="have-local-offer")throw Error("ابدأ بإنشاء الاتصال على هذا الجهاز.");
    const remote=JSON.parse(decode(el("peerIncoming").value));
    if(remote.type!=="answer")throw Error("ألصق رمز الاستجابة من الجهاز الآخر.");
    await pc.setRemoteDescription(remote);note("جارٍ تأسيس القناة المباشرة...");
  });
  el("peerVerify").onclick=job(async()=>{
    const code=await pairingCode();
    if(!confirm("هل ظهر الرمز "+code+" نفسه على شاشة جهازك الآخر؟ لا توافق إذا اختلف الرقمان."))return;
    paired=true;el("peerVerify").disabled=true;
    el("peerSend").disabled=channel?.readyState!=="open";
    note("تم اعتماد مطابقة الاتصال. ستبدأ المزامنة عندما يؤكد الجهاز الآخر الرمز نفسه.");
    await sendReady();
  });
  el("peerSend").onclick=job(send);
  el("peerClose").onclick=()=>{reset();note("تم قطع الاتصال.");};
  el("peerCopy").onclick=job(async()=>{await navigator.clipboard.writeText(el("peerOutgoing").value);note("نُسخ الرمز. انقله إلى جهازك الآخر بطريقة خاصة.");});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&channel?.readyState==="open")note("أبقِ التطبيقين مفتوحين أثناء النقل.");});
  window.addEventListener("pagehide",reset);
  function attach(){
    const main=document.getElementById("appMain");
    if(!main)return;
    const hero=main.querySelector(".hero");
    const settingsSlot=document.getElementById("settingsPeerSlot"); if(settingsSlot) settingsSlot.appendChild(ui); else main.appendChild(ui);
    // The main app emits these events on login and logout: no 3-second auth polling.
    // This avoids 28,800 redundant requests per day per open browser tab.
    document.addEventListener("athat-docs-login",event=>{
      const nextId=String(event.detail?.userId||"");
      if(!/^usr_[\w-]{10,}$/.test(nextId)){reset();ui.hidden=true;return;}
      if(accountId && nextId!==accountId)reset();
      accountId=nextId;ui.hidden=false;
    });
    document.addEventListener("athat-docs-logout",()=>{reset();accountId="";ui.hidden=true;});
    if(!main.hidden)identity().then(()=>{ui.hidden=false;}).catch(()=>{reset();ui.hidden=true;});

  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",attach);else attach();
})();