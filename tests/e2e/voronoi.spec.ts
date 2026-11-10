import { expect, test, type Page } from '@playwright/test'
import { VORONOI_PRESETS } from '../../src/geometry/algorithms/voronoi/presets'

const PATH = 'algorithms/voronoi'

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

const description = (page: Page) => page.locator('.step-player-description')

/** The done description a preset ends with (the collinear form when its bisectors are parallel lines). */
function doneText({ expected: e }: (typeof VORONOI_PRESETS)[number]) {
  return e.lines > 0
    ? `Done: ${e.lines} bisectors, ${e.cells} unbounded cells`
    : `Done: ${e.vertices} vertices, ${e.edges} edges, ${e.cells} cells (${e.unbounded} unbounded)`
}

/** Scene position (y-up) of the k-th point: the sites are drawn last, in input order. */
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

const stepTotal = async (page: Page) =>
  Number((await page.getByText(/^Step \d+ \/ \d+$/).textContent())!.split('/')[1])

test('page opens on the step tab', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await expect(page.getByRole('heading', { level: 1, name: 'Voronoi Diagram' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Step by step' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Vertices' })).toBeVisible()
  await page.waitForTimeout(200)
  expect(errors).toEqual([])
})

test('presets reach the expected totals', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  const select = page.getByLabel('Preset')
  for (const preset of VORONOI_PRESETS) {
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(page.getByText(/^Step 1 \/ /)).toHaveCount(0)
    await select.selectOption({ label: preset.name })
    await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(description(page)).toContainText(doneText(preset))
  }
  expect(errors).toEqual([])
})

test('mode keeps the step count', async ({ page }) => {
  await page.goto(PATH)
  await page.getByLabel('Preset').selectOption({ label: 'Textbook example' })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  const n = await stepTotal(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Step 2 \/ /)).toBeVisible()
  await page.getByLabel('Mode').selectOption({ label: 'Voronoi only' })
  await expect(page.getByText(`Step 1 / ${n}`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toContainText(doneText(VORONOI_PRESETS[0]))
})

test('dragging a point restarts the player', async ({ page }) => {
  test.skip(!!process.env.BASE_URL, 'needs the e2e debug hook')
  await page.goto(PATH)
  await page.getByLabel('Preset').selectOption({ label: 'Textbook example' })
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Step 4 \/ /)).toBeVisible()
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.activeLayer.children.length)
  const n = VORONOI_PRESETS[0].points.length
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
  const n = VORONOI_PRESETS[0].points.length
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
  await expect(log.locator('.output-line', { hasText: /^\d+ vertex\/vertices, \d+ edge\(s\), \d+ cell\(s\)$/ })).toHaveCount(1)
  await expect(log.locator('.output-line.error')).toHaveCount(0)
  expect(errors).toEqual([])
})
