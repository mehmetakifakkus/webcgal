import { expect, test, type Page } from '@playwright/test'
import { SWEEP_PRESETS } from '../../src/geometry/algorithms/sweep/presets'

const PATH = 'algorithms/segmentIntersection'

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

const description = (page: Page) => page.locator('.step-player-description')

test('page opens on the step tab without errors', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await expect(page.getByRole('heading', { level: 1, name: 'Line Segment Intersection' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Step by step' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await expect(page.getByText('Event queue', { exact: true })).toBeVisible()
  await expect(page.getByText('Status structure', { exact: true })).toBeVisible()
  await page.waitForTimeout(200)
  expect(errors).toEqual([])
})

test('last step empties the status', async ({ page }) => {
  await page.goto(PATH)
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(page.getByText('Status is empty', { exact: true })).toBeVisible()
  await expect(page.getByText('Queue is empty', { exact: true })).toBeVisible()
})

test('presets reset the player and find the expected intersections', async ({ page }) => {
  await page.goto(PATH)
  const select = page.getByLabel('Preset')
  for (const preset of SWEEP_PRESETS) {
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(page.getByText(/^Step 1 \/ /)).toHaveCount(0)
    await select.selectOption({ label: preset.name })
    await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
    await page.getByRole('button', { name: 'Last' }).click()
    await expect(description(page)).toContainText(
      `Found ${preset.expected.points} intersection point(s) and ${preset.expected.overlaps} overlap(s)`,
    )
  }
})

test('dragging an endpoint restarts the player', async ({ page }) => {
  test.skip(!!process.env.BASE_URL, 'needs the e2e debug hook')
  await page.goto(PATH)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Step 4 \/ /)).toBeVisible()
  const box = (await page.getByLabel('Drawing canvas').boundingBox())!
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.activeLayer.children.length)
  // handles are the r=4 filled circles (bounds 8 wide), drawn last
  const pos = await page.evaluate(() => {
    const layer = window.__webcgalDebug!.scene.paper.project.activeLayer
    const c = layer.children.find(
      (i) => i.className === 'Path' && (i as paper.Path).closed && i.bounds.width === 8 && !!(i as paper.Path).fillColor,
    )!
    const view = window.__webcgalDebug!.scene.paper.view
    return { x: c.position.x / view.viewSize.width, y: 1 - c.position.y / view.viewSize.height }
  })
  const sx = box.x + pos.x * box.width
  const sy = box.y + pos.y * box.height
  const dx = pos.x > 0.5 ? -30 : 30 // stay inside the canvas
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + dx, sy, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
})

test('code tab runs the demo', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(PATH)
  await page.getByRole('tab', { name: 'Code' }).click()
  const log = page.getByRole('log')
  await expect(log.locator('.output-line', { hasText: /\d+ intersection point\(s\), \d+ overlap\(s\)/ })).toHaveCount(1)
  await expect(log.locator('.output-line.error')).toHaveCount(0)
  expect(errors).toEqual([])
})
