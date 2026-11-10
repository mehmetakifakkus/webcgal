// Renders the card thumbnail of an algorithm page from its step player.
// Uses the e2e build (it has the same player; nothing is built here). Start the preview first:
//   VITE_E2E=1 npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173
// then: npm run thumbnail:segmentIntersection   (BASE_URL overrides http://localhost:4173)
// Options (defaults: the Line Segment Intersection thumbnail):
//   --slug <slug>       page /algorithms/<slug>, written to public/images/<slug>_tn.png
//                       (smallestEnclosingDisk keeps the old site's file name, smallestDisk_tn.png)
//   --preset <name>     preset to select
//   --step <n>          step to show, 1-based (clamped to the last step); default: the middle step
//   --pad <f>           scale factor (0 < f ≤ 1) on top of the cover scale, leaving a margin around the
//                       drawing; default 0.94 when --slug is given, else 1 (the old segmentIntersection image)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    slug: { type: 'string' },
    preset: { type: 'string', default: 'Vertical and horizontal segments' },
    step: { type: 'string' },
    pad: { type: 'string' },
  },
});
const SLUG = args.slug ?? 'segmentIntersection';
const PAD = args.pad === undefined ? (args.slug === undefined ? 1 : 0.94) : Number(args.pad);
const PRESET = args.preset;
const STEP = args.step === undefined ? undefined : Number(args.step);
if (!/^[\w-]+$/.test(SLUG)) throw new Error(`thumbnail: bad --slug '${SLUG}'`);
if (STEP !== undefined && !(Number.isInteger(STEP) && STEP >= 1)) throw new Error(`thumbnail: --step must be a step number (1, 2, …), got '${args.step}'`);
if (!(PAD > 0 && PAD <= 1)) throw new Error(`thumbnail: --pad must be a number in (0, 1], got '${args.pad}'`);

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
// the file name of the card image (the registry's `thumbnail`), where it differs from the slug
const IMAGE = { smallestEnclosingDisk: 'smallestDisk' }[SLUG] ?? SLUG;
const OUT = fileURLToPath(new URL(`../public/images/${IMAGE}_tn.png`, import.meta.url));
// the size of the other thumbnails
const WIDTH = 413;
const HEIGHT = 232;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
  await page.goto(`${BASE_URL}/algorithms/${SLUG}`);
  await page.getByLabel('Preset').selectOption({ label: PRESET });
  await page.getByText(/^Step 1 \/ /).waitFor();
  const total = Number((await page.getByText(/^Step \d+ \/ \d+$/).textContent()).split('/')[1]);
  const next = page.getByRole('button', { name: 'Next' });
  // without --step: the middle step (the old behaviour)
  const target = Math.min(total, STEP ?? Math.round(total / 2));
  for (let i = 1; i < target; i++) await next.click();
  await page.waitForTimeout(300);
  // scale the canvas to cover the thumbnail (full height, sides cropped evenly), times the pad, in the page itself
  const dataUrl = await page.evaluate(
    ({ w, h, pad }) => {
      const src = document.querySelector('canvas[aria-label="Drawing canvas"]');
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const g = out.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, h);
      const scale = Math.max(w / src.width, h / src.height) * pad;
      const dw = src.width * scale;
      const dh = src.height * scale;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return out.toDataURL('image/png');
    },
    { w: WIDTH, h: HEIGHT, pad: PAD },
  );
  writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`thumbnail: wrote ${OUT}`);
} finally {
  await browser.close();
}
