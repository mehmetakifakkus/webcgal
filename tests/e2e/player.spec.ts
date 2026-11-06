import { expect, test } from '@playwright/test'

test('step by step tab is the default and works without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/algorithms/convexHull')
  await expect(page.getByRole('tab', { name: 'Step by step' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(page.locator('[aria-current="step"]')).toHaveCount(1)
  await page.waitForTimeout(200)
  expect(errors).toEqual([])
})

test('new random points restart the player', async ({ page }) => {
  await page.goto('/algorithms/convexHull')
  await page.getByRole('button', { name: 'Last' }).click()
  await expect(page.getByText(/^Step 1 \/ /)).toHaveCount(0)
  await page.getByRole('button', { name: 'New random points' }).click()
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
})

test('dragging a point restarts the player', async ({ page }) => {
  await page.goto('/algorithms/convexHull')
  await page.getByRole('button', { name: 'Last' }).click()
  const box = (await page.getByLabel('Drawing canvas').boundingBox())!
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.activeLayer.children.length)
  // find a point: the first circle drawn is a point (hull lines come first, so look for a Circle by shape)
  const pos = await page.evaluate(() => {
    const layer = window.__webcgalDebug!.scene.paper.project.activeLayer
    const c = layer.children.find((i) => i.className === 'Path' && (i as paper.Path).closed && i.bounds.width === 12)!
    const view = window.__webcgalDebug!.scene.paper.view
    return { x: c.position.x / view.viewSize.width, y: 1 - c.position.y / view.viewSize.height }
  })
  const sx = box.x + pos.x * box.width
  const sy = box.y + pos.y * box.height
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 20, sy + 10, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByText(/^Step 1 \/ /)).toBeVisible()
})
