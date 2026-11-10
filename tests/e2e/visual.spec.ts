import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCREENS =
  process.env.SCREENS_DIR ??
  fileURLToPath(new URL('../../.superpowers/sdd/2026-11-06-webcgal-modernization/screens', import.meta.url))
const save = process.env.SAVE_SCREENS === '1'

const pages = [
  { path: './', name: 'home', heading: undefined },
  { path: 'algorithms', name: 'algorithms', heading: 'Algorithms' },
  { path: 'algorithms/convexHull', name: 'convexHull', heading: 'Convex Hull' },
  { path: 'algorithms/segmentIntersection', name: 'segmentIntersection', heading: 'Line Segment Intersection' },
  { path: 'algorithms/triangulation', name: 'triangulation', heading: 'Polygon Triangulation' },
  { path: 'algorithms/delaunay', name: 'delaunay', heading: 'Delaunay Triangulation' },
  { path: 'algorithms/voronoi', name: 'voronoi', heading: 'Voronoi Diagram' },
  { path: 'algorithms/smallestEnclosingDisk', name: 'smallestEnclosingDisk', heading: 'Smallest Enclosing Disk' },
  { path: 'algorithms/L-monoton', name: 'L-monoton', heading: 'L-monotone Polygon' },
  { path: 'documentation', name: 'documentation', heading: 'Documentation' },
  { path: 'documentation/TextPoint', name: 'doc-TextPoint', heading: 'TextPoint' },
  { path: 'documentation/createPolygon', name: 'doc-createPolygon', heading: 'createPolygon' },
  { path: 'playground', name: 'playground', heading: 'Playground' },
  { path: 'bu-yok', name: '404', heading: 'Page not found' },
]

for (const colorScheme of ['light', 'dark'] as const)
  for (const width of [375, 1280])
    test(`layout at ${width}px, ${colorScheme}`, async ({ browser }) => {
      if (save) mkdirSync(SCREENS, { recursive: true })
      const context = await browser.newContext({ colorScheme, viewport: { width, height: 900 }, deviceScaleFactor: 1 })
      const page = await context.newPage()
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      page.on('pageerror', (err) => errors.push(err.message))
      for (const p of pages) {
        await page.goto(p.path)
        const h1 = p.heading ? page.getByRole('heading', { level: 1, name: p.heading }) : page.getByRole('heading', { level: 1 })
        await expect(h1).toBeVisible()
        await expect(page.getByText('Loading…')).toHaveCount(0)
        await page.waitForTimeout(400)
        const overflow = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }))
        expect(overflow.scroll, `${p.path} scrolls horizontally`).toBeLessThanOrEqual(overflow.inner)
        if (save)
          await page.screenshot({ path: join(SCREENS, `${p.name}-${width}-${colorScheme}.png`), fullPage: true })
      }
      expect(errors).toEqual([])
      await context.close()
    })
