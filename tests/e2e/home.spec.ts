import { expect, test, type Page } from '@playwright/test'
import { algorithms } from '../../src/registry'

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

test('home shows hero and CTAs', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Explore algorithms' }).click()
  await expect(page).toHaveURL(/\/algorithms$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Algorithms' })).toBeVisible()
  await page.goBack()
  await page.locator('main .features').getByRole('link', { name: 'API documentation' }).click()
  await expect(page).toHaveURL(/\/documentation$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible()
  await page.goBack()
  await page.getByRole('link', { name: 'Open the playground' }).click()
  await expect(page).toHaveURL(/\/playground$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Playground' })).toBeVisible()
  expect(errors).toEqual([])
})

test('home lists every algorithm', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('main .card')
  await expect(cards).toHaveCount(algorithms.length)
  expect(algorithms.length).toBe(6)
  for (const [i, a] of algorithms.entries()) {
    const card = cards.nth(i)
    await expect(card.getByRole('link', { name: a.name })).toHaveAttribute('href', a.path)
    if (a.player) await expect(card.getByText('Step-by-step')).toBeVisible()
    else await expect(card.getByText('Step-by-step')).toHaveCount(0)
  }
  const hull = cards.filter({ hasText: 'Convex Hull' })
  await expect(hull.getByText('Step-by-step')).toBeVisible()
})

test('mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Menu' })
  const main = page.getByRole('navigation', { name: 'Main' })
  await expect(button).toBeVisible()
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(main.getByRole('link', { name: 'Playground' })).toBeHidden()

  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(main.getByRole('link', { name: 'Playground' })).toBeVisible()
  await main.getByRole('link', { name: 'Algorithms', exact: true }).click()
  await expect(page).toHaveURL(/\/algorithms$/)
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(main.getByRole('link', { name: 'Playground' })).toBeHidden()

  await button.click()
  await expect(main.getByRole('link', { name: 'Playground' })).toBeVisible()
  await main.getByRole('link', { name: 'Playground' }).focus()
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(main.getByRole('link', { name: 'Playground' })).toBeHidden()
  await expect(button).toBeFocused()
})

test('menu button is not shown on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Playground' })).toBeVisible()
})

const canvasHash = (page: Page) =>
  page.locator('canvas.hull-background').evaluate((c: HTMLCanvasElement) => {
    const data = c.toDataURL()
    let h = 0
    for (let i = 0; i < data.length; i++) h = (h * 31 + data.charCodeAt(i)) | 0
    return `${c.width}x${c.height}:${h}`
  })

test('background animates', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('canvas.hull-background')
  await expect(canvas).toHaveAttribute('aria-hidden', 'true')
  await page.waitForTimeout(200)
  const a = await canvasHash(page)
  await page.waitForTimeout(500)
  expect(await canvasHash(page)).not.toBe(a)
})

test('reduced motion renders static background', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const canvas = page.locator('canvas.hull-background')
  await expect(canvas).toBeAttached()
  await expect(canvas).toHaveAttribute('aria-hidden', 'true')
  await page.waitForTimeout(200)
  const a = await canvasHash(page)
  await page.waitForTimeout(500)
  expect(await canvasHash(page)).toBe(a)
  // a frame was drawn: the canvas is not blank
  const painted = await canvas.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true
    return false
  })
  expect(painted).toBe(true)
})
