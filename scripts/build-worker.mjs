import {readFile, writeFile} from 'node:fs/promises';
import {Script} from 'node:vm';

// Keep the standalone Worker deployable without changing its bindings or entry point.
const root = new URL('../', import.meta.url);
const pageSource = await readFile(new URL('src/page.html', root), 'utf8');
const modules = ['fieldwork-case-engine.mjs','fieldwork-case-crypto.mjs','fieldwork-case-encrypted-repository.mjs','fieldwork-case-view.mjs','fieldwork-attendance-import.mjs','professional-portfolio.mjs'];
const parts = await Promise.all(modules.map(async name => {
  const source = await readFile(new URL('src/'+name, root), 'utf8');
  return source.replace(/^import .*;$/gm,'').replace(/^export /gm,'');
}));
const bundle = 'window.docsFieldwork = (() => {\n'+parts.join('\n')+'\nreturn Object.freeze({unlockCaseCipher,encryptedCaseRepository,projectFieldworkCases,previewAttendance,commitAttendanceBatch,buildProfessionalPortfolio});\n})();';
new Script(bundle,{filename:'fieldwork-bundle.js'});
if (bundle.includes('</script')) throw Error('Unsafe inline bundle');
const marker = '<!-- DOCS_FIELDWORK_BUNDLE -->';
if (pageSource.split(marker).length !== 2) throw Error('Missing fieldwork bundle marker');
const page = pageSource.replace(marker,()=>'<script>'+bundle+'</script>');
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
