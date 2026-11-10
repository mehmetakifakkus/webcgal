import { expect, test, type Page } from '@playwright/test'
import { KD_PRESETS } from '../../src/geometry/algorithms/kdtree/presets'

const PATH = 'algorithms/kdTree'

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

const description = (page: Page) => page.locator('.step-player-description')

const count = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`

/** The done description a preset ends with, built from the pinned `expected` values only. */
function doneText({ expected: e }: (typeof KD_PRESETS)[number]) {
  return (
    `Done: ${count(e.reported.length, 'point')} reported, ${count(e.visited, 'node')} visited, ` +
    `${count(e.inside, 'subtree')} reported whole, ${count(e.pruned, 'subtree')} skipped`
  )
}

/**
 * Scene position (y-up) of handle `k`: the points are drawn last but for the two corner squares
 * of the query rectangle, in handle order (points, then the corners (x0, y0) and (x1, y1)).
 */
async function handlePosition(page: Page, k: number, handles: number) {
  return page.evaluate(
    ({ k, handles }) => {
      const children = window.__webcgalDebug!.scene.paper.project.activeLayer.children
      const c = children[children.length - handles + k]
      return { x: Math.round(c.position.x), y: Math.round(c.position.y), width: Math.round(c.bounds.width) }
    },
    { k, handles },
  )
}

/** Page coordinates of a scene point (y-up, 775×360). */
async function toPage(page: Page, p: { x: number; y: number }) {
  const canvas = page.getByLabel('Drawing canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  return { x: box.x + (p.x / 775) * box.width, y: box.y + (1 - p.y / 360) * box.height }
}

async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 5 })
  await page.mouse.up()
}

const stepTotal = async (page: Page) =>
  Number((await page.getByText(/^Step \d+ \/ \d+$/).textContent())!.split('/')[1])

test('page opens on the step tab', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await expect(page.getByRole('heading', { level: 1, name: 'kd-Tree Range Search' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Step by step' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Node', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Query', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reported', exact: true })).toBeVisible()
  await page.waitForTimeout(200)
  expect(errors).toEqual([])
})

test('presets reach the expected totals', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  const select = page.getByLabel('Preset')
  for (const preset of KD_PRESETS) {
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(page.getByText(/^Step 1 \/ /)).toHaveCount(0)
    await select.selectOption({ label: preset.name })
    await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(description(page)).toHaveText(doneText(preset))
  }
  expect(errors).toEqual([])
})

test('modes change the steps', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  const preset = KD_PRESETS[0]
  const { nodes, depth } = preset.expected
  await page.getByLabel('Preset').selectOption({ label: preset.name })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  const full = await stepTotal(page)

  // build only: one step per node, then "kd-tree ready"
  await page.getByLabel('Mode').selectOption({ label: 'Build only' })
  await expect(page.getByText(`Step 1 / ${nodes + 1}`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toHaveText(`kd-tree ready: ${nodes} nodes, depth ${depth}`)

  // query only: the finished tree, then the query steps of the full run
  await page.getByLabel('Mode').selectOption({ label: 'Query only' })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  const query = await stepTotal(page)
  expect(query).toBeLessThan(full)
  expect(query).toBe(full - nodes)
  await expect(description(page)).toHaveText(`kd-tree ready: ${nodes} nodes, depth ${depth}`)
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toHaveText(doneText(preset))

  await page.getByLabel('Mode').selectOption({ label: 'Build and query' })
  await expect(page.getByText(`Step 1 / ${full}`, { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('dragging a point and a corner restarts the player', async ({ page }) => {
  test.skip(!!process.env.BASE_URL, 'needs the e2e debug hook')
  const errors = collectErrors(page)
  await page.goto(PATH)
  const preset = KD_PRESETS[0]
  const { points, query } = preset.input
  const handles = points.length + 2
  await page.getByLabel('Preset').selectOption({ label: preset.name })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.activeLayer.children.length)

  // a point
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Step 4 \/ /)).toBeVisible()
  const v1 = await handlePosition(page, 0, handles)
  expect(v1).toMatchObject({ x: points[0].x, y: points[0].y, width: 8 })
  await drag(page, await toPage(page, v1), 20, 10)
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  expect((await handlePosition(page, 0, handles)).x).not.toBe(points[0].x)

  // the lower-left corner of the query rectangle
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Step 4 \/ /)).toBeVisible()
  const corner = await handlePosition(page, points.length, handles)
  expect(corner).toMatchObject({ x: query.x0, y: query.y0, width: 7 })
  await drag(page, await toPage(page, corner), -20, 10)
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  const moved = await handlePosition(page, points.length, handles)
  expect(moved.x).toBeLessThan(query.x0)
  expect(moved.y).toBeLessThan(query.y0)
  // the other corner stays put
  expect(await handlePosition(page, points.length + 1, handles)).toMatchObject({ x: query.x1, y: query.y1 })
  expect(errors).toEqual([])
})

test('code tab runs the demo', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await page.getByRole('tab', { name: 'Code' }).click()
  const log = page.getByRole('log')
  await expect(log.locator('.output-line', { hasText: /^\d+ point\(s\) in the range$/ })).toHaveCount(1)
  await expect(log.locator('.output-line.error')).toHaveCount(0)
  expect(errors).toEqual([])
})
