// Canvas text on a phone-sized canvas, with the real players: labels the players lay out
// themselves (art gallery) and labels below a marker (kd-tree and range tree leaves).
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type paper from 'paper'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import StepPlayer from './StepPlayer'
import type { PlayerModule } from '../players/types'
import type { Pt } from '../geometry/types'
import artGalleryPlayer from '../players/artGalleryPlayer'
import kdTreePlayer from '../players/kdTreePlayer'
import rangeTreePlayer from '../players/rangeTreePlayer'

beforeEach(async () => {
  await page.viewport(375, 900)
})
afterEach(async () => {
  await page.viewport(1280, 800)
})

const scene = () => window.__webcgalDebug!.scene
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Every drawn item that is not a group or layer. */
const drawn = () =>
  (scene().paper.project.getItems({ recursive: true }) as paper.Item[]).filter((i) => i.className !== 'Group' && i.className !== 'Layer')
const texts = () => drawn().filter((i): i is paper.PointText => i.className === 'PointText')
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6

/** Mounts `base` with a computeSteps spy; returns the screen and the spy. */
async function mount<S, I>(base: PlayerModule<S, I>) {
  const computeSteps = vi.fn((input: I, mode?: string) => base.computeSteps(input, mode))
  const screen = await render(<StepPlayer module={{ ...base, computeSteps }} />)
  await expect.poll(() => computeSteps.mock.calls.length).toBeGreaterThan(0)
  const canvas = screen.getByLabelText('Drawing canvas').element() as HTMLCanvasElement
  // a phone: the canvas is shown at less than half its size, so the text is enlarged 1.6 times
  expect(canvas.getBoundingClientRect().width / 775).toBeLessThan(0.5)
  return { screen, computeSteps }
}

/**
 * The box of a y-flipped label's glyphs, in scene units (y up): its width, and from the baseline
 * up 0.72 em (digits and lower case; the labels have no descenders). paper's own bounds are the
 * line box, 1.2 em tall, which reaches well past the glyphs.
 */
function glyphBox(t: paper.PointText): paper.Rectangle {
  const P = scene().paper
  const size = Number(t.fontSize)
  return new P.Rectangle(new P.Point(t.bounds.left, t.point.y), new P.Point(t.bounds.right, t.point.y + 0.72 * size))
}

async function show(screen: Awaited<ReturnType<typeof render>>, presetName: string, button: 'First' | 'Last') {
  if (presetName) await userEvent.selectOptions(screen.getByLabelText('Preset'), presetName)
  await screen.getByRole('button', { name: button }).click()
  await pause(80)
}

test('art gallery at 375 px: no label on a corner mark or camera, none outside the canvas', async () => {
  const { screen, computeSteps } = await mount(artGalleryPlayer)
  const problems: string[] = []
  for (const { name } of artGalleryPlayer.presets!) {
    for (const button of ['First', 'Last'] as const) {
      await show(screen, name, button)
      const poly = (computeSteps.mock.lastCall![0] as { polygon: Pt[] }).polygon
      const labels = texts()
      expect(labels).toHaveLength(poly.length)
      // labels are enlarged on this canvas
      expect(Number(labels[0].fontSize)).toBeGreaterThan(13 * 1.5)
      // small filled shapes: corner discs and camera squares
      const markers = drawn().filter(
        (i): i is paper.Path => i.className === 'Path' && Boolean(i.fillColor) && i.bounds.width > 0 && i.bounds.width <= 16 && i.bounds.height <= 16,
      )
      labels.forEach((t, i) => {
        const own = markers.filter((m) => near(m.bounds.center.x, poly[i].x) && near(m.bounds.center.y, poly[i].y))
        if (own.some((m) => glyphBox(t).intersects(m.bounds))) problems.push(`${name} ${button}: ${t.content} on its mark`)
        else if (markers.some((m) => glyphBox(t).intersects(m.bounds))) problems.push(`${name} ${button}: ${t.content} on another mark`)
        const b = t.bounds
        if (b.left < 0 || b.top < 0 || b.right > 775 || b.bottom > 360) problems.push(`${name} ${button}: ${t.content} outside`)
      })
    }
  }
  expect(problems).toEqual([])
})

/** Leaf circles with their labels below them: the label's text box must not reach the circle. */
function leafLabelClashes(circles: paper.Item[]): string[] {
  const out: string[] = []
  for (const c of circles) {
    const { x, y } = c.bounds.center
    const label = texts().find((t) => near(t.point.x, x) && t.point.y < y - c.bounds.height / 2)
    if (!label) continue
    if (label.bounds.intersects(c.bounds)) out.push(String(label.content))
  }
  return out
}

for (const [name, base, leaves] of [
  [
    'kd-tree',
    kdTreePlayer,
    // leaf circles (r 5) in the tree area, right of the separator
    () => drawn().filter((i) => i.className === 'Path' && (i as paper.Path).closed && i.bounds.center.x > 465 && near(i.bounds.width, 10)),
  ],
  [
    'range tree',
    rangeTreePlayer,
    // leaves of the main tree and of the associated tree (r 4)
    () => drawn().filter((i) => /^(main-|assoc-node-leaf-)/.test(i.name ?? '') && near(i.bounds.width, 8)),
  ],
] as const)
  test(`${name} at 375 px: leaf labels stay clear of their leaf circles`, async () => {
    const { screen } = await mount(base as PlayerModule<unknown, unknown>)
    let checked = 0
    for (const button of ['Last', 'First'] as const) {
      await show(screen, 'Textbook example', button)
      const circles = leaves()
      if (button === 'Last') expect(circles.length).toBeGreaterThan(5)
      checked += circles.length
      expect(leafLabelClashes(circles)).toEqual([])
    }
    expect(checked).toBeGreaterThan(5)
    // the leaf labels are enlarged
    expect(Math.max(...texts().map((t) => Number(t.fontSize)))).toBeGreaterThan(12)
  })

test("on a desktop-width canvas (679 px) every label keeps the module's size and place", async () => {
  await page.viewport(400, 800)
  for (const [base, preset] of [
    [artGalleryPlayer, 'Comb'],
    [kdTreePlayer, 'Textbook example'],
    [rangeTreePlayer, 'Textbook example'],
  ] as const) {
    const screen = await render(
      <div style={{ width: 679 }}>
        <StepPlayer module={base as PlayerModule<unknown, unknown>} />
      </div>,
    )
    await show(screen, preset, 'Last')
    const canvas = screen.getByLabelText('Drawing canvas').element() as HTMLCanvasElement
    expect(canvas.getBoundingClientRect().width / 775).toBeCloseTo(679 / 775, 3)
    expect(scene().textScale).toBe(1)
    const labels = texts()
    expect(labels.length).toBeGreaterThan(5)
    for (const t of labels) {
      const data = t.data as { baseFontSize?: number; basePoint?: paper.Point; fixedSize?: boolean }
      if (data.fixedSize) continue
      expect(Number(t.fontSize)).toBe(data.baseFontSize)
      expect(t.point.equals(data.basePoint!)).toBe(true)
    }
    if (base === artGalleryPlayer) expect(labels.every((t) => Number(t.fontSize) === 13)).toBe(true)
    await screen.unmount()
  }
})

test('kd-tree at 375 px: split labels above their squares stay clear of them', async () => {
  const { screen } = await mount(kdTreePlayer as PlayerModule<unknown, unknown>)
  await show(screen, 'Textbook example', 'Last')
  // split squares (12 × 12) in the tree area; the labels centred above them (the halo and the text)
  const squares = drawn().filter((i) => i.className === 'Path' && (i as paper.Path).closed && i.bounds.center.x > 465 && near(i.bounds.width, 12) && near(i.bounds.height, 12))
  expect(squares.length).toBeGreaterThan(5)
  let checked = 0
  const clashes: string[] = []
  for (const sq of squares) {
    const { x, y } = sq.bounds.center
    for (const t of texts().filter((t) => near(t.point.x, x) && t.point.y > y)) {
      checked++
      expect(Number(t.fontSize)).toBeGreaterThan(9 * 1.5)
      if (t.bounds.intersects(sq.bounds)) clashes.push(String(t.content))
    }
  }
  expect(checked).toBeGreaterThan(5)
  expect(clashes).toEqual([])
})
