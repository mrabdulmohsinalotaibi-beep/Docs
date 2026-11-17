import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {chromium} from "playwright-core";
import worker from "../worker.js";
const fakeUser={id:"usr_aaaaaaaaaaaaaaaaaaaa",name:"موجّه تجربة",loginIdentifier:"tester@example.invalid"};
test("regional plans and local import work in browser without network upload", {timeout:70000}, async()=>{
 const paths=[];
 const srv=createServer(async(req,res)=>{
  const url=new URL(req.url,"http://localhost");
  paths.push(url.pathname);
  if(url.pathname==="/api/auth/me"){
   res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
   res.end(JSON.stringify({ok:true,user:fakeUser}));return;
  }
  const response=await worker.fetch(new Request("https://docs.athat.app"+url.pathname),{});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 });
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage"]});
  const page=await browser.newPage();
  const errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  page.on("dialog",d=>d.accept());
  await page.goto("http://127.0.0.1:"+srv.address().port,{waitUntil:"domcontentloaded"});
  await page.locator("#appMain").waitFor({state:"visible"});
  const choices=await page.locator("#profileDepartment option").allTextContents();
  assert.ok(choices.includes("مكة المكرمة"));
  assert.ok(choices.includes("جازان"));
  assert.ok(choices.includes("ينبع"));
  // School identity now lives in Settings; program catalog lives in Programs workspace.
  await page.locator('#workspaceSettingsLink').click();
  await page.locator('#workspace-settings').waitFor({state:'visible'});
  await page.selectOption("#profileDepartment","مكة المكرمة");
  await page.selectOption("#profileStage","متوسط");
  await page.locator("#saveSchoolProfile").click();
  await page.locator('#workspaceNav button[data-workspace="home"]').click();
  await page.locator("#newBtn").click();
  await page.locator('#workspace-documents').waitFor({state:'visible'});
  await page.locator('#docsViewSelector button[data-view="templates"]').waitFor({state:'visible'});
  await page.locator('#docsViewSelector button[data-view="programs"]').click();
  await page.locator('#docsProgramBundle').waitFor({state:'visible'});
  await page.selectOption("#programScope","regional");
  await page.selectOption("#programWeek","3");
  const weekChoices=await page.locator("#programChoice option").allTextContents();
  assert.ok(weekChoices.some(x=>x.includes("تعزيز السلوك الإيجابي")));
  assert.ok(weekChoices.some(x=>x.includes("رعاية ودعم الحالات الخاصة")));
  await page.locator('#workspaceNav button[data-workspace="settings"]').click();
  await page.selectOption("#profileDepartment","نجران");
  await page.locator("#saveSchoolProfile").click();
  await page.locator('#workspaceNav button[data-workspace="home"]').click();
  await page.locator('#workspaceNav button[data-workspace="documents"]').click();
  await page.locator('#docsViewSelector button[data-view="programs"]').click();
  assert.equal(await page.locator("#programScope").inputValue(),"national");
  assert.match(await page.locator("#programSource").innerText(),/لا تتوفر خطة أسبوعية موثقة/);
  await page.selectOption("#programScope","local");
  await page.locator("#localPlanFile").setInputFiles({name:"test.csv",mimeType:"text/csv",buffer:Buffer.from("اسم البرنامج\nبرنامج تجريبي أول\nبرنامج تجريبي ثان")});
  assert.match(await page.locator("#localProgramText").inputValue(),/برنامج تجريبي أول/);
  await page.locator("#saveLocalPrograms").click();
  await page.waitForFunction(()=>document.querySelector("#localPlanNotice").textContent.includes("حُفظت"));
  const stored=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith("athat-docs-local-programs-")));
  assert.equal(stored.length,1);
  assert.ok(stored[0][1].includes("برنامج تجريبي ثان"));
  assert.ok(paths.every(x=>!x.includes("upload")&&!x.includes("/plans/")));
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(ok=>srv.close(ok))}
});
