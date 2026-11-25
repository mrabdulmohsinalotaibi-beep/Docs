import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {runInNewContext} from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const runtime=read('src/worker-runtime.js');
const block=runtime.split('/* DOCS_PUBLIC_SURVEYS_START */')[1].split('/* DOCS_PUBLIC_SURVEYS_END */')[0];
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(read('migrations/integrated-guidance-surveys.sql'));
 const db={prepare(query){return {bind(...args){const statement=sql.prepare(query);return {first:async()=>statement.get(...args),all:async()=>({results:statement.all(...args)}),run:async()=>({meta:{changes:Number(statement.run(...args).changes)}})}}}}};
 const endpoint=runInNewContext(block+'\ndocsSurveyEndpoint',{URL,Request,Response,Uint8Array,TextDecoder,crypto:webcrypto,docsIdent:async r=>r.headers.get('x-test-user')?{id:r.headers.get('x-test-user')}:null,docsSha:async v=>createHash('sha256').update(v).digest('hex'),json:(body,status=200)=>new Response(JSON.stringify(body),{status})});
 async function req(path,body,user=''){
  return endpoint(new Request('https://docs.example'+path,{method:body?'POST':'GET',headers:{origin:'https://docs.example','content-type':'application/json','x-test-user':user},...(body?{body:JSON.stringify(body)}:{})}),{DOCS_DB:db});
 }
 return {req,sql};
}
test('survey lifecycle protects ownership and requires consent, rejects duplicate browser claims',async()=>{
 const {req}=setup();
 const created=await req('/api/surveys',{action:'create',template:0,days:7,consent:true},'usr_a');
 assert.equal(created.status,201);const {id,token}=await created.json();
 assert.equal((await req('/api/surveys?id='+id,undefined,'usr_b')).status,404);
 const publicData=await (await req('/api/surveys/public?token='+token)).json();
 assert.equal(publicData.questions.length,5);assert.equal(Object.hasOwn(publicData,'owner_id'),false);
 const payload={token,browserToken:'a'.repeat(64),answers:[1,2,3,4,5],consent:false};
 assert.equal((await req('/api/surveys/public',payload)).status,400);
 payload.consent=true;
 assert.equal((await req('/api/surveys/public',payload)).status,201);
 assert.equal((await req('/api/surveys/public',payload)).status,409);
 const few=await (await req('/api/surveys?id='+id,undefined,'usr_a')).json();assert.equal(few.summary,null);
 for(const c of ['b','c','d','e'])assert.equal((await req('/api/surveys/public',{...payload,browserToken:c.repeat(64)})).status,201);
 const enough=await (await req('/api/surveys?id='+id,undefined,'usr_a')).json();assert.equal(enough.summary.count,5);
 assert.equal((await req('/api/surveys',{action:'close',id},'usr_b')).status,404);
 assert.equal((await req('/api/surveys',{action:'close',id},'usr_a')).status,200);
 assert.equal((await req('/api/surveys/public?token='+token)).status,404);
});
test('expired survey is unavailable',async()=>{
 const {req,sql}=setup();
 const {token}=await (await req('/api/surveys',{action:'create',template:0,days:1,consent:true},'usr_a')).json();
 sql.exec('UPDATE docs_guidance_surveys SET expires_at=0');
 assert.equal((await req('/api/surveys/public?token='+token)).status,404);
});
