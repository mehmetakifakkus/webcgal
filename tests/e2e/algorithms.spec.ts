import { expect, test, type Page } from '@playwright/test'

const pages = [
  { path: 'algorithms/convexHull', title: 'Convex Hull' },
  { path: 'algorithms/smallestEnclosingDisk', title: 'Smallest Enclosing Disk' },
  { path: 'algorithms/L-monoton', title: 'L-monotone Polygon' },
  { path: 'algorithms/duality/dualLine', title: 'Dual Line' },
  { path: 'algorithms/duality/checkStabber', title: 'Check Stabber' },
]

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

/** Pages with a step player open on "Step by step"; the demo code is on the Code tab. */
async function openCodeTab(page: Page) {
  await page.getByRole('tab', { name: 'Code' }).click()
}

const errorLines = (page: Page) => page.getByRole('log').locator('.output-line.error')

test('each algorithm page runs its demo', async ({ page }) => {
  const errors = collectErrors(page)
  for (const { path, title } of pages) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await openCodeTab(page)
    await expect(page.getByRole('textbox', { name: 'Code editor' })).toBeVisible()
    await expect(page.getByLabel('Drawing canvas')).toBeVisible()
    // let a few frames run
    await page.waitForTimeout(300)
    await expect(errorLines(page)).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

test('algorithms index lists 12 cards and the Duality group', async ({ page }) => {
  await page.goto('algorithms')
  await expect(page.locator('main .card')).toHaveCount(12)
  await expect(page.getByRole('heading', { name: 'Duality' })).toBeVisible()
})

test('duality index lists 2 cards', async ({ page }) => {
  await page.goto('algorithms/duality')
  await expect(page.locator('main .card')).toHaveCount(2)
  await expect(page.locator('main .card').first()).toContainText('Dual Line')
})

test('unknown algorithm shows 404', async ({ page }) => {
  await page.goto('algorithms/nope')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('navigating between algorithms leaves no errors', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('algorithms/convexHull')
  const menu = page.getByRole('navigation', { name: 'Algorithms' })
  for (const { name, title } of [
    { name: 'L-monotone Polygon', title: 'L-monotone Polygon' },
    { name: 'Dual Line', title: 'Dual Line' },
    { name: 'Convex Hull', title: 'Convex Hull' },
  ]) {
    await menu.getByRole('link', { name, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await openCodeTab(page)
    await page.waitForTimeout(300)
    await expect(errorLines(page)).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

test('drag works at 375px width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('algorithms/convexHull')
  await openCodeTab(page)
  await expect(page.getByLabel('Drawing canvas')).toBeVisible()
  await page.getByLabel('Drawing canvas').scrollIntoViewIfNeeded()
  await page.waitForFunction(() => window.__webcgalDebug?.scene.paper.project.getItem({ name: '_p0' }))

  // points[0] is the TextPoint drawn as the path named "_p0". Find a whole
  // screen pixel (mouse events report integer coordinates) inside it that is
  // not covered by a hull line drawn on top of it.
  const before = await page.evaluate(() => {
    const scene = window.__webcgalDebug!.scene
    const { project, view } = scene.paper
    const item = project.getItem({ name: '_p0' }) as paper.Path
    const tp = item.data.textPoint as { pos: paper.Point }
    const rect = (view.element as HTMLCanvasElement).getBoundingClientRect()
    const scale = rect.width / view.viewSize.width
    const center = view.projectToView(item.parent.localToGlobal(item.position))
    const cx = Math.round(rect.left + center.x * scale)
    const cy = Math.round(rect.top + center.y * scale)
    for (let r = 0; r <= 2; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++) {
          const [x, y] = [cx + dx, cy + dy]
          const p = view.viewToProject(new scene.paper.Point((x - rect.left) / scale, (y - rect.top) / scale))
          if (project.hitTest(p, { fill: true, stroke: true, tolerance: 0 })?.item === item)
            return { x, y, scale, pos: { x: tp.pos.x, y: tp.pos.y } }
        }
    throw new Error('points[0] is covered')
  })
  expect(before.scale).toBeLessThan(1)

  await page.mouse.move(before.x, before.y)
  await page.mouse.down()
  await page.mouse.move(before.x + 10, before.y + 10, { steps: 2 })
  await page.mouse.move(before.x + 20, before.y + 20, { steps: 2 })
  await page.mouse.up()

  const after = await page.evaluate(() => {
    const item = window.__webcgalDebug!.scene.paper.project.getItem({ name: '_p0' })!
    const { pos } = item.data.textPoint as { pos: paper.Point }
    return { x: pos.x, y: pos.y }
  })
  const expected = 20 / before.scale
  // screen y grows downwards, scene y grows upwards
  expect(Math.abs(after.x - before.pos.x - expected)).toBeLessThan(1.5)
  expect(Math.abs(after.y - before.pos.y + expected)).toBeLessThan(1.5)
})

test('tabs follow the ARIA tabs pattern', async ({ page }) => {
  await page.goto('algorithms/convexHull')
  const steps = page.getByRole('tab', { name: 'Step by step' })
  const code = page.getByRole('tab', { name: 'Code' })
  await expect(steps).toHaveAttribute('aria-selected', 'true')
  await expect(steps).toHaveAttribute('tabindex', '0')
  await expect(code).toHaveAttribute('tabindex', '-1')
  await expect(code).not.toHaveAttribute('aria-controls')
  const panelId = await steps.getAttribute('aria-controls')
  await expect(page.locator(`[id="${panelId}"]`)).toHaveRole('tabpanel')

  await steps.focus()
  await page.keyboard.press('ArrowRight')
  await expect(code).toBeFocused()
  await expect(code).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', { name: 'Code editor' })).toBeVisible()
  await page.keyboard.press('ArrowRight') // wraps
  await expect(steps).toBeFocused()
  await page.keyboard.press('End')
  await expect(code).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Home')
  await expect(steps).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(code).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Step \d+ \/ /)).toHaveCount(0)
})
