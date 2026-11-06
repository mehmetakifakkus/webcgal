// Checks a production build (default dist/): the entry HTML must not load the heavy
// code-runner chunks, and the e2e debug hook must not be shipped.
// Usage: node scripts/check-bundle.mjs [outDir]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const failures = [];

const html = readFileSync(join(dir, 'index.html'), 'utf8');
for (const name of ['codemirror', 'paper']) {
  if (new RegExp(`/assets/${name}[-.]`).test(html)) failures.push(`${dir}/index.html references the ${name} chunk`);
}

for (const file of readdirSync(join(dir, 'assets'))) {
  if (!file.endsWith('.js')) continue;
  if (readFileSync(join(dir, 'assets', file), 'utf8').includes('__webcgalDebug'))
    failures.push(`${dir}/assets/${file} contains the __webcgalDebug test hook`);
}

if (failures.length) {
  for (const f of failures) console.error(`check:bundle: ${f}`);
  process.exit(1);
}
console.log(`check:bundle: ${dir} ok`);
