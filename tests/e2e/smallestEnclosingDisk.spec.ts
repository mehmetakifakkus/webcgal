import { expect, test, type Page } from '@playwright/test'
import { label, minidisc } from '../../src/geometry/algorithms/minidisc/minidisc'
import { MINIDISC_PRESETS } from '../../src/geometry/algorithms/minidisc/presets'

const PATH = 'algorithms/smallestEnclosingDisk'

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

const description = (page: Page) => page.locator('.step-player-description')

/** "v1", "v1 and v2", "v1, v2 and v3". */
const listLabels = (ids: number[]) => {
  const ls = ids.map(label)
  return ls.length <= 1 ? ls.join('') : `${ls.slice(0, -1).join(', ')} and ${ls[ls.length - 1]}`
}

/** The done description a preset ends with: totals from `expected`, boundary labels from a run of `minidisc`. */
function doneText({ points, order, expected: e }: (typeof MINIDISC_PRESETS)[number]) {
  const { boundary } = minidisc(points, order)
  expect(boundary).toHaveLength(e.boundary)
  return `Done: smallest disc through ${listLabels(boundary)} (r = ${e.radius.toFixed(1)}), ${e.tests} tests, ${e.updates} updates`
}

/** Scene position (y-up) of the k-th point: the points are drawn last, in input order (no current point). */
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
  await expect(page.getByRole('heading', { level: 1, name: 'Smallest Enclosing Disk' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Step by step' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Call stack' })).toBeVisible()
  await page.waitForTimeout(200)
  expect(errors).toEqual([])
})

test('presets reach the expected totals', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  const select = page.getByLabel('Preset')
  for (const preset of MINIDISC_PRESETS) {
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(page.getByText(/^Step 1 \/ /)).toHaveCount(0)
    await select.selectOption({ label: preset.name })
    await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(description(page)).toHaveText(doneText(preset))
  }
  expect(errors).toEqual([])
})

test('dragging a point restarts the player', async ({ page }) => {
  test.skip(!!process.env.BASE_URL, 'needs the e2e debug hook')
  await page.goto(PATH)
  const preset = MINIDISC_PRESETS[0]
  await page.getByLabel('Preset').selectOption({ label: preset.name })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  // step 2 (D₂): no point is current, so the points are the last n items
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Step 2 \/ /)).toBeVisible()
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.activeLayer.children.length)
  const n = preset.points.length
  const v1 = await pointPosition(page, 0, n)
  expect(v1).toMatchObject({ x: 180, y: 250, width: 8 })
  const from = await toPage(page, v1)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 20, from.y - 10, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await pointPosition(page, 0, n)).x).not.toBe(180)
  // the order stays
  await expect(description(page)).toHaveText(`Order: ${preset.order.map(label).join(', ')}`)
})

test('code tab runs the demo', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await page.getByRole('tab', { name: 'Code' }).click()
  await expect(page.getByRole('textbox', { name: 'Code editor' })).toBeVisible()
  await expect(page.getByLabel('Drawing canvas')).toBeVisible()
  await page.waitForTimeout(300)
  await expect(page.getByRole('log').locator('.output-line.error')).toHaveCount(0)
  expect(errors).toEqual([])
})
