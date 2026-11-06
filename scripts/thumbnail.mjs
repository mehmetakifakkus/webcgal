// Renders the card thumbnail of the Line Segment Intersection page from the step player.
// Uses the e2e build (it has the same player; nothing is built here). Start the preview first:
//   VITE_E2E=1 npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173
// then: npm run thumbnail:segmentIntersection   (BASE_URL overrides http://localhost:4173)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = fileURLToPath(new URL('../public/images/segmentIntersection_tn.png', import.meta.url));
const PRESET = 'Vertical and horizontal segments';
// the size of the other thumbnails
const WIDTH = 413;
const HEIGHT = 232;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
  await page.goto(`${BASE_URL}/algorithms/segmentIntersection`);
  await page.getByLabel('Preset').selectOption({ label: PRESET });
  await page.getByText(/^Step 1 \/ /).waitFor();
  const total = Number((await page.getByText(/^Step \d+ \/ \d+$/).textContent()).split('/')[1]);
  const next = page.getByRole('button', { name: 'Next' });
  for (let i = 1; i < Math.round(total / 2); i++) await next.click();
  await page.waitForTimeout(300);
  // scale the canvas to cover the thumbnail (full height, sides cropped evenly) in the page itself
  const dataUrl = await page.evaluate(
    ({ w, h }) => {
      const src = document.querySelector('canvas[aria-label="Drawing canvas"]');
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const g = out.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, h);
      const scale = Math.max(w / src.width, h / src.height);
      const dw = src.width * scale;
      const dh = src.height * scale;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return out.toDataURL('image/png');
    },
    { w: WIDTH, h: HEIGHT },
  );
  writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`thumbnail: wrote ${OUT}`);
} finally {
  await browser.close();
}
