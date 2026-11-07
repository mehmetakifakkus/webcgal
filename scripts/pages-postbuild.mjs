// Prepares a production build for GitHub Pages, which has no server-side redirects:
//  - 404.html = index.html, so deep links to client-side routes load the app;
//  - .nojekyll, so Pages serves every file as is;
//  - one meta-refresh stub per legacy URL that netlify.toml redirects with a 301.
// Usage: node scripts/pages-postbuild.mjs [outDir] [base]   (base defaults to VITE_BASE or /)
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const base = (process.argv[3] ?? process.env.VITE_BASE ?? '/').replace(/\/$/, '');

/** Legacy paths and their targets, as in netlify.toml. */
export const LEGACY_REDIRECTS = {
  '/duality': '/algorithms/duality',
  '/smallestEnclosingDisk': '/algorithms/smallestEnclosingDisk',
};

copyFileSync(join(dir, 'index.html'), join(dir, '404.html'));
writeFileSync(join(dir, '.nojekyll'), '');
for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
  const target = base + to;
  mkdirSync(join(dir, from), { recursive: true });
  writeFileSync(
    join(dir, from, 'index.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>WebCgal</title>` +
      `<meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${target}">` +
      `</head><body><p>Moved to <a href="${target}">${target}</a>.</p></body></html>\n`,
  );
}
console.log(`pages-postbuild: ${dir} ready (base ${base || '/'})`);
