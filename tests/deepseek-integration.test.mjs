import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=code.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(match,'HTML must be embedded in Worker');
const page=JSON.parse(match[1]);
const client=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(x=>x.includes("aiGenerate"));
test('Worker and embedded client parse',()=>{assert.doesNotThrow(()=>new vm.Script(code.replace('export default {','const exported = {')));assert.ok(client);assert.doesNotThrow(()=>new vm.Script(client));});
test('Docs API exclusively handles DeepSeek with account session and same-origin',()=>{
 assert.match(code,/if\(path==="\/api\/ai\/deepseek"\)/);
 assert.match(code,/await docsIdent\(request,env\)/);
 assert.match(code,/request\.headers\.get\("origin"\)!==url\.origin/);
 assert.match(code,/env\.DEEPSEEK_API_KEY/);
 assert.match(code,/https:\/\/api\.deepseek\.com\/chat\/completions/);
 assert.doesNotMatch(page,/Bearer\s+[a-zA-Z0-9_-]{24,}/);
});
test('AI requires explicit consent and applies only reviewed proposals',()=>{
 assert.match(client,/if\(!\$\('aiConsent'\)\.checked\)/);
 assert.match(client,/input\[data-ai-label\]:checked/);
 assert.match(client,/field\.dispatchEvent\(new Event\('input'/);
 assert.match(client,/\/api\/ai\/deepseek/);
 assert.doesNotMatch(client,/\/api\/ai\/smart-fill/);
 assert.doesNotMatch(client,/\/api\/ai\/counselor/);
});
