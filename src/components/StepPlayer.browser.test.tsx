import { expect, test, vi } from 'vitest'
import type paper from 'paper'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import StepPlayer from './StepPlayer'
import type { PlayerModule } from '../players/types'
import type { Step } from '../geometry/steps'
import type { KdInput, Pt, RangeTreeInput, Segment } from '../geometry/types'
import kdTreePlayer from '../players/kdTreePlayer'
import rangeTreePlayer from '../players/rangeTreePlayer'

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
  const value = () => (select.element() as HTMLSelectElement).value
  await userEvent.selectOptions(select, 'Two crossing')
  await expect.element(screen.getByText('Step 1 / 3')).toBeVisible()
  expect(computeSteps).toHaveBeenLastCalledWith(PRESET_SEGMENTS)
  // the loaded preset stays shown in the select
  expect(value()).toBe('0')
  expect(screen.getByRole('option', { name: 'Choose a preset…' }).query()).not.toBeNull()
  // choosing the placeholder does not apply preset 0
  const calls = computeSteps.mock.calls.length
  await userEvent.selectOptions(select, '')
  expect(computeSteps.mock.calls.length).toBe(calls)
  // "New random input" shows the placeholder again
  await userEvent.selectOptions(select, 'Two crossing')
  expect(value()).toBe('0')
  await screen.getByRole('button', { name: 'New random input' }).click()
  await expect.poll(value).toBe('')
  // so does dragging an endpoint
  await userEvent.selectOptions(select, 'Two crossing')
  expect(value()).toBe('0')
  const canvas = screen.getByLabelText('Drawing canvas')
  const r = (canvas.element() as HTMLCanvasElement).getBoundingClientRect()
  const at = (p: Pt) => ({ x: (p.x * r.width) / 775, y: ((360 - p.y) * r.height) / 360 })
  const from = PRESET_SEGMENTS[0].a
  await userEvent.pointer([
    { target: canvas, coords: at(from) },
    { keys: '[MouseLeft>]' },
    { target: canvas, coords: at({ x: from.x + 40, y: from.y - 40 }) },
    { keys: '[/MouseLeft]' },
  ])
  await expect.poll(value).toBe('')
})

test('hint text: default, or the module\'s own', async () => {
  const { fakeSegmentModule } = makeSegmentModule()
  const screen = await render(<StepPlayer module={fakeSegmentModule} />)
  await expect
    .element(screen.getByText('Drag the points to change the input. Keys: ← → to step, Space to play or pause.'))
    .toBeVisible()
  const custom = await render(<StepPlayer module={{ ...fakeSegmentModule, hint: 'Custom hint.' }} />)
  await expect.element(custom.getByText('Custom hint.')).toBeVisible()
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

// modes: the step count depends on the mode (3 in "a", 5 in "b")
const MODE_POINTS: Pt[] = [
  { x: 100, y: 100 },
  { x: 300, y: 250 },
  { x: 500, y: 120 },
]
const MODE_PRESET: Pt[] = [
  { x: 150, y: 80 },
  { x: 350, y: 300 },
  { x: 600, y: 200 },
]
function makeModesModule() {
  const computeSteps = vi.fn((_input: Pt[], mode?: string) =>
    Array.from({ length: mode === 'b' ? 5 : 3 }, (_, k): Step<{ k: number }> => ({
      description: `mode ${mode} step ${k}`,
      line: k,
      state: { k },
    })),
  )
  const fakeWithModes: PlayerModule<{ k: number }, Pt[]> = {
    modes: [
      { id: 'a', label: 'Mode A' },
      { id: 'b', label: 'Mode B' },
    ],
    computeSteps,
    render: () => {},
    pseudocode: LINES,
    randomInput: () => MODE_POINTS,
    presets: [{ name: 'Preset one', input: MODE_PRESET }],
    handles: (pts) => pts,
    moveHandle: (pts, k, p) => pts.map((q, i) => (i === k ? p : q)),
  }
  return { fakeWithModes, computeSteps }
}

test('mode select recomputes and resets', async () => {
  const { fakeWithModes, computeSteps } = makeModesModule()
  const screen = await render(<StepPlayer module={fakeWithModes} />)
  expect(computeSteps).toHaveBeenLastCalledWith(MODE_POINTS, 'a')
  await screen.getByRole('button', { name: 'Next' }).click()
  await expect.element(screen.getByText('Step 2 / 3')).toBeVisible()
  await userEvent.selectOptions(screen.getByLabelText('Mode'), 'Mode B')
  await expect.element(screen.getByText('Step 1 / 5')).toBeVisible()
  expect(computeSteps).toHaveBeenLastCalledWith(MODE_POINTS, 'b')
})

test('mode change during playback stops playback', async () => {
  const { fakeWithModes } = makeModesModule()
  const screen = await render(<StepPlayer module={fakeWithModes} />)
  await screen.getByLabelText('Speed').fill('1')
  await screen.getByRole('button', { name: 'Play' }).click()
  await expect.element(screen.getByRole('button', { name: 'Pause' })).toBeVisible()
  await userEvent.selectOptions(screen.getByLabelText('Mode'), 'Mode B')
  await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible()
  await expect.element(screen.getByText('Step 1 / 5')).toBeVisible()
})

test('drag and preset keep the mode', async () => {
  const { fakeWithModes, computeSteps } = makeModesModule()
  const screen = await render(<StepPlayer module={fakeWithModes} />)
  const mode = screen.getByLabelText('Mode')
  await userEvent.selectOptions(mode, 'Mode B')
  await expect.element(screen.getByText('Step 1 / 5')).toBeVisible()
  await userEvent.selectOptions(screen.getByLabelText('Preset'), 'Preset one')
  expect(computeSteps).toHaveBeenLastCalledWith(MODE_PRESET, 'b')
  await expect.element(screen.getByText('Step 1 / 5')).toBeVisible()
  const canvas = screen.getByLabelText('Drawing canvas')
  const r = (canvas.element() as HTMLCanvasElement).getBoundingClientRect()
  const at = (p: Pt) => ({ x: (p.x * r.width) / 775, y: ((360 - p.y) * r.height) / 360 })
  const from = MODE_PRESET[0]
  await userEvent.pointer([
    { target: canvas, coords: at(from) },
    { keys: '[MouseLeft>]' },
    { target: canvas, coords: at({ x: from.x + 40, y: from.y + 40 }) },
    { keys: '[/MouseLeft]' },
  ])
  await expect.poll(() => computeSteps.mock.lastCall![0][0].x).toBeCloseTo(from.x + 40, 0)
  expect(computeSteps.mock.lastCall![1]).toBe('b')
  await expect.element(screen.getByText(/^Step 1 \/ 5$/)).toBeVisible()
  expect((mode.element() as HTMLSelectElement).value).toBe('b')
})

// validation: the input is invalid while its first point has x < 50
const VALID_POINTS: Pt[] = [
  { x: 100, y: 180 },
  { x: 300, y: 250 },
  { x: 500, y: 120 },
]
function makeValidateModule() {
  const computeSteps = vi.fn((_input: Pt[], mode?: string) =>
    [0, 1, 2].map((k): Step<{ k: number }> => ({ description: `valid step ${k} ${mode}`, line: k, state: { k } })),
  )
  const render = vi.fn((_scene: unknown, _step: Step<{ k: number }>, _input: Pt[]) => {})
  const renderInvalid = vi.fn((_scene: unknown, _input: Pt[]) => {})
  const fakeWithValidate: PlayerModule<{ k: number }, Pt[]> = {
    modes: [
      { id: 'a', label: 'Mode A' },
      { id: 'b', label: 'Mode B' },
    ],
    computeSteps,
    render,
    renderInvalid,
    validate: (pts) => (pts[0].x < 50 ? 'Invalid input' : null),
    pseudocode: ['first', 'second', 'third'],
    randomInput: () => VALID_POINTS,
    presets: [{ name: 'Preset one', input: VALID_POINTS }],
    handles: (pts) => pts,
    moveHandle: (pts, k, p) => pts.map((q, i) => (i === k ? p : q)),
  }
  return { fakeWithValidate, computeSteps, render, renderInvalid }
}

async function dragFirstPointOut(screen: Awaited<ReturnType<typeof render>>, release: boolean) {
  const canvas = screen.getByLabelText('Drawing canvas')
  const r = (canvas.element() as HTMLCanvasElement).getBoundingClientRect()
  const at = (p: Pt) => ({ x: (p.x * r.width) / 775, y: ((360 - p.y) * r.height) / 360 })
  const from = VALID_POINTS[0]
  await userEvent.pointer([
    { target: canvas, coords: at(from) },
    { keys: '[MouseLeft>]' },
    { target: canvas, coords: at({ x: 20, y: from.y }) },
    ...(release ? [{ keys: '[/MouseLeft]' }] : []),
  ])
}

test('validate shows alert and disables controls', async () => {
  const { fakeWithValidate, computeSteps, renderInvalid } = makeValidateModule()
  const screen = await render(<StepPlayer module={fakeWithValidate} />)
  await screen.getByRole('button', { name: 'Next' }).click()
  await expect.element(screen.getByText('Step 2 / 3')).toBeVisible()
  try {
    await dragFirstPointOut(screen, false)
    await expect.element(screen.getByRole('alert')).toHaveTextContent('Invalid input')
    for (const name of ['First', 'Previous', 'Play', 'Next', 'Last'])
      await expect.element(screen.getByRole('button', { name })).toBeDisabled()
    await expect.element(screen.getByLabelText('Mode')).toBeDisabled()
    await expect.element(screen.getByLabelText('Preset')).toBeDisabled()
    await expect.element(screen.getByRole('button', { name: 'New random input' })).toBeEnabled()
    await expect.element(screen.getByText('Step – / –')).toBeVisible()
    await expect
      .element(screen.getByText('Release the mouse to return to the last valid polygon'))
      .toHaveClass('step-player-description')
    expect(renderInvalid).toHaveBeenCalled()
    expect(renderInvalid.mock.lastCall![1][0].x).toBeLessThan(50)
    // no steps are computed for an invalid input
    expect(computeSteps.mock.calls.every(([pts]) => pts[0].x >= 50)).toBe(true)
  } finally {
    await userEvent.pointer([{ keys: '[/MouseLeft]' }])
  }
})

test('validate reverts on release', async () => {
  const { fakeWithValidate, computeSteps, render: renderStep } = makeValidateModule()
  const screen = await render(<StepPlayer module={fakeWithValidate} />)
  await userEvent.selectOptions(screen.getByLabelText('Mode'), 'Mode B')
  await dragFirstPointOut(screen, true)
  await expect.element(screen.getByText(/^Step 1 \//)).toBeVisible()
  expect(screen.getByRole('alert').query()).toBeNull()
  const input = computeSteps.mock.lastCall![0]
  expect(fakeWithValidate.handles(input)[0]).toEqual(VALID_POINTS[0])
  expect(computeSteps.mock.lastCall![1]).toBe('b')
  expect(renderStep.mock.lastCall![2][0]).toEqual(VALID_POINTS[0])
  await expect.element(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
})

test('no alert for modules without validate', async () => {
  const screen = await render(<StepPlayer module={fake} />)
  await expect.element(screen.getByText(`Step 1 / ${n}`)).toBeVisible()
  expect(screen.getByRole('alert').query()).toBeNull()
  expect(screen.getByLabelText('Mode').query()).toBeNull()
})

// clickHandle: a press and release with < 3 px movement on a handle is a click
const CLICK_POINTS: Pt[] = [
  { x: 150, y: 120 },
  { x: 350, y: 260 },
  { x: 550, y: 140 },
]
const CLICK_PRESET: Pt[] = [
  { x: 200, y: 100 },
  { x: 400, y: 280 },
  { x: 600, y: 120 },
]
type ClickInput = { pts: Pt[]; on: number[] }
function makeClickModule() {
  const computeSteps = vi.fn((input: ClickInput, mode?: string) =>
    [0, 1].map((k): Step<{ k: number }> => ({ description: `on [${input.on.join(',')}] ${mode} ${k}`, line: k, state: { k } })),
  )
  const moveHandle = vi.fn((input: ClickInput, k: number, p: Pt, _mode?: string): ClickInput => ({
    pts: input.pts.map((q, i) => (i === k ? p : q)),
    on: input.on,
  }))
  const clickHandle = vi.fn(
    (input: ClickInput, k: number, _mode?: string): ClickInput => ({
      pts: input.pts,
      on: input.on.includes(k) ? input.on.filter((i) => i !== k) : [...input.on, k].sort((a, b) => a - b),
    }),
  )
  const module: PlayerModule<{ k: number }, ClickInput> = {
    modes: [
      { id: 'a', label: 'Mode A' },
      { id: 'b', label: 'Mode B' },
    ],
    computeSteps,
    render: () => {},
    pseudocode: ['first', 'second'],
    randomInput: () => ({ pts: CLICK_POINTS, on: [] }),
    presets: [{ name: 'Click preset', input: { pts: CLICK_PRESET, on: [] } }],
    handles: (input) => input.pts,
    moveHandle,
    clickHandle,
  }
  return { module, computeSteps, moveHandle, clickHandle }
}
function canvasAt(screen: Awaited<ReturnType<typeof render>>) {
  const canvas = screen.getByLabelText('Drawing canvas')
  const r = (canvas.element() as HTMLCanvasElement).getBoundingClientRect()
  // scene coordinates are y-up; the default canvas is 775 x 360 scene units
  const at = (p: Pt, dx = 0, dy = 0) => ({ x: (p.x * r.width) / 775 + dx, y: ((360 - p.y) * r.height) / 360 + dy })
  return { canvas, at }
}

test('a click on a handle calls clickHandle and recomputes', async () => {
  const { module, computeSteps, moveHandle, clickHandle } = makeClickModule()
  const screen = await render(<StepPlayer module={module} />)
  await userEvent.selectOptions(screen.getByLabelText('Mode'), 'Mode B')
  await screen.getByRole('button', { name: 'Next' }).click()
  await expect.element(screen.getByText('Step 2 / 2')).toBeVisible()
  const { canvas, at } = canvasAt(screen)
  await userEvent.pointer([
    { target: canvas, coords: at(CLICK_POINTS[1]) },
    { keys: '[MouseLeft>]' },
    { keys: '[/MouseLeft]' },
  ])
  await expect.element(screen.getByText('on [1] b 0')).toBeVisible()
  expect(clickHandle).toHaveBeenCalledTimes(1)
  expect(clickHandle.mock.lastCall![1]).toBe(1)
  // the module learns the mode it is clicked in
  expect(clickHandle.mock.lastCall![2]).toBe('b')
  expect(computeSteps.mock.lastCall![0].on).toEqual([1])
  expect(computeSteps.mock.lastCall![1]).toBe('b')
  await expect.element(screen.getByText('Step 1 / 2')).toBeVisible()
  // a wobble of under 3 px is still a click, and the handle does not move
  await userEvent.pointer([
    { target: canvas, coords: at(CLICK_POINTS[2]) },
    { keys: '[MouseLeft>]' },
    { target: canvas, coords: at(CLICK_POINTS[2], 1.5, 1) },
    { keys: '[/MouseLeft]' },
  ])
  await expect.element(screen.getByText('on [1,2] b 0')).toBeVisible()
  expect(moveHandle).not.toHaveBeenCalled()
  expect(computeSteps.mock.lastCall![0].pts).toEqual(CLICK_POINTS)
  // a click away from every handle does nothing
  const calls = computeSteps.mock.calls.length
  await userEvent.pointer([
    { target: canvas, coords: at({ x: 700, y: 330 }) },
    { keys: '[MouseLeft>]' },
    { keys: '[/MouseLeft]' },
  ])
  await pause(100)
  expect(clickHandle).toHaveBeenCalledTimes(2)
  expect(computeSteps.mock.calls.length).toBe(calls)
})

test('a drag of ≥ 3 px does not call clickHandle', async () => {
  const { module, computeSteps, moveHandle, clickHandle } = makeClickModule()
  const screen = await render(<StepPlayer module={module} />)
  const { canvas, at } = canvasAt(screen)
  const from = CLICK_POINTS[0]
  await userEvent.pointer([
    { target: canvas, coords: at(from) },
    { keys: '[MouseLeft>]' },
    { target: canvas, coords: at(from, 4, 0) },
    { target: canvas, coords: at({ x: from.x + 60, y: from.y + 30 }) },
    { keys: '[/MouseLeft]' },
  ])
  await expect.poll(() => computeSteps.mock.lastCall![0].pts[0].x).toBeCloseTo(from.x + 60, 0)
  expect(computeSteps.mock.lastCall![0].pts[0].y).toBeCloseTo(from.y + 30, 0)
  expect(moveHandle).toHaveBeenCalled()
  expect(moveHandle.mock.lastCall![3]).toBe('a')
  expect(clickHandle).not.toHaveBeenCalled()
  expect(computeSteps.mock.lastCall![0].on).toEqual([])
})

test('players without clickHandle keep their behaviour', async () => {
  const { fakeSegmentModule, computeSteps, moveHandle } = makeSegmentModule()
  const screen = await render(<StepPlayer module={fakeSegmentModule} />)
  await screen.getByRole('button', { name: 'Next' }).click()
  await expect.element(screen.getByText('Step 2 / 3')).toBeVisible()
  const { canvas, at } = canvasAt(screen)
  const from = RANDOM_SEGMENTS[0].a
  const calls = computeSteps.mock.calls.length
  // a click on a handle leaves the input (and the step) as it is
  await userEvent.pointer([
    { target: canvas, coords: at(from) },
    { keys: '[MouseLeft>]' },
    { keys: '[/MouseLeft]' },
  ])
  await pause(100)
  expect(computeSteps.mock.calls.length).toBe(calls)
  expect(moveHandle).not.toHaveBeenCalled()
  await expect.element(screen.getByText('Step 2 / 3')).toBeVisible()
  // the smallest movement still drags at once
  await userEvent.pointer([
    { target: canvas, coords: at(from) },
    { keys: '[MouseLeft>]' },
    { target: canvas, coords: at(from, 1, 0) },
    { keys: '[/MouseLeft]' },
  ])
  await expect.poll(() => moveHandle.mock.calls.length).toBeGreaterThan(0)
  await expect.element(screen.getByText('Step 1 / 3')).toBeVisible()
})

test('a click keeps the preset selection; a drag clears it', async () => {
  const { module, computeSteps, clickHandle } = makeClickModule()
  const screen = await render(<StepPlayer module={module} />)
  const select = screen.getByLabelText('Preset')
  const value = () => (select.element() as HTMLSelectElement).value
  await userEvent.selectOptions(select, 'Click preset')
  expect(value()).toBe('0')
  await screen.getByRole('button', { name: 'Next' }).click()
  await expect.element(screen.getByText('Step 2 / 2')).toBeVisible()
  const { canvas, at } = canvasAt(screen)
  await userEvent.pointer([
    { target: canvas, coords: at(CLICK_PRESET[1]) },
    { keys: '[MouseLeft>]' },
    { keys: '[/MouseLeft]' },
  ])
  await expect.element(screen.getByText('on [1] a 0')).toBeVisible()
  expect(clickHandle).toHaveBeenCalledTimes(1)
  // the steps are recomputed and start over, but the room is still the preset
  await expect.element(screen.getByText('Step 1 / 2')).toBeVisible()
  expect(computeSteps.mock.lastCall![0].pts).toEqual(CLICK_PRESET)
  expect(value()).toBe('0')
  // moving a handle changes the geometry: the placeholder shows again
  const from = CLICK_PRESET[0]
  await userEvent.pointer([
    { target: canvas, coords: at(from) },
    { keys: '[MouseLeft>]' },
    { target: canvas, coords: at({ x: from.x + 40, y: from.y + 40 }) },
    { keys: '[/MouseLeft]' },
  ])
  await expect.poll(value).toBe('')
})

test('StepPlayer passes the mode to handles; moveHandle gets indices into that list', async () => {
  // in mode b only the last two points are handles
  const handles = vi.fn((pts: Pt[], mode?: string) => (mode === 'b' ? pts.slice(1) : pts))
  const moveHandle = vi.fn((pts: Pt[], k: number, p: Pt, mode?: string) => {
    const i = mode === 'b' ? k + 1 : k
    return pts.map((q, j) => (j === i ? p : q))
  })
  const computeSteps = vi.fn((_pts: Pt[], _mode?: string) =>
    [0, 1].map((k): Step<{ k: number }> => ({ description: `step ${k}`, line: k, state: { k } })),
  )
  const module: PlayerModule<{ k: number }, Pt[]> = {
    modes: [
      { id: 'a', label: 'Mode A' },
      { id: 'b', label: 'Mode B' },
    ],
    computeSteps,
    render: () => {},
    // no renderInvalid: the player draws the handles itself
    validate: (pts) => (pts[1].x < 50 ? 'Invalid input' : null),
    pseudocode: ['first', 'second'],
    randomInput: () => MODE_POINTS,
    handles,
    moveHandle,
  }
  const screen = await render(<StepPlayer module={module} />)
  await userEvent.selectOptions(screen.getByLabelText('Mode'), 'Mode B')
  await expect.element(screen.getByText('Step 1 / 2')).toBeVisible()
  handles.mockClear()
  const { canvas, at } = canvasAt(screen)
  const from = MODE_POINTS[1]
  try {
    await userEvent.pointer([
      { target: canvas, coords: at(from) },
      { keys: '[MouseLeft>]' },
      { target: canvas, coords: at({ x: 20, y: from.y }) },
    ])
    await expect.element(screen.getByRole('alert')).toHaveTextContent('Invalid input')
    // grabbing (mouse down) and drawing the invalid input both ask for mode b's handles
    expect(handles.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(handles.mock.calls.every(([, mode]) => mode === 'b')).toBe(true)
    // the second point is handle 0 of mode b
    expect(moveHandle).toHaveBeenCalled()
    expect(moveHandle.mock.calls.every(([, k, , mode]) => k === 0 && mode === 'b')).toBe(true)
  } finally {
    await userEvent.pointer([{ keys: '[/MouseLeft]' }])
  }
  await expect.element(screen.getByText('Step 1 / 2')).toBeVisible()
  // mode a: every point is a handle
  await userEvent.selectOptions(screen.getByLabelText('Mode'), 'Mode A')
  handles.mockClear()
  moveHandle.mockClear()
  await userEvent.pointer([
    { target: canvas, coords: at(from) },
    { keys: '[MouseLeft>]' },
    { target: canvas, coords: at({ x: from.x + 40, y: from.y }) },
    { keys: '[/MouseLeft]' },
  ])
  await expect.poll(() => moveHandle.mock.calls.length).toBeGreaterThan(0)
  expect(handles.mock.calls.every(([, mode]) => mode === 'a')).toBe(true)
  expect(moveHandle.mock.calls.every(([, k]) => k === 1)).toBe(true)
})

test('modules without modes get handles(input)', async () => {
  const handles = vi.fn((pts: Pt[]) => pts)
  const screen = await render(<StepPlayer module={{ ...fake, handles }} />)
  await expect.element(screen.getByText(`Step 1 / ${n}`)).toBeVisible()
  const { canvas, at } = canvasAt(screen)
  await userEvent.pointer([{ target: canvas, coords: at({ x: 100, y: 100 }) }, { keys: '[MouseLeft>]' }, { keys: '[/MouseLeft]' }])
  await expect.poll(() => handles.mock.calls.length).toBeGreaterThan(0)
  expect(handles.mock.calls.every((args) => args.length === 1)).toBe(true)
})

/**
 * Presses at the input's point 0, which lies 5 units right of the query's lower-left corner,
 * and drags by (30, 20) in `mode`; returns the input the steps were last computed for.
 */
async function dragNearCorner<I extends KdInput | RangeTreeInput>(
  base: PlayerModule<unknown, I>,
  input: I,
  height: number,
  mode: string,
): Promise<I> {
  const computeSteps = vi.fn((inp: I, m?: string) => base.computeSteps(inp, m))
  const module: PlayerModule<unknown, I> = { ...base, randomInput: () => input, computeSteps }
  const screen = await render(<StepPlayer module={module} />)
  const label = base.modes!.find((m) => m.id === mode)!.label
  await userEvent.selectOptions(screen.getByLabelText('Mode'), label)
  await expect.poll(() => computeSteps.mock.lastCall?.[1]).toBe(mode)
  const canvas = screen.getByLabelText('Drawing canvas')
  const r = (canvas.element() as HTMLCanvasElement).getBoundingClientRect()
  const at = (p: Pt) => ({ x: (p.x * r.width) / 775, y: ((height - p.y) * r.height) / height })
  const from = input.points[0]
  const calls = computeSteps.mock.calls.length
  await userEvent.pointer([
    { target: canvas, coords: at(from) },
    { keys: '[MouseLeft>]' },
    { target: canvas, coords: at({ x: from.x + 15, y: from.y + 10 }) },
    { target: canvas, coords: at({ x: from.x + 30, y: from.y + 20 }) },
    { keys: '[/MouseLeft]' },
  ])
  await expect.poll(() => computeSteps.mock.calls.length).toBeGreaterThan(calls)
  await pause(50)
  await screen.unmount()
  return computeSteps.mock.lastCall![0]
}

for (const [name, base, height] of [
  ['kd-tree', kdTreePlayer, 360],
  ['range tree', rangeTreePlayer, 480],
] as const)
  test(`${name}: the handles follow the mode (a corner 5 units from a point)`, async () => {
    const preset = base.presets!.find((p) => p.name === 'Textbook example')!.input as KdInput
    const { x0, y0 } = preset.query
    const input = { points: [{ x: x0 + 5, y: y0 }, ...preset.points.slice(1)], query: { ...preset.query } }
    const from = input.points[0]
    const module = base as unknown as PlayerModule<unknown, KdInput>
    const close = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < 1.5
    // Query only: the press grabs the corner; the point stays put
    const query = await dragNearCorner(module, input, height, 'query')
    expect(query.points).toEqual(input.points)
    expect(close({ x: query.query.x0, y: query.query.y0 }, { x: from.x + 30, y: from.y + 20 })).toBe(true)
    expect([query.query.x1, query.query.y1]).toEqual([input.query.x1, input.query.y1])
    // Build only, and Build and query as before: the same press moves the point
    for (const mode of ['build', 'full']) {
      const moved = await dragNearCorner(module, input, height, mode)
      expect(moved.query).toEqual(input.query)
      expect(close(moved.points[0], { x: from.x + 30, y: from.y + 20 })).toBe(true)
      expect(moved.points.slice(1)).toEqual(input.points.slice(1))
    }
  })

// canvas text: scaled up (at most 1.6 times) when the canvas is shown smaller than its scene size
type Shown = { size: number; onScreen: number; point: { x: number; y: number }; scale: number }
function makeTextModule() {
  const render = vi.fn((scene: import('../engine/scene').Scene, step: Step<{ k: number }>) => {
    const P = scene.paper
    P.activate()
    scene.clear()
    // y-flipped back, like the players' labels; a nested one too
    new P.PointText({ matrix: new P.Matrix(1, 0, 0, -1, 200, 150), content: `label ${step.state.k}`, fontSize: 12, justification: 'center', name: 'label' })
    new P.Group([new P.PointText({ point: [400, 100], content: 'small', fontSize: 9, name: 'small' })])
  })
  const module: PlayerModule<{ k: number }, Pt[]> = { ...fake, render }
  return { module, render }
}
function shownText(name: string): Shown {
  const scene = window.__webcgalDebug!.scene
  const item = scene.paper.project.getItem({ name }) as paper.PointText
  const canvas = scene.paper.view.element as HTMLCanvasElement
  const scale = canvas.getBoundingClientRect().width / scene.paper.view.viewSize.width
  const size = Number(item.fontSize)
  return { size, onScreen: size * scale, point: { x: item.point.x, y: item.point.y }, scale }
}

test('canvas text is scaled up on a 320 px wide canvas, at most 1.6 times', async () => {
  await page.viewport(400, 800)
  try {
    const { module, render: renderStep } = makeTextModule()
    const screen = await render(
      <div data-testid="box" style={{ width: 320 }}>
        <StepPlayer module={module} />
      </div>,
    )
    await expect.poll(() => renderStep.mock.calls.length).toBeGreaterThan(0)
    await expect.poll(() => shownText('label').size).toBeCloseTo(12 * 1.6, 6)
    const label = shownText('label')
    expect(label.scale).toBeLessThan(0.45)
    expect(label.onScreen).toBeGreaterThanOrEqual(7.5)
    // the anchor stays where the module put it
    expect(label.point).toEqual({ x: 200, y: 150 })
    expect(shownText('small').size).toBeCloseTo(9 * 1.6, 6)
    expect(shownText('small').point).toEqual({ x: 400, y: 100 })
    // later renders and resizes do not compound
    for (let k = 0; k < 3; k++) await screen.getByRole('button', { name: 'Next' }).click()
    await expect.element(screen.getByText('Step 4 / 5')).toBeVisible()
    await expect.poll(() => (window.__webcgalDebug!.scene.paper.project.getItem({ name: 'label' }) as paper.PointText).content).toBe('label 3')
    expect(shownText('label').size).toBeCloseTo(12 * 1.6, 6)
    const box = screen.getByTestId('box').element() as HTMLElement
    // 620 px: s = 0.8, the factor is 1 / s
    box.style.width = '620px'
    await expect.poll(() => shownText('label').scale).toBeCloseTo(0.8, 2)
    await expect.poll(() => shownText('label').size).toBeCloseTo(12 / shownText('label').scale, 4)
    expect(shownText('label').onScreen).toBeCloseTo(12, 4)
    box.style.width = '320px'
    await expect.poll(() => shownText('label').size).toBeCloseTo(12 * 1.6, 6)
    box.style.width = '620px'
    await expect.poll(() => shownText('label').size).toBeCloseTo(12 / shownText('label').scale, 4)
    expect(shownText('label').point).toEqual({ x: 200, y: 150 })
    expect(shownText('small').size).toBeCloseTo(9 / shownText('small').scale, 4)
  } finally {
    await page.viewport(1280, 800)
  }
})

test('canvas text keeps its size on a full-size canvas', async () => {
  const { module, render: renderStep } = makeTextModule()
  const screen = await render(<StepPlayer module={module} />)
  await expect.poll(() => renderStep.mock.calls.length).toBeGreaterThan(0)
  await screen.getByRole('button', { name: 'Next' }).click()
  await expect.poll(() => (window.__webcgalDebug!.scene.paper.project.getItem({ name: 'label' }) as paper.PointText).content).toBe('label 1')
  await pause(100)
  expect(shownText('label').scale).toBeCloseTo(1, 6)
  expect(shownText('label').size).toBe(12)
  expect(shownText('small').size).toBe(9)
})
