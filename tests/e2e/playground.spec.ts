import { expect, test } from '@playwright/test';

const templates = ['Square polygon', 'Random polygon', 'Drag a polygon point', 'Radial points'];

test('playground runs templates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/playground');
  for (const label of templates) {
    await page.getByLabel('Template').selectOption({ label });
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('log').locator('.output-line.error')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('code persists', async ({ page }) => {
  await page.goto('/playground');
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('var persisted = 42;');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText('var persisted = 42;');
});

test('playground works without localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('textbox', { name: 'Code editor' })).toBeVisible();
  await expect(page.getByRole('log').locator('.output-line.error')).toHaveCount(0);
  expect(errors).toEqual([]);
});
