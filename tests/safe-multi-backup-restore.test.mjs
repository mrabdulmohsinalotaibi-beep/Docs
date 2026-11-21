import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const page=JSON.parse(source.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);
const begin=page.indexOf('async function docsRestorePreviewRead(){');
const end=page.indexOf('function docsRestoreDiffDisplay(plan){',begin);
assert.ok(begin>=0&&end>begin,'restore preview function exists');
const functionSource=page.slice(begin,end);

async function preview({backups,documents=[],snapshots=[],responses=[],files=[],owner='account-one'}){
 const context={
  activeUser:owner,db:{},
  docsMirrorGetAll:async name=>name==='dailyBackups'?backups:name==='responses'?responses:files,
  all:async()=>documents,
  dsStoreItems:async()=>snapshots
 };
 vm.createContext(context);
 return vm.runInContext(functionSource+';docsRestorePreviewRead()',context);
}
const backup=(id,date,accountId,entries)=>({id,createdAt:date,payload:{accountId,documents:entries.documents||[],snapshots:entries.snapshots||[],responses:entries.responses||[],files:entries.files||[]}});

test('recovers a document from an older backup when absent from the newest',async()=>{
 const copies=[
  backup('older','2026-11-19','account-one',{documents:[{id:'lost',body:'older recovery'}]}),
  backup('newer','2026-11-20','account-one',{documents:[{id:'recent',body:'latest'}]})
 ];
 const plan=await preview({backups:copies});
 assert.equal(plan.backupCount,2);
 assert.deepEqual([...plan.doc.additions.map(x=>x.id)],['recent','lost']);
});

test('never proposes overwriting existing ids and ignores other accounts',async()=>{
 const copies=[
  backup('newer','2026-11-20','account-one',{documents:[{id:'existing',body:'different'},{id:'restore',body:'current'}]}),
  backup('older','2026-11-19','account-one',{documents:[{id:'restore',body:'stale'}]}),
  backup('foreign','2026-11-21','account-two',{documents:[{id:'foreign'}]})
 ];
 const plan=await preview({backups:copies,documents:[{id:'existing',body:'keep unchanged'}]});
 assert.deepEqual([...plan.doc.additions.map(x=>x.id)],['restore']);
 assert.deepEqual([...plan.doc.conflicts],['existing']);
 assert.equal(plan.backupCount,2);
 assert.equal(plan.doc.additions[0].body,'current');
});

test('malformed attachments cannot be offered for recovery',async()=>{
 const copies=[backup('one','2026-11-20','account-one',{files:[
  {id:'/api/evidence/1',blob:{__docsBlob:true,base64:'AQID',type:'image/png'}},
  {id:'/api/evidence/2',blob:{base64:'AQID'}},
  {id:'/api/evidence/3',blob:{__docsBlob:true,base64:''}}
 ]})];
 const plan=await preview({backups:copies});
 assert.deepEqual([...plan.file.additions.map(x=>x.id)],['/api/evidence/1']);
});

test('recovery remains add-only with a fresh preflight comparison',()=>{
 assert.match(page,/store\.add\(row\)/);
 assert.match(page,/const fresh=await docsRestorePreviewRead\(\)/);
 assert.match(page,/fresh\.backupId!==plan\.backupId/);
 assert.doesNotMatch(page.slice(begin,end),/store\.put\(|\.delete\(|\.clear\(/);
});
