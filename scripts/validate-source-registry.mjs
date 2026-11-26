import {readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';

const root=resolve(dirname(new URL(import.meta.url).pathname),'..');
const registryPath=resolve(root,'docs/source-registry.json');
const registry=JSON.parse(await readFile(registryPath,'utf8'));
const allowed=new Set(['official','internal','mixed','needs-review','needs-verification','internal-unvalidated']);
const required=['id','title','kind','status','scope','publisher','repositoryPath','claims','limitations'];
const errors=[];
if(!Number.isInteger(registry.version)||registry.version<1)errors.push('version must be a positive integer');
if(!/^\d{4}-\d{2}-\d{2}$/.test(registry.lastReviewed||''))errors.push('lastReviewed must be YYYY-MM-DD');
if(!Array.isArray(registry.entries)||registry.entries.length===0)errors.push('entries must contain at least one source');
const ids=new Set();
for(const [index,entry] of (registry.entries||[]).entries()){
  for(const key of required)if(!(key in entry))errors.push(`entry ${index}: missing ${key}`);
  if(ids.has(entry.id))errors.push(`entry ${index}: duplicate id ${entry.id}`); ids.add(entry.id);
  if(!allowed.has(entry.status))errors.push(`entry ${entry.id}: unsupported status ${entry.status}`);
  if(!Array.isArray(entry.claims)||entry.claims.length===0)errors.push(`entry ${entry.id}: claims must not be empty`);
  if(!Array.isArray(entry.limitations)||entry.limitations.length===0)errors.push(`entry ${entry.id}: limitations must not be empty`);
  const path=resolve(root,entry.repositoryPath||'');
  if(!path.startsWith(root+'/'))errors.push(`entry ${entry.id}: repositoryPath escapes repository`);
  else try{await readFile(path)}catch{errors.push(`entry ${entry.id}: repositoryPath does not exist: ${entry.repositoryPath}`)}
  if(entry.status==='official'&&!entry.sourceUrl&&!entry.pageOrSection)errors.push(`entry ${entry.id}: official source needs sourceUrl or pageOrSection`);
}
if(errors.length){console.error('Source registry validation failed:'); for(const error of errors)console.error(`- ${error}`);process.exit(1)}
console.log(`Source registry valid: ${registry.entries.length} entries, ${registry.entries.filter(x=>x.status==='official').length} official, ${registry.entries.filter(x=>x.status!=='official').length} requiring qualification.`);
