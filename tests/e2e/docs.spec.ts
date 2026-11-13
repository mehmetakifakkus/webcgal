import { expect, test, type Page } from '@playwright/test';
import { BASE_PATH } from './base';

const items = [
  'Polygon', 'TextPoint', 'Points', 'Vector', 'clearScreen', 'clearLog', 'draw', 'createPolygon', 'createRandomPolygon', 'isMonotone',
  'createRandom', 'sort', 'shuffle', 'getRandomInt', 'animate', 'convexHull', 'findIntersections', 'triangulate', 'delaunay', 'voronoi', 'kdTree', 'rangeTree', 'artGallery', 'findStabber', 'loop', 'mouseDown', 'smallestEnclosingDisk', 'getCenterAndRadius', 'getTextPoint',
];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('documentation index lists all items by category', async ({ page }) => {
  await page.goto('documentation');
  await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible();
  for (const title of ['Objects', 'Drawing functions', 'Polygon functions', 'Points functions', 'Misc functions']) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  for (const item of items) {
    await expect(page.locator('main').getByRole('link', { name: item, exact: true })).toBeVisible();
  }
});

test('every documentation page opens without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  for (const item of items) {
    await page.goto(`documentation/${item}`);
    await expect(page.getByRole('heading', { level: 1, name: item, exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeVisible();
    await page.waitForTimeout(150);
  }
  expect(errors).toEqual([]);
});

test('sidebar navigation switches pages', async ({ page }) => {
  await page.goto('documentation/Polygon');
  await page.getByRole('navigation', { name: 'Documentation' }).getByRole('link', { name: 'sort', exact: true }).click();
  await expect(page).toHaveURL(/\/documentation\/sort$/);
  await expect(page.getByRole('heading', { level: 1, name: 'sort' })).toBeVisible();
});

test('converted links point to documentation pages', async ({ page }) => {
  await page.goto('documentation/Points');
  await expect(page.locator(`article a[href="${BASE_PATH}/documentation/createRandom"]`).first()).toBeVisible();
});

test('unknown item is not found, case-sensitively', async ({ page }) => {
  await page.goto('documentation/polygon');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.goto('documentation/nope');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('Try it opens the example in the playground', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('documentation/createRandom');
  await page.getByRole('link', { name: 'Try it' }).click();
  await expect(page).toHaveURL(/\/playground\?example=createRandom$/);
  await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText('Points.createRandom(5)');
  await expect(page.getByRole('log').locator('.output-line.error')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Try it link exists exactly where an example exists', async ({ page }) => {
  await page.goto('documentation/sort');
  await expect(page.getByRole('link', { name: 'Try it' })).toHaveCount(0);
  await page.goto('documentation/animate');
  await expect(page.getByRole('link', { name: 'Try it' })).toHaveAttribute('href', `${BASE_PATH}/playground?example=animate`);
});

test('example link does not overwrite saved playground code', async ({ page }) => {
  await page.goto('playground');
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('var saved = 1;');
  await page.waitForTimeout(600);
  await page.goto('playground?example=Polygon');
  await expect(editor).toContainText("createPolygon('star')");
  await page.waitForTimeout(600);
  await page.goto('playground');
  await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText('var saved = 1;');
});

test('unknown example value is ignored', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('playground?example=../../x');
  await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText("createPolygon('square')");
  await page.goto('playground?example=toString');
  await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText("createPolygon('square')");
  expect(errors).toEqual([]);
});

test('preview runs on item pages that have one', async ({ page }) => {
  await page.goto('documentation/createRandom');
  await expect(page.locator('article').getByLabel('Drawing canvas')).toBeVisible();
  await expect(page.locator('article').getByRole('log').locator('.output-line.error')).toHaveCount(0);
});

test('on a narrow screen the sidebar is a select', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('documentation/Polygon');
  await expect(page.getByRole('link', { name: 'sort', exact: true })).toHaveCount(0);
  await page.getByLabel('Documentation item').selectOption('sort');
  await expect(page).toHaveURL(/\/documentation\/sort$/);
  await expect(page.getByRole('heading', { level: 1, name: 'sort' })).toBeVisible();
});

test('internal MDX links navigate in the app; external ones open a new tab', async ({ page }) => {
  await page.goto('documentation/Points');
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  await page.locator('.prose').getByRole('link', { name: 'createRandom' }).first().click();
  await expect(page).toHaveURL(/\/documentation\/createRandom$/);
  await expect(page.getByRole('heading', { level: 1, name: 'createRandom' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

  await page.goto('algorithms/L-monoton');
  const external = page.locator('.prose').getByRole('link', { name: 'wiki/Monotone_polygon' });
  await expect(external).toHaveAttribute('target', '_blank');
  await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
});

test('29 pages, "Try it" on exactly 23 of them', async ({ page }) => {
  expect(items).toHaveLength(29);
  let withExample = 0;
  for (const item of items) {
    await page.goto(`documentation/${item}`);
    await expect(page.getByRole('heading', { level: 1, name: item, exact: true })).toBeVisible();
    withExample += await page.getByRole('link', { name: 'Try it' }).count();
  }
  expect(withExample).toBe(23);
});

/** Where the link of `name` is in the sidebar's scroll box, and how the sidebar and the page are scrolled. */
async function sidebarState(page: Page, name: string) {
  return page.evaluate((name) => {
    const nav = document.querySelector('nav.docs-nav')!;
    const link = [...nav.querySelectorAll('a')].find((a) => a.textContent === name)!;
    const n = nav.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    return {
      scrolls: nav.scrollHeight > nav.clientHeight,
      navScrollTop: nav.scrollTop,
      inside: l.top >= n.top - 0.5 && l.bottom <= n.bottom + 0.5,
      active: link.getAttribute('aria-current') === 'page',
      windowScrollY: window.scrollY,
    };
  }, name);
}

test('the sidebar shows the active item, without scrolling the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('documentation/getTextPoint');
  await expect(page.getByRole('heading', { level: 1, name: 'getTextPoint' })).toBeVisible();
  await page.waitForTimeout(200);
  const loaded = await sidebarState(page, 'getTextPoint');
  // the list is taller than the sidebar here, so it has to scroll for the last item
  expect(loaded.scrolls).toBe(true);
  expect(loaded).toMatchObject({ inside: true, active: true, windowScrollY: 0 });
  expect(loaded.navScrollTop).toBeGreaterThan(0);

  // from the top of the list, scroll the sidebar down and click an item near the bottom
  await page.goto('documentation/Polygon');
  await expect(page.getByRole('heading', { level: 1, name: 'Polygon' })).toBeVisible();
  expect((await sidebarState(page, 'Polygon')).navScrollTop).toBe(0);
  const nav = page.getByRole('navigation', { name: 'Documentation' });
  await nav.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await nav.getByRole('link', { name: 'smallestEnclosingDisk', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'smallestEnclosingDisk' })).toBeVisible();
  await page.waitForTimeout(200);
  expect(await sidebarState(page, 'smallestEnclosingDisk')).toMatchObject({ inside: true, active: true });
});
