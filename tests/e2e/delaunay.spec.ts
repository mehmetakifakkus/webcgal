import { expect, test, type Page } from '@playwright/test'
import { DELAUNAY_PRESETS } from '../../src/geometry/algorithms/delaunay/presets'

const PATH = '/algorithms/delaunay'

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

const description = (page: Page) => page.locator('.step-player-description')

/** Scene position (y-up) of the k-th point: the points are drawn last, in input order. */
async function pointPosition(page: Page, k: number, n: number) {
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

test('page opens on the step tab', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await expect(page.getByRole('heading', { level: 1, name: 'Delaunay Triangulation' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Step by step' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Insertion order' })).toBeVisible()
  await page.waitForTimeout(200)
  expect(errors).toEqual([])
})

test('presets reach the expected totals', async ({ page }) => {
  await page.goto(PATH)
  const select = page.getByLabel('Preset')
  for (const preset of DELAUNAY_PRESETS) {
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(page.getByText(/^Step 1 \/ /)).toHaveCount(0)
    await select.selectOption({ label: preset.name })
    await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(description(page)).toContainText(
      `Done: ${preset.expected.triangles} triangles, ${preset.expected.flips} flips`,
    )
  }
})

test('points on a circle runs without errors', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await page.getByLabel('Preset').selectOption({ label: 'Points on a circle' })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  const counter = page.getByText(/^Step \d+ \/ \d+$/)
  const total = Number((await counter.textContent())!.split('/')[1])
  const next = page.getByRole('button', { name: 'Next' })
  for (let i = 1; i < total; i++) await next.click()
  await expect(page.getByText(`Step ${total} / ${total}`, { exact: true })).toBeVisible()
  const { expected } = DELAUNAY_PRESETS.find((p) => p.name === 'Points on a circle')!
  await expect(description(page)).toContainText(`Done: ${expected.triangles} triangles, ${expected.flips} flips`)
  expect(errors).toEqual([])
})

test('dragging a point restarts the player', async ({ page }) => {
  test.skip(!!process.env.BASE_URL, 'needs the e2e debug hook')
  await page.goto(PATH)
  await page.getByLabel('Preset').selectOption({ label: 'Textbook example' })
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Step 4 \/ /)).toBeVisible()
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.activeLayer.children.length)
  const n = DELAUNAY_PRESETS[0].points.length
  const v1 = await pointPosition(page, 0, n)
  expect(v1).toMatchObject({ x: 120, y: 300, width: 8 })
  const from = await toPage(page, v1)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 20, from.y - 10, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await pointPosition(page, 0, n)).x).not.toBe(120)
})

test('dragging onto another point shows the alert and reverts', async ({ page }) => {
  test.skip(!!process.env.BASE_URL, 'needs the e2e debug hook')
  await page.goto(PATH)
  await page.getByLabel('Preset').selectOption({ label: 'Textbook example' })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.activeLayer.children.length)
  const n = DELAUNAY_PRESETS[0].points.length
  const v1 = await pointPosition(page, 0, n)
  expect(v1).toMatchObject({ x: 120, y: 300, width: 8 })
  const v2 = await pointPosition(page, 1, n)
  expect(v2).toMatchObject({ x: 300, y: 320 })
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Step 2 \/ /)).toBeVisible()
  const from = await toPage(page, v1)
  const to = await toPage(page, v2)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  // one move straight onto v2: no valid position in between, so the release reverts to the preset
  await page.mouse.move(to.x, to.y, { steps: 1 })
  await expect(page.getByRole('alert')).toHaveText('Points must be distinct')
  await page.mouse.up()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  expect(await pointPosition(page, 0, n)).toMatchObject({ x: 120, y: 300 })
})

test('code tab runs the demo', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await page.getByRole('tab', { name: 'Code' }).click()
  const log = page.getByRole('log')
  await expect(log.locator('.output-line', { hasText: /^\d+ triangle\(s\), \d+ edge\(s\)$/ })).toHaveCount(1)
  await expect(log.locator('.output-line.error')).toHaveCount(0)
  expect(errors).toEqual([])
})
