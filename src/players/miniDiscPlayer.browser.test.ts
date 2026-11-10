import { afterEach, expect, test } from 'vitest'
import paper from 'paper'
import { createScene, type Scene } from '../engine/scene'
import { minidisc } from '../geometry/algorithms/minidisc/minidisc'
import { MINIDISC_PRESETS } from '../geometry/algorithms/minidisc/presets'
import { distance } from '../geometry/primitives'
import miniDiscPlayer from './miniDiscPlayer'

const scenes: Scene[] = []
afterEach(() => {
  scenes.splice(0).forEach((s) => s.dispose())
})
function makeScene() {
  const canvas = document.createElement('canvas')
  canvas.width = 775
  canvas.height = 360
  document.body.appendChild(canvas)
  const scene = createScene(canvas)
  scenes.push(scene)
  return scene
}
const paths = (scene: Scene) =>
  scene.paper.project.activeLayer.children.filter((c): c is paper.Path => c instanceof scene.paper.Path)
/** Path.Circle items are closed four-segment paths. */
const circles = (scene: Scene) => paths(scene).filter((p) => p.closed && p.segments.length === 4)
const isDashed = (p: paper.Path) => !!p.dashArray && p.dashArray.length > 0
const dashedCircles = (scene: Scene) => circles(scene).filter(isDashed)

const preset = (name: string) => {
  const p = MINIDISC_PRESETS.find((x) => x.name === name)!
  return { points: p.points, order: p.order }
}

test('random input: 12 points, pairwise ≥ 25, order is a permutation', () => {
  for (let k = 0; k < 20; k++) {
    const { points, order } = miniDiscPlayer.randomInput()
    expect(points).toHaveLength(12)
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(93)
      expect(p.x).toBeLessThanOrEqual(682)
      expect(p.y).toBeGreaterThanOrEqual(43)
      expect(p.y).toBeLessThanOrEqual(317)
    }
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) expect(distance(points[i], points[j])).toBeGreaterThanOrEqual(25)
    expect([...order].sort((a, b) => a - b)).toEqual([...Array(12).keys()])
  }
})

test('render is pure', () => {
  const scene = makeScene()
  const input = preset('Acute triangle')
  const before = JSON.stringify(input)
  const steps = miniDiscPlayer.computeSteps(input)
  const pick = [
    steps[0],
    steps.find((s) => s.line === 2)!,
    steps.find((s) => s.state.testing)!,
    steps.find((s) => s.state.newDisk)!,
    steps.find((s) => s.state.returned)!,
    steps[steps.length - 1],
  ]
  for (const step of pick) expect(step).toBeDefined()
  for (const step of pick) {
    const snap = JSON.stringify(step)
    miniDiscPlayer.render(scene, step, input)
    const n = scene.paper.project.activeLayer.children.length
    miniDiscPlayer.render(scene, step, input)
    expect(scene.paper.project.activeLayer.children.length).toBe(n)
    expect(n).toBeGreaterThan(0)
    expect(JSON.stringify(step)).toBe(snap)
  }
  expect(JSON.stringify(input)).toBe(before)
  // tiny inputs: no points, one point
  for (const tiny of [{ points: [], order: [] }, { points: [{ x: 100, y: 100 }], order: [0] }]) {
    for (const step of miniDiscPlayer.computeSteps(tiny)) {
      miniDiscPlayer.render(scene, step, tiny)
      miniDiscPlayer.panels!(step, tiny)
    }
  }
})

test('test step colours the point by the result', () => {
  const scene = makeScene()
  const input = preset('Random example')
  const steps = miniDiscPlayer.computeSteps(input)
  const inside = steps.find((s) => s.state.testing?.inside === true)!
  const outside = steps.find((s) => s.state.testing?.inside === false)!
  expect(inside).toBeDefined()
  expect(outside).toBeDefined()
  for (const [step, colour] of [
    [inside, '#26a269'],
    [outside, '#c01c28'],
  ] as const) {
    miniDiscPlayer.render(scene, step, input)
    const q = input.points[step.state.testing!.point]
    const dot = circles(scene).filter(
      (p) => Math.abs(p.bounds.center.x - q.x) < 1e-6 && Math.abs(p.bounds.center.y - q.y) < 1e-6 && Math.abs(p.bounds.width / 2 - 7) < 1e-6,
    )
    expect(dot).toHaveLength(1)
    expect(dot[0].fillColor!.toCSS(true)).toBe(colour)
  }
})

test('outer discs are dashed, one per outer frame', () => {
  const scene = makeScene()
  const input = preset('Bad order')
  const steps = miniDiscPlayer.computeSteps(input)
  const depth2 = steps.find((s) => s.line === 13 && s.state.stack.length === 2)!
  const depth3 = steps.find((s) => (s.line === 16 || s.line === 18) && s.state.stack.length === 3)!
  expect(depth2).toBeDefined()
  expect(depth3).toBeDefined()
  for (const step of [depth2, depth3]) {
    miniDiscPlayer.render(scene, step, input)
    const dashed = dashedCircles(scene)
    expect(dashed).toHaveLength(step.state.stack.length - 1)
    // each one is an outer frame's disc
    step.state.stack.slice(0, -1).forEach((f, i) => {
      expect(dashed[i].bounds.center.x).toBeCloseTo(f.disk.center.x, 6)
      expect(dashed[i].bounds.center.y).toBeCloseTo(f.disk.center.y, 6)
      expect(dashed[i].bounds.width / 2).toBeCloseTo(f.disk.radius, 6)
    })
  }
  // outside any call: no dashed disc
  miniDiscPlayer.render(scene, steps.find((s) => s.line === 2)!, input)
  expect(dashedCircles(scene)).toHaveLength(0)
})

test('done disc equals minidisc().disk', () => {
  const scene = makeScene()
  for (const p of MINIDISC_PRESETS) {
    const input = { points: p.points, order: p.order }
    const steps = miniDiscPlayer.computeSteps(input)
    miniDiscPlayer.render(scene, steps[steps.length - 1], input)
    const { disk } = minidisc(p.points, p.order)
    const thick = circles(scene).filter((c) => c.strokeWidth === 3 && !isDashed(c))
    expect(thick).toHaveLength(1)
    expect(Math.abs(thick[0].bounds.center.x - disk!.center.x)).toBeLessThan(1e-6)
    expect(Math.abs(thick[0].bounds.center.y - disk!.center.y)).toBeLessThan(1e-6)
    expect(Math.abs(thick[0].bounds.width / 2 - disk!.radius)).toBeLessThan(1e-6)
  }
})

test('moveHandle keeps the order', () => {
  const input = preset('Random example')
  expect(miniDiscPlayer.handles(input)).toEqual(input.points)
  const moved = miniDiscPlayer.moveHandle(input, 3, { x: 400, y: 10 })
  expect(moved.order).toEqual(input.order)
  expect(moved.points[3]).toEqual({ x: 400, y: 10 })
  expect(input.points[3]).not.toEqual({ x: 400, y: 10 })
  expect(moved.points.filter((_, i) => i !== 3)).toEqual(input.points.filter((_, i) => i !== 3))
  const steps = miniDiscPlayer.computeSteps(moved)
  expect(steps[steps.length - 1].state.phase).toBe('done')
  expect(steps[steps.length - 1].state.order).toEqual(input.order)
})

test('panels by phase', () => {
  const input = preset('Bad order')
  const steps = miniDiscPlayer.computeSteps(input)
  const titles = ['Call stack', 'Order', 'Disc']
  const init = miniDiscPlayer.panels!(steps[0], input)
  expect(init.map((p) => p.title)).toEqual(titles)
  expect(init[0].rows).toHaveLength(0)
  expect(init[0].empty).toBe('Not started')
  expect(init[1].rows.map((r) => r.text)).toEqual(input.order.map((i) => `v${i + 1}`))
  expect(init[2].rows).toHaveLength(0)
  expect(init[2].empty).toBe('No disc yet')

  const label = (i: number) => `v${i + 1}`
  const inner = steps.find((s) => s.line === 18 && s.state.stack.length === 3)!
  const [stack, order, disc] = miniDiscPlayer.panels!(inner, input)
  const [f0, f1, f2] = inner.state.stack
  expect(stack.rows.map((r) => r.text)).toEqual([
    `MiniDisc · i = ${f0.index + 1} of ${f0.prefix}`,
    `MiniDiscWithPoint(q = ${label(f1.fixed[0])}) · j = ${f1.index + 1} of ${f1.prefix}`,
    `MiniDiscWith2Points(q₁ = ${label(f2.fixed[1])}, q₂ = ${label(f2.fixed[0])}) · k = ${f2.index + 1} of ${f2.prefix}`,
  ])
  expect(stack.rows.map((r) => r.highlight)).toEqual([undefined, undefined, 'active'])
  expect(order.rows.filter((r) => r.highlight === 'active').map((r) => r.text)).toEqual([label(inner.state.current!)])
  expect(order.rows.filter((r) => r.highlight === 'new').map((r) => r.text).sort()).toEqual(f2.fixed.map(label).sort())
  expect(disc.rows.map((r) => r.text)).toEqual([
    `centre (${inner.state.disk!.center.x.toFixed(1)}, ${inner.state.disk!.center.y.toFixed(1)})`,
    `radius ${inner.state.disk!.radius.toFixed(1)}`,
    `tests ${inner.state.tests} · updates ${inner.state.updates}`,
  ])

  const done = miniDiscPlayer.panels!(steps[steps.length - 1], input)
  expect(done[0].rows.map((r) => r.text)).toEqual([`MiniDisc · i = ${input.points.length} of ${input.points.length}`])
  const result = minidisc(input.points, input.order)
  const ids = result.boundary.map(label)
  expect(done[2].rows.map((r) => r.text)).toEqual([
    `centre (${result.disk!.center.x.toFixed(1)}, ${result.disk!.center.y.toFixed(1)})`,
    `radius ${result.disk!.radius.toFixed(1)}`,
    `defined by ${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`,
    `tests ${result.tests} · updates ${result.updates}`,
  ])
})

test('call stack rows, literally (Bad order, v2 tested inside the innermost call)', () => {
  const input = preset('Bad order')
  const steps = miniDiscPlayer.computeSteps(input)
  const step = steps.find((s) => s.line === 18 && s.description === 'v2 is inside D → keep D')!
  expect(step).toBeDefined()
  expect(step.state.stack.map((f) => [f.proc, f.prefix, f.index, f.fixed])).toEqual([
    ['MiniDisc', 10, 3, []],
    ['WithPoint', 3, 2, [3]],
    ['With2Points', 2, 1, [3, 2]],
  ])
  expect(miniDiscPlayer.panels!(step, input)[0].rows.map((r) => r.text)).toEqual([
    'MiniDisc · i = 4 of 10',
    'MiniDiscWithPoint(q = v4) · j = 3 of 3',
    'MiniDiscWith2Points(q₁ = v3, q₂ = v4) · k = 2 of 2',
  ])
})

test('presets expose six names', () => {
  expect(miniDiscPlayer.presets!.map((p) => p.name)).toEqual(MINIDISC_PRESETS.map((p) => p.name))
  expect(miniDiscPlayer.presets).toHaveLength(6)
  expect(miniDiscPlayer.presets![0].input).toEqual({ points: MINIDISC_PRESETS[0].points, order: MINIDISC_PRESETS[0].order })
  expect(miniDiscPlayer.canvas).toEqual({ width: 775, height: 360 })
  expect(miniDiscPlayer.hint).toBe('Drag the points to change the input; the order stays. Keys: ← → to step, Space to play or pause.')
})
