import { expect, test, type Page } from '@playwright/test'
import { RT_PRESETS } from '../../src/geometry/algorithms/rangetree/presets'

const PATH = 'algorithms/rangeTree'
const WIDTH = 775
const HEIGHT = 480

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

const description = (page: Page) => page.locator('.step-player-description')
const panelRows = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true }).locator('.state-row')

const count = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`

/** The done description a preset ends with, built from the pinned `expected` values only. */
function doneText({ expected: e }: (typeof RT_PRESETS)[number]) {
  return `Done: ${count(e.reported.length, 'point')} reported, ${count(e.assocQueries, 'associated query', 'associated queries')}`
}

const byName = (name: string) => RT_PRESETS.find((p) => p.name === name)!

/** Page coordinates of a scene point (y-up, 775×480). */
async function toPage(page: Page, p: { x: number; y: number }) {
  const canvas = page.getByLabel('Drawing canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  return { x: box.x + (p.x / WIDTH) * box.width, y: box.y + (1 - p.y / HEIGHT) * box.height }
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 5 })
  await page.mouse.up()
}

async function selectPreset(page: Page, name: string) {
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(page.getByText(/^Step 1 \/ /)).toHaveCount(0)
  await page.getByLabel('Preset').selectOption({ label: name })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
}

const stepTotal = async (page: Page) =>
  Number((await page.getByText(/^Step \d+ \/ \d+$/).textContent())!.split('/')[1])

test('page opens on the step tab', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await expect(page.getByRole('heading', { level: 1, name: 'Range Tree' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Step by step' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  for (const title of ['Node', 'Result', 'Storage'])
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(page.getByLabel('Mode').locator('option')).toHaveText(['Build and query', 'Build only', 'Query only'])
  await expect(page.locator('.step-player-hint')).toHaveText(
    'Drag the points or the corners of the query rectangle. Keys: ← → to step, Space to play or pause.',
  )
  await page.waitForTimeout(200)
  expect(errors).toEqual([])
})

test('presets reach their pinned totals', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  for (const preset of RT_PRESETS) {
    await selectPreset(page, preset.name)
    const { nodes, storage, depth } = preset.expected
    const n = preset.input.points.length
    const bound = n * (depth + 1)
    await expect(panelRows(page, 'Storage').first()).toHaveText(
      `n = ${n} · main tree ${nodes} nodes · associated trees ${storage} leaves ${storage === bound ? '=' : '≤'} n·(depth + 1) = ${bound}`,
    )
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(description(page), preset.name).toHaveText(doneText(preset))
  }
  expect(errors).toEqual([])
})

test('query only skips the build', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  const preset = byName('Textbook example')
  const { nodes, storage } = preset.expected
  await selectPreset(page, preset.name)
  const full = await stepTotal(page)

  // build only: one step per main-tree node (2n − 1), the last one ending with the totals
  await page.getByLabel('Mode').selectOption({ label: 'Build only' })
  await expect(page.getByText(`Step 1 / ${nodes}`, { exact: true })).toBeVisible()
  await expect(description(page)).toHaveText(/^Node v1: 10 points, associated tree on y with 10 leaves; split at x = /)
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toHaveText(new RegExp(` · main tree ${nodes} nodes, associated trees ${storage} leaves$`))

  // query only: the query steps of the full run, from the split node to Done
  await page.getByLabel('Mode').selectOption({ label: 'Query only' })
  await expect(page.getByText(`Step 1 / ${full - nodes}`, { exact: true })).toBeVisible()
  await expect(description(page)).toHaveText(/^Split node /)
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toHaveText(doneText(preset))

  await page.getByLabel('Mode').selectOption({ label: 'Build and query' })
  await expect(page.getByText(`Step 1 / ${full}`, { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('dragging a corner changes the result', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  const preset = byName('Textbook example')
  const { query } = preset.input
  await selectPreset(page, preset.name)
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toHaveText(doneText(preset))

  // the upper-right corner, 40 units to the left and down: p7 drops out of the rectangle
  const from = await toPage(page, { x: query.x1, y: query.y1 })
  const to = await toPage(page, { x: query.x1 - 40, y: query.y1 - 40 })
  await drag(page, from, to)
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByLabel('Preset')).toHaveValue('')
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toHaveText(/^Done: /)
  await expect(description(page)).not.toHaveText(doneText(preset))
  await expect(panelRows(page, 'Result').first()).not.toContainText('p7')
  expect(errors).toEqual([])
})

test('code tab runs the demo', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await page.getByRole('tab', { name: 'Code' }).click()
  const log = page.getByRole('log')
  await expect(log.locator('.output-line', { hasText: /^\d+ point\(s\) in the range, storage \d+$/ })).toHaveCount(1)
  await expect(log.locator('.output-line.error')).toHaveCount(0)
  expect(errors).toEqual([])
})
