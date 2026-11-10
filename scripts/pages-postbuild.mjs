// Prepares a production build for GitHub Pages, which has no server-side redirects or rewrites:
//  - a copy of index.html for every client-side route, as <route>.html and <route>/index.html,
//    so deep links load the app with HTTP 200 (Pages serves either, depending on the path);
//  - 404.html = index.html, so other paths still load the app (and its "not found" page) with 404;
//  - .nojekyll, so Pages serves every file as is;
//  - one meta-refresh stub per legacy URL that netlify.toml redirects with a 301.
// The routes are read from src/registry.ts and src/content/docs/index.ts, without compiling them.
// Usage: node scripts/pages-postbuild.mjs [outDir] [base]   (base defaults to VITE_BASE or /)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The repository root (this script lives in scripts/). */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Legacy paths and their targets, as in netlify.toml. */
export const LEGACY_REDIRECTS = {
  '/duality': '/algorithms/duality',
  '/smallestEnclosingDisk': '/algorithms/smallestEnclosingDisk',
};

/** The fixed routes of src/App.tsx; the home page is index.html itself. */
export const STATIC_ROUTES = ['/algorithms', '/documentation', '/playground'];

/** Every `path: '/…'` after `export const <name>` in TypeScript source (string literals only). */
export function registryPaths(source) {
  const start = source.indexOf('export const algorithms');
  if (start < 0) throw new Error('pages-postbuild: no `export const algorithms` in src/registry.ts');
  return [...source.slice(start).matchAll(/\bpath:\s*'(\/[^']*)'/g)].map((m) => m[1]);
}

/** Every `name: '…'` in the `docs` array of src/content/docs/index.ts. */
export function docNames(source) {
  const start = source.indexOf('export const docs');
  if (start < 0) throw new Error('pages-postbuild: no `export const docs` in src/content/docs/index.ts');
  return [...source.slice(start).matchAll(/\bname:\s*'([^']+)'/g)].map((m) => m[1]);
}

/**
 * The app routes that get a copy of index.html: the fixed ones, every algorithm and group path
 * of the registry, and /documentation/<name> for every documentation item. Legacy paths are
 * not app routes (they keep their redirect stubs).
 */
export function collectRoutes(root = ROOT) {
  const registry = readFileSync(join(root, 'src/registry.ts'), 'utf8');
  const docs = readFileSync(join(root, 'src/content/docs/index.ts'), 'utf8');
  const routes = [...new Set([...STATIC_ROUTES, ...registryPaths(registry), ...docNames(docs).map((n) => `/documentation/${n}`)])];
  for (const r of routes) {
    if (!/^(\/[A-Za-z0-9_.-]+)+$/.test(r)) throw new Error(`pages-postbuild: unexpected route '${r}'`);
    if (r in LEGACY_REDIRECTS) throw new Error(`pages-postbuild: route '${r}' collides with a legacy redirect`);
  }
  return routes;
}

/** Writes the Pages files into `dir` (a Vite build) for the site at `base`; returns the routes. */
export function postbuild(dir, base = '/', root = ROOT) {
  const prefix = base.replace(/\/$/, '');
  const index = join(dir, 'index.html');
  const routes = collectRoutes(root);
  for (const r of routes) {
    for (const file of [join(dir, `${r}.html`), join(dir, r, 'index.html')]) {
      mkdirSync(dirname(file), { recursive: true });
      copyFileSync(index, file);
    }
  }
  copyFileSync(index, join(dir, '404.html'));
  writeFileSync(join(dir, '.nojekyll'), '');
  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    const target = prefix + to;
    mkdirSync(join(dir, from), { recursive: true });
    writeFileSync(
      join(dir, from, 'index.html'),
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>WebCgal</title>` +
        `<meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${target}">` +
        `</head><body><p>Moved to <a href="${target}">${target}</a>.</p></body></html>\n`,
    );
  }
  return routes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? 'dist';
  const base = process.argv[3] ?? process.env.VITE_BASE ?? '/';
  const routes = postbuild(dir, base);
  console.log(`pages-postbuild: ${dir} ready (base ${base.replace(/\/$/, '') || '/'}, ${routes.length} routes)`);
}
