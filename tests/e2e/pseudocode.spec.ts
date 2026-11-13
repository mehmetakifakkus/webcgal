import { expect, test } from '@playwright/test'

/** Every algorithm page with a step player. */
const PLAYER_PAGES = [
  'convexHull',
  'segmentIntersection',
  'triangulation',
  'artGallery',
  'delaunay',
  'voronoi',
  'smallestEnclosingDisk',
  'kdTree',
  'rangeTree',
]

test('at 375 px no pseudocode word is split across two lines', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  const failures: string[] = []
  for (const slug of PLAYER_PAGES) {
    await page.goto(`algorithms/${slug}`)
    await expect(page.getByRole('list', { name: 'Pseudocode' })).toBeVisible()
    const result = await page.evaluate(() => {
      const root = document.querySelector('.pseudocode')!
      const split: string[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? ''
        for (const m of text.matchAll(/[\p{L}\p{N}_′]+/gu)) {
          const range = document.createRange()
          range.setStart(node, m.index)
          range.setEnd(node, m.index + m[0].length)
          const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)))
          if (tops.size > 1) split.push(m[0])
        }
      }
      return { split, width: root.getBoundingClientRect().width }
    })
    if (result.split.length) failures.push(`${slug} (panel ${result.width}px): ${result.split.join(', ')}`)
  }
  expect(failures).toEqual([])
})
