import { expect, test } from '@playwright/test';

test('home loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Algorithms', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a missing route chunk (stale page after a redeploy) reloads the page once', async ({ page }) => {
  let failed = 0;
  await page.route(/\/assets\/AlgorithmsIndex-[^/]+\.js$/, (route) => {
    if (failed++ === 0) return route.fulfill({ status: 404, body: 'Not Found' });
    return route.continue();
  });
  await page.goto('/');
  await page.evaluate(() => ((window as unknown as { __beforeReload: boolean }).__beforeReload = true));
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Algorithms' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Algorithms' })).toBeVisible();
  expect(failed).toBe(2);
  expect(await page.evaluate(() => (window as unknown as { __beforeReload?: boolean }).__beforeReload)).toBeUndefined();
  expect(await page.evaluate(() => sessionStorage.getItem('webcgal:chunk-reload'))).toBeNull();
});
