import { expect, test, type Page } from '@playwright/test'
import { GALLERY_PRESETS } from '../../src/geometry/algorithms/artGallery/presets'
import { coverage } from '../../src/geometry/algorithms/artGallery/visibility'

const PATH = 'algorithms/artGallery'

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

const count = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`

/** The done description a preset ends with, built from the pinned `expected` values only. */
function doneText({ expected: { cameras, n } }: (typeof GALLERY_PRESETS)[number]) {
  return `Done: ${count(cameras, 'camera')} for ${n} vertices (⌊${n}/3⌋ = ${Math.floor(n / 3)})`
}

const byName = (name: string) => GALLERY_PRESETS.find((p) => p.name === name)!

/** Page coordinates of a scene point (y-up, 775×360). */
async function toPage(page: Page, p: { x: number; y: number }) {
  const canvas = page.getByLabel('Drawing canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  return { x: box.x + (p.x / 775) * box.width, y: box.y + (1 - p.y / 360) * box.height }
}

async function selectPreset(page: Page, name: string) {
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(page.getByText(/^Step 1 \/ /)).toHaveCount(0)
  await page.getByLabel('Preset').selectOption({ label: name })
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
}

test('page opens on the step tab', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await expect(page.getByRole('heading', { level: 1, name: 'Art Gallery Problem' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Step by step' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Colours', exact: true })).toBeVisible()
  await expect(page.getByLabel('Mode').locator('option')).toHaveText(["Fisk's construction", 'Place your own cameras'])
  await expect(page.locator('.step-player-hint')).toHaveText(
    'Drag the corners to change the room; in the camera mode, click a corner to place or remove a camera. Keys: ← → to step, Space to play or pause.',
  )
  await page.waitForTimeout(200)
  expect(errors).toEqual([])
})

test('presets reach the expected totals', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  for (const preset of GALLERY_PRESETS) {
    await selectPreset(page, preset.name)
    // n + 3 steps: lines 1, 2, 3, one line 6 per further triangle, 7, 8 and 9
    await expect(page.getByText(`Step 1 / ${preset.expected.n + 3}`, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(description(page)).toHaveText(doneText(preset))
  }
  expect(errors).toEqual([])
})

test('comb needs four cameras', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  const comb = byName('Comb')
  expect(comb.expected).toEqual({ cameras: 4, n: 12 })
  await selectPreset(page, 'Comb')
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toHaveText('Done: 4 cameras for 12 vertices (⌊12/3⌋ = 4)')
  await expect(panelRows(page, 'Cameras')).toHaveCount(4)
  await expect(panelRows(page, 'Coverage')).toHaveText(['n = 12 · ⌊n/3⌋ = 4 · cameras 4 · covered 100%'])
  // the chosen colour class is highlighted and has the four cameras
  await expect(panelRows(page, 'Colours').and(page.locator('.state-row-active'))).toHaveText(/ · 4$/)
  expect(errors).toEqual([])
})

test('sandbox: clicking a corner places a camera', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  const room = byName('L-shaped gallery')
  const poly = room.polygon
  const n = poly.length
  await selectPreset(page, room.name)
  await page.getByLabel('Mode').selectOption({ label: 'Place your own cameras' })
  await expect(page.getByText('Step 1 / 1', { exact: true })).toBeVisible()
  await expect(description(page)).toHaveText('No cameras yet: click a corner to place one')
  await expect(page.getByRole('region', { name: 'Cameras', exact: true })).toContainText('No cameras yet')

  // v2, the far end of the lower wing: it sees only part of the room
  const part = coverage(poly, [1])
  expect(part.covered).toBe(false)
  const pct = Math.min(part.percent, 99)
  let p = await toPage(page, poly[1])
  await page.mouse.click(p.x, p.y)
  await expect(description(page)).toHaveText(`1 camera · ${pct}% covered`)
  await expect(panelRows(page, 'Cameras')).toHaveText([`v2 sees ${pct}% of the room`])
  await expect(panelRows(page, 'Coverage')).toHaveText([`n = ${n} · ⌊n/3⌋ = 2 · cameras 1 · covered ${pct}%`])
  // the preset stays selected
  await expect(page.getByLabel('Preset')).toHaveValue(String(GALLERY_PRESETS.indexOf(room)))

  // a second click removes it
  p = await toPage(page, poly[1])
  await page.mouse.click(p.x, p.y)
  await expect(description(page)).toHaveText('No cameras yet: click a corner to place one')

  // v4, the inner corner, sees both wings
  expect(coverage(poly, [3]).covered).toBe(true)
  p = await toPage(page, poly[3])
  await page.mouse.click(p.x, p.y)
  await expect(description(page)).toHaveText("Room covered with 1 camera (Fisk's bound: ⌊6/3⌋ = 2)")
  await expect(panelRows(page, 'Cameras')).toHaveText(['v4 sees 100% of the room'])

  // back in Fisk's construction the room is unchanged
  await page.getByLabel('Mode').selectOption({ label: "Fisk's construction" })
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(description(page)).toHaveText(doneText(room))
  expect(errors).toEqual([])
})

test('code tab runs the demo', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await page.getByRole('tab', { name: 'Code' }).click()
  const log = page.getByRole('log')
  await expect(log.locator('.output-line', { hasText: /^\d+ camera\(s\) for \d+ vertices$/ })).toHaveCount(1)
  await expect(log.locator('.output-line.error')).toHaveCount(0)
  expect(errors).toEqual([])
})
