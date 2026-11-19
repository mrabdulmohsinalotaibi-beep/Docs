import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const worker = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

function extractPage() {
  const marker = 'const PAGE=';
  const start = worker.indexOf(marker);
  assert.notEqual(start, -1, 'Embedded HTML PAGE constant must exist');
  const quote = start + marker.length;
  assert.equal(worker[quote], '"');
  let escaped = false;
  for (let i = quote + 1; i < worker.length; i++) {
    if (escaped) { escaped = false; continue; }
    if (worker[i] === '\\') { escaped = true; continue; }
    if (worker[i] === '"') return JSON.parse(worker.slice(quote, i + 1));
  }
  throw new Error('Unterminated PAGE constant');
}

test('embedded HTML scripts parse without errors', () => {
  const page = extractPage();
  const inline = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/.test(match[0]));
  assert.ok(inline.length >= 4, 'Expected HTML inline scripts');
  inline.forEach((match, index) => {
    assert.doesNotThrow(() => new Script(match[1], { filename: 'inline-' + index + '.js' }));
  });
});

test('responsive settings layout keeps original data actions and status events', () => {
  const page = extractPage();
  for (const token of [
    'dsPanelOverview', 'dsPanelAccount', 'dsPanelStorage',
    'dsPanelSync', 'dsPanelPrivacy', 'dsOpenTab',
    'dsGet(\'dsBackup\')', 'dsGet(\'dsRestore\')',
    'dsGet(\'dsDanger\')', 'docs:local-status', 'docs:peer-status',
    'dsModern', 'dsDesignStyle'
  ]) assert.ok(page.includes(token), 'Missing UI or handler marker: ' + token);
  assert.ok(page.includes('@media(max-width:900px)'), 'Responsive tablet styles must exist');
});
