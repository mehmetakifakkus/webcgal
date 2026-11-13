import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { algorithms, groups } from '../src/registry.ts';
import { docs } from '../src/content/docs/index.ts';
import { LEGACY_REDIRECTS, STATIC_ROUTES, collectRoutes, docNames, registryPaths } from './pages-postbuild.mjs';

const SCRIPT = fileURLToPath(new URL('./pages-postbuild.mjs', import.meta.url));
const sorted = (xs) => [...xs].sort();

describe('route collection', () => {
  test('every registry path and docs item, and nothing else', () => {
    const expected = [
      ...STATIC_ROUTES,
      ...algorithms.map((a) => a.path),
      ...Object.values(groups).map((g) => g.path),
      ...docs.map((d) => `/documentation/${d.name}`),
    ];
    const routes = collectRoutes();
    expect(sorted(routes)).toEqual(sorted(expected));
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes).toEqual(expect.arrayContaining(['/algorithms/kdTree', '/algorithms/artGallery', '/algorithms/rangeTree', '/algorithms/duality', '/algorithms/duality/dualLine', '/documentation/kdTree']));
    for (const legacy of Object.keys(LEGACY_REDIRECTS)) expect(routes).not.toContain(legacy);
    expect(routes).not.toContain('/');
  });

  test('the source scanners read string literals only', () => {
    const registry = `export type A = { path: string; name: string };
      export const algorithms = [{ slug: 'a', path: '/algorithms/a', name: 'A' }, { path: '/algorithms/b-c' }];
      export const groups = { g: { name: 'G', path: '/algorithms/g' } };`;
    expect(registryPaths(registry)).toEqual(['/algorithms/a', '/algorithms/b-c', '/algorithms/g']);
    const index = `export type DocEntry = { name: string };
      export const categories = [{ id: 'objects', title: 'Objects' }];
      export const docs = [{ name: 'Polygon', category: 'objects' }, {
        name: 'kdTree',
        category: 'misc_functions',
      }];`;
    expect(docNames(index)).toEqual(['Polygon', 'kdTree']);
    expect(() => registryPaths('const x = 1')).toThrow(/algorithms/);
    expect(() => docNames('const x = 1')).toThrow(/docs/);
  });
});

describe('running the script', () => {
  const dirs = [];
  afterEach(() => {
    dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
  });

  test('writes a copy of index.html per route, 404.html, .nojekyll and the legacy stubs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pages-postbuild-'));
    dirs.push(dir);
    const index = '<!doctype html><title>app</title><script src="/webcgal/assets/index.js"></script>\n';
    writeFileSync(join(dir, 'index.html'), index);
    const res = spawnSync(process.execPath, [SCRIPT, dir, '/webcgal/'], { encoding: 'utf8' });
    expect(res.status, res.stderr).toBe(0);
    const routes = collectRoutes();
    expect(res.stdout).toContain(`${routes.length} routes`);
    for (const r of routes) {
      expect(readFileSync(join(dir, `${r}.html`), 'utf8'), r).toBe(index);
      expect(readFileSync(join(dir, r, 'index.html'), 'utf8'), r).toBe(index);
    }
    for (const f of ['algorithms/kdTree.html', 'algorithms/kdTree/index.html', 'algorithms/artGallery.html', 'algorithms/artGallery/index.html', 'algorithms/rangeTree.html', 'algorithms/rangeTree/index.html', 'documentation/kdTree.html', 'playground.html'])
      expect(existsSync(join(dir, f)), f).toBe(true);
    expect(readFileSync(join(dir, '404.html'), 'utf8')).toBe(index);
    expect(existsSync(join(dir, '.nojekyll'))).toBe(true);
    // the legacy stubs redirect under the base and are not route copies
    for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
      const stub = readFileSync(join(dir, from, 'index.html'), 'utf8');
      expect(stub).toContain(`url=/webcgal${to}"`);
      expect(existsSync(join(dir, `${from}.html`))).toBe(false);
    }
  });
});
