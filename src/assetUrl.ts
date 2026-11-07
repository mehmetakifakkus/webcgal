/**
 * Prefixes a site-absolute path (e.g. `/images/x.png`) with the build's base path, so assets
 * referenced from code resolve when the site is served under a sub-path (GitHub Pages).
 * Vite rewrites URLs in `index.html` and imports itself, but not strings in source code.
 */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  return b + (path.startsWith('/') ? path : '/' + path)
}

/** The router basename for the build's base path: undefined when the site is at the root. */
export function routerBasename(base: string = import.meta.env.BASE_URL): string | undefined {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  return b === '' ? undefined : b
}
