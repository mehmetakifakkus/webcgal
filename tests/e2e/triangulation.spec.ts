import { expect, test, type Page } from '@playwright/test'
import { TRIANGULATION_PRESETS } from '../../src/geometry/algorithms/triangulation/presets'

const PATH = 'algorithms/triangulation'

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

const description = (page: Page) => page.locator('.step-player-description')

/** Scene position (y-up) of the k-th drag handle: the handles are the last n items, in input order. */
async function handlePosition(page: Page, k: number, n: number) {
  return page.evaluate(
    ({ k, n }) => {
      const children = window.__webcgalDebug!.scene.paper.project.activeLayer.children
      const c = children[children.length - n + k]
      return { x: Math.round(c.position.x), y: Math.round(c.position.y), width: c.bounds.width }
    },
    { k, n },
  )
}

/** Page coordinates of a scene point (y-up, 775×360). */
async function toPage(page: Page, p: { x: number; y: number }) {
  const canvas = page.getByLabel('Drawing canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  return { x: box.x + (p.x / 775) * box.width, y: box.y + (1 - p.y / 360) * box.height }
}

test('page opens on the step tab with mode select', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await expect(page.getByRole('heading', { level: 1, name: 'Polygon Triangulation' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Step by step' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  const mode = page.getByLabel('Mode')
  await expect(mode.locator('option')).toHaveText(['Full', 'Partition only', 'Triangulation only'])
  await expect(page.getByText('Vertex types', { exact: true })).toBeVisible()
  await page.waitForTimeout(200)
  expect(errors).toEqual([])
})

test('presets reach the expected totals', async ({ page }) => {
  await page.goto(PATH)
  const select = page.getByLabel('Preset')
  for (const preset of TRIANGULATION_PRESETS) {
    const n = preset.polygon.length
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(page.getByText(/^Step 1 \/ /)).toHaveCount(0)
    await select.selectOption({ label: preset.name })
    await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(description(page)).toContainText(`Done: ${n - 3} diagonals, ${n - 2} triangles`)
  }
})

test('partition mode ends with pieces', async ({ page }) => {
  await page.goto(PATH)
  await page.getByLabel('Preset').selectOption({ label: 'Textbook polygon' })
  await page.getByLabel('Mode').selectOption({ label: 'Partition only' })
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toContainText(/Done: \d+ diagonals, \d+ monotone pieces/)
})

test('dragging a vertex restarts the player', async ({ page }) => {
  test.skip(!!process.env.BASE_URL, 'needs the e2e debug hook')
  await page.goto(PATH)
  await page.getByLabel('Preset').selectOption({ label: 'Textbook polygon' })
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Step 4 \/ /)).toBeVisible()
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.activeLayer.children.length)
  const n = TRIANGULATION_PRESETS[0].polygon.length
  const v3 = await handlePosition(page, 2, n)
  expect(v3).toMatchObject({ x: 150, y: 60, width: 8 })
  const from = await toPage(page, v3)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 20, from.y - 10, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await handlePosition(page, 2, n)).x).not.toBe(150)
})

test('dragging across an edge shows the alert and reverts', async ({ page }) => {
  test.skip(!!process.env.BASE_URL, 'needs the e2e debug hook')
  await page.goto(PATH)
  await page.getByLabel('Preset').selectOption({ label: 'Textbook polygon' })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.activeLayer.children.length)
  const n = TRIANGULATION_PRESETS[0].polygon.length
  const v1 = await handlePosition(page, 0, n)
  expect(v1).toMatchObject({ x: 120, y: 310, width: 8 })
  const from = await toPage(page, v1)
  // v1 at (450, 310): edges v14–v1 and v1–v2 cross the polygon's other edges
  const to = await toPage(page, { x: 450, y: 310 })
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  // two moves, both invalid (v1 is still valid up to x ≈ 270): the release reverts to the last
  // valid input, which is then the original polygon
  await page.mouse.move(to.x, to.y, { steps: 2 })
  await expect(page.getByRole('alert')).toHaveText('The polygon must be simple (no crossing edges)')
  await page.mouse.up()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  expect(await handlePosition(page, 0, n)).toMatchObject({ x: 120, y: 310 })
})

test('code tab runs the demo', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await page.getByRole('tab', { name: 'Code' }).click()
  const log = page.getByRole('log')
  await expect(log.locator('.output-line', { hasText: /\d+ triangle\(s\), \d+ partition diagonal\(s\)/ })).toHaveCount(1)
  await expect(log.locator('.output-line.error')).toHaveCount(0)
  expect(errors).toEqual([])
})
