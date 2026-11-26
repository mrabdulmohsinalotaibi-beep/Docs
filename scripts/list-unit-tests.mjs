import {readdir, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(new URL('../tests',import.meta.url).pathname);
const files=[];
for(const name of (await readdir(root)).sort()){
  if(!name.endsWith('.test.mjs'))continue;
  const content=await readFile(resolve(root,name),'utf8');
  if(/playwright-core|from ['"]playwright/.test(content))continue;
  files.push(resolve(root,name));
}
process.stdout.write(files.join(' '));
