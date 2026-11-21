import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/);
assert.ok(match,'embedded HTML must exist');
const page=JSON.parse(match[1]);
const block=page.match(/<style id="docs-ios-safe-frame-v1">([\s\S]*?)<\/style>/);
assert.ok(block,'global mobile safe frame CSS must exist');
const css=block[1];

test('iOS standalone status bar and viewport use safe frame',()=>{
 assert.match(page,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
 assert.match(page,/<meta name="apple-mobile-web-app-status-bar-style" content="default">/);
 assert.match(css,/header\.top\{[^}]*padding-top:max\(12px,var\(--docs-safe-top\)\)!important/s);
 assert.doesNotMatch(css,/padding-top:calc\(12px \+ var\(--docs-safe-top\)\)/);
});
test('bottom navigation and main content respect home indicator',()=>{
 assert.match(css,/#workspaceNav\{[^}]*bottom:0!important/s);
 assert.match(css,/#workspaceNav\{[^}]*var\(--docs-safe-bottom\)/s);
 assert.match(css,/#appMain\{[^}]*var\(--docs-safe-bottom\)/s);
});
test('site layout is horizontally constrained without disabling print',()=>{
 assert.match(css,/html\{[^}]*overflow-x:clip/s);
 assert.match(css,/\.grade-table-wrap,\.docs-records-table-wrap,\.grade-print-scroll\{[^}]*overflow-x:auto/s);
 assert.match(css,/@media print\{/);
 assert.match(css,/#workspaceNav\{display:none!important\}/);
});
