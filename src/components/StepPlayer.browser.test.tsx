import { expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import StepPlayer from './StepPlayer'
import type { PlayerModule } from '../players/types'
import type { Step } from '../geometry/steps'
import type { Pt, Segment } from '../geometry/types'

const LINES = ['zero', 'one', 'two', 'three', 'four']
const fake: PlayerModule<{ k: number }, Pt[]> = {
  computeSteps: () => LINES.map((_, k): Step<{ k: number }> => ({ description: `desc ${k}`, line: k, state: { k } })),
  render: () => {},
  pseudocode: LINES,
  randomInput: () => [
    { x: 100, y: 100 },
    { x: 200, y: 50 },
    { x: 300, y: 200 },
    { x: 400, y: 120 },
    { x: 500, y: 300 },
  ],
  handles: (pts) => pts,
  moveHandle: (pts, k, p) => pts.map((q, i) => (i === k ? p : q)),
}
const n = LINES.length

test('next/previous change counter', async () => {
  const screen = await render(<StepPlayer module={fake} />)
  await expect.element(screen.getByText(`Step 1 / ${n}`)).toBeVisible()
  await screen.getByRole('button', { name: 'Next' }).click()
  await expect.element(screen.getByText(`Step 2 / ${n}`)).toBeVisible()
  await expect.element(screen.getByText('desc 1')).toBeVisible()
  await screen.getByRole('button', { name: 'Previous' }).click()
  await expect.element(screen.getByText(`Step 1 / ${n}`)).toBeVisible()
})

test('last shows final step', async () => {
  const screen = await render(<StepPlayer module={fake} />)
  await screen.getByRole('button', { name: 'Last' }).click()
  await expect.element(screen.getByText(`Step ${n} / ${n}`)).toBeVisible()
  const active = document.querySelector('[aria-current="step"]')
  expect(active?.textContent).toBe(LINES[n - 1])
})

test('play advances and stops at end', async () => {
  const screen = await render(<StepPlayer module={fake} />)
  const slider = screen.getByLabelText('Speed')
  await slider.fill('10')
  await screen.getByRole('button', { name: 'Play' }).click()
  await expect.element(screen.getByText(`Step ${n} / ${n}`)).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible()
})

test('keyboard', async () => {
  const screen = await render(
    <>
      <StepPlayer module={fake} />
      <textarea aria-label="notes" />
    </>,
  )
  await userEvent.keyboard('{ArrowRight}')
  await expect.element(screen.getByText(`Step 2 / ${n}`)).toBeVisible()
  await screen.getByLabelText('notes').click()
  await userEvent.keyboard('{ArrowRight}')
  await expect.element(screen.getByText(`Step 2 / ${n}`)).toBeVisible()
})

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('Space on the page does not play while the player is out of view', async () => {
  const screen = await render(
    <>
      <div style={{ height: 4000 }} />
      <StepPlayer module={fake} />
    </>,
  )
  window.scrollTo(0, 0)
  ;(document.activeElement as HTMLElement | null)?.blur()
  expect(document.activeElement).toBe(document.body)
  await userEvent.keyboard(' ')
  await userEvent.keyboard('{ArrowRight}')
  await pause(600)
  expect(screen.getByRole('button', { name: 'Play' }).query()).not.toBeNull()
  expect(screen.getByText(`Step 1 / ${n}`).query()).not.toBeNull()
})

test('arrow keys on a focused tab do not step', async () => {
  const screen = await render(
    <>
      <div role="tablist" aria-label="Views">
        <button type="button" role="tab" aria-selected="true">
          Step by step
        </button>
      </div>
      <StepPlayer module={fake} />
    </>,
  )
  ;(screen.getByRole('tab').element() as HTMLElement).focus()
  await userEvent.keyboard('{ArrowRight}')
  await userEvent.keyboard(' ')
  await pause(400)
  await expect.element(screen.getByText(`Step 1 / ${n}`)).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible()
})

// a module whose input is not a point list: two segments, dragged by their four endpoints
const RANDOM_SEGMENTS: Segment[] = [
  { a: { x: 100, y: 100 }, b: { x: 300, y: 250 } },
  { a: { x: 450, y: 80 }, b: { x: 650, y: 300 } },
]
const PRESET_SEGMENTS: Segment[] = [
  { a: { x: 200, y: 300 }, b: { x: 500, y: 60 } },
  { a: { x: 200, y: 60 }, b: { x: 500, y: 300 } },
]
function makeSegmentModule() {
  const computeSteps = vi.fn((input: Segment[]) =>
    [0, 1, 2].map((n): Step<{ n: number }> => ({ description: `segment step ${n} of ${input.length}`, line: n, state: { n } })),
  )
  const moveHandle = vi.fn((input: Segment[], k: number, p: Pt): Segment[] =>
    input.map((s, i) => (i !== Math.floor(k / 2) ? s : k % 2 === 0 ? { a: p, b: s.b } : { a: s.a, b: p })),
  )
  const fakeSegmentModule: PlayerModule<{ n: number }, Segment[]> = {
    computeSteps,
    render: () => {},
    pseudocode: ['first', 'second', 'third'],
    randomInput: () => RANDOM_SEGMENTS,
    presets: [{ name: 'Two crossing', input: PRESET_SEGMENTS }],
    handles: (input) => input.flatMap((s) => [s.a, s.b]),
    moveHandle,
    panels: () => [{ title: 'Status structure', rows: [{ text: 's1', highlight: 'active' }] }],
  }
  return { fakeSegmentModule, computeSteps, moveHandle }
}

test('preset select replaces input and resets', async () => {
  const { fakeSegmentModule, computeSteps } = makeSegmentModule()
  const screen = await render(<StepPlayer module={fakeSegmentModule} />)
  await screen.getByRole('button', { name: 'Next' }).click()
  await expect.element(screen.getByText('Step 2 / 3')).toBeVisible()
  const select = screen.getByLabelText('Preset')
  await userEvent.selectOptions(select, 'Two crossing')
  await expect.element(screen.getByText('Step 1 / 3')).toBeVisible()
  expect(computeSteps).toHaveBeenLastCalledWith(PRESET_SEGMENTS)
  // the placeholder is selected again, so the same preset can be applied once more
  expect((select.element() as HTMLSelectElement).value).toBe('')
  expect(screen.getByRole('option', { name: 'Choose a preset…' }).query()).not.toBeNull()
})

test('panels are rendered', async () => {
  const { fakeSegmentModule } = makeSegmentModule()
  const screen = await render(<StepPlayer module={fakeSegmentModule} />)
  const panel = screen.getByRole('region', { name: 'Status structure' })
  await expect.element(panel.getByRole('heading', { name: 'Status structure' })).toBeVisible()
  await expect.element(panel.getByText('s1')).toHaveClass('state-row-active')
})

test('moveHandle onto another endpoint', async () => {
  const errors: unknown[] = []
  const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message)
  window.addEventListener('error', onError)
  try {
    const { fakeSegmentModule, computeSteps, moveHandle } = makeSegmentModule()
    const screen = await render(<StepPlayer module={fakeSegmentModule} />)
    await screen.getByRole('button', { name: 'Last' }).click()
    await expect.element(screen.getByText('Step 3 / 3')).toBeVisible()
    const canvas = screen.getByLabelText('Drawing canvas')
    const el = canvas.element() as HTMLCanvasElement
    const r = el.getBoundingClientRect()
    // scene coordinates are y-up; the default canvas is 775 x 360 scene units
    const at = (p: Pt) => ({ x: (p.x * r.width) / 775, y: ((360 - p.y) * r.height) / 360 })
    const [from, to] = [RANDOM_SEGMENTS[0].a, RANDOM_SEGMENTS[0].b]
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    await userEvent.pointer([
      { target: canvas, coords: at(from) },
      { keys: '[MouseLeft>]' },
      { target: canvas, coords: at(mid) },
      { target: canvas, coords: at(to) },
      { keys: '[/MouseLeft]' },
    ])
    await expect.element(screen.getByText(/^Step 1 \//)).toBeVisible()
    expect(moveHandle).toHaveBeenCalled()
    expect(moveHandle.mock.calls.every(([, k]) => k === 0)).toBe(true)
    const input = computeSteps.mock.lastCall![0]
    expect(input[0].a.x).toBeCloseTo(to.x, 0)
    expect(input[0].a.y).toBeCloseTo(to.y, 0)
    expect(input[0].b).toEqual(to)
    expect(input[1]).toEqual(RANDOM_SEGMENTS[1])
    expect(errors).toEqual([])
  } finally {
    window.removeEventListener('error', onError)
  }
})
