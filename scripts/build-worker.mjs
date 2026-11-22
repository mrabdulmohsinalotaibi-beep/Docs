import {readFile, writeFile} from 'node:fs/promises';
import {Script} from 'node:vm';

// Keep the standalone Worker deployable without changing its bindings or entry point.
const root = new URL('../', import.meta.url);
const page = await readFile(new URL('src/page.html', root), 'utf8');
const runtime = await readFile(new URL('src/worker-runtime.js', root), 'utf8');
for (const [index, match] of [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries()) {
  new Script(match[1], {filename: `page-inline-${index + 1}.js`});
}
const generated = `const PAGE=${JSON.stringify(page)};\n${runtime}`;
const target = new URL('worker.js', root);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== generated) {
    throw new Error('worker.js is out of date. Run node scripts/build-worker.mjs');
  }
  console.log('worker.js matches its sources; inline scripts parse.');
} else {
  await writeFile(target, generated);
  console.log('Built worker.js from src/page.html and src/worker-runtime.js');
}
