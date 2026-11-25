import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const page=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
const start=page.indexOf('function gradeCompareKey(record)');
const end=page.indexOf("el('gradeCompareRun').onclick",start);
assert.ok(start>=0&&end>start);
const compare=runInNewContext(page.slice(start,end)+'\ngradeCompareImports',{norm:v=>String(v??'').trim().toLowerCase()});
const row={id:'001',name:'طالب تجريبي',subject:'رياضيات',pct:50};
test('unique identified grades yield change in percentage points',()=>assert.equal(compare({records:[row]},{records:[{...row,pct:70}]})[0].change,20));
test('duplicates in either file exclude the entire ambiguous pair',()=>{
 for(const pair of [[ [row,row],[row] ],[[row],[row,row]]])assert.equal(compare({records:pair[0]},{records:pair[1]}).length,0);
});
test('name-only rows cannot be compared as a confirmed identity',()=>assert.equal(compare({records:[{...row,id:''}]},{records:[{...row,id:''}]}).length,0));
test('invalid percentages are excluded',()=>assert.equal(compare({records:[row]},{records:[{...row,pct:120}]}).length,0));
