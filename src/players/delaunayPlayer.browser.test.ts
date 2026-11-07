import { afterEach, expect, test } from 'vitest'
import paper from 'paper'
import { createScene, type Scene } from '../engine/scene'
import { delaunay } from '../geometry/algorithms/delaunay/delaunay'
import { DELAUNAY_PRESETS } from '../geometry/algorithms/delaunay/presets'
import { highestIndex } from '../geometry/algorithms/delaunay/symbolic'
import { distance } from '../geometry/primitives'
import delaunayPlayer from './delaunayPlayer'

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
const dashedCircles = (scene: Scene) =>
  paths(scene).filter((p) => p.closed && p.segments.length === 4 && !!p.dashArray && p.dashArray.length > 0)
const filledTriangles = (scene: Scene) =>
  paths(scene).filter((p) => p.closed && p.segments.length === 3 && !!p.fillColor)

const textbook = () => {
  const p = DELAUNAY_PRESETS.find((x) => x.name === 'Textbook example')!
  return { points: p.points, order: p.order }
}

test('random input: 12 points, pairwise ≥ 25, order is a permutation excluding p0', () => {
  for (let k = 0; k < 20; k++) {
    const { points, order } = delaunayPlayer.randomInput()
    expect(points).toHaveLength(12)
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(93)
      expect(p.x).toBeLessThanOrEqual(682)
      expect(p.y).toBeGreaterThanOrEqual(43)
      expect(p.y).toBeLessThanOrEqual(317)
    }
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) expect(distance(points[i], points[j])).toBeGreaterThanOrEqual(25)
    const p0 = highestIndex(points)
    expect([...order].sort((a, b) => a - b)).toEqual([...Array(12).keys()].filter((i) => i !== p0))
  }
})

test('moveHandle keeps order and changing p0 does not throw', () => {
  const input = textbook()
  const p0 = highestIndex(input.points)
  expect(delaunayPlayer.handles(input)).toEqual(input.points)
  const moved = delaunayPlayer.moveHandle(input, p0, { x: 400, y: 10 })
  expect(moved.order).toEqual(input.order)
  expect(moved.points[p0]).toEqual({ x: 400, y: 10 })
  expect(input.points[p0]).not.toEqual({ x: 400, y: 10 })
  expect(highestIndex(moved.points)).not.toBe(p0)
  const steps = delaunayPlayer.computeSteps(moved)
  expect(steps[steps.length - 1].state.phase).toBe('done')
  expect(steps[steps.length - 1].state.triangles).toHaveLength(delaunay(moved.points, moved.order).triangles.length)
})

test('validate rejects coincident points, accepts distinct', () => {
  const pts = [{ x: 10, y: 10 }, { x: 50, y: 20 }, { x: 30, y: 60 }]
  expect(delaunayPlayer.validate!({ points: pts, order: [0, 1] })).toBeNull()
  expect(delaunayPlayer.validate!({ points: [...pts, { x: 50, y: 20 }], order: [0, 1, 3] })).toBe('Points must be distinct')
  // closer than 2 canvas units counts as coincident
  expect(delaunayPlayer.validate!({ points: [...pts, { x: 51, y: 20 }], order: [] })).toBe('Points must be distinct')
  expect(delaunayPlayer.validate!({ points: [...pts, { x: 51.2, y: 21.2 }], order: [] })).toBe('Points must be distinct')
  expect(delaunayPlayer.validate!({ points: [...pts, { x: 52, y: 20 }], order: [] })).toBeNull()
  expect(delaunayPlayer.validate!({ points: [...pts, { x: 53, y: 22 }], order: [] })).toBeNull()
  const scene = makeScene()
  delaunayPlayer.renderInvalid!(scene, { points: [...pts, { x: 50, y: 20 }], order: [] })
  expect(scene.paper.project.activeLayer.children.length).toBeGreaterThanOrEqual(4)
})

test('render is pure', () => {
  const scene = makeScene()
  const input = textbook()
  const before = JSON.stringify(input)
  const steps = delaunayPlayer.computeSteps(input)
  const pick = [
    steps[0],
    steps.find((s) => s.line === 6)!,
    steps.find((s) => s.line === 16 && !s.state.testing)!,
    steps.find((s) => s.state.circle)!,
    steps.find((s) => s.state.flipped)!,
    steps[steps.length - 1],
  ]
  for (const step of pick) {
    const snap = JSON.stringify(step)
    delaunayPlayer.render(scene, step, input)
    const n = scene.paper.project.activeLayer.children.length
    delaunayPlayer.render(scene, step, input)
    expect(scene.paper.project.activeLayer.children.length).toBe(n)
    expect(n).toBeGreaterThan(0)
    expect(JSON.stringify(step)).toBe(snap)
  }
  expect(JSON.stringify(input)).toBe(before)
})

test('render draws the dashed circumcircle on a testing step with real vertices', () => {
  const scene = makeScene()
  const input = textbook()
  const steps = delaunayPlayer.computeSteps(input)
  const step = steps.find((s) => s.state.circle)!
  expect(step.state.testing).toBeDefined()
  delaunayPlayer.render(scene, step, input)
  const circles = dashedCircles(scene)
  expect(circles).toHaveLength(1)
  const { center, radius } = step.state.circle!
  expect(circles[0].bounds.center.x).toBeCloseTo(center.x, 3)
  expect(circles[0].bounds.center.y).toBeCloseTo(center.y, 3)
  expect(circles[0].bounds.width / 2).toBeCloseTo(radius, 3)
  // no circle on a step without one
  delaunayPlayer.render(scene, steps[0], input)
  expect(dashedCircles(scene)).toHaveLength(0)
})

test('done step fills exactly delaunay().triangles.length triangles', () => {
  const scene = makeScene()
  for (const p of DELAUNAY_PRESETS) {
    const input = { points: p.points, order: p.order }
    const steps = delaunayPlayer.computeSteps(input)
    delaunayPlayer.render(scene, steps[steps.length - 1], input)
    expect(filledTriangles(scene)).toHaveLength(delaunay(p.points, p.order).triangles.length)
  }
})

test('panels by phase', () => {
  const input = textbook()
  const steps = delaunayPlayer.computeSteps(input)
  const titles = ['Insertion order', 'Flip stack', 'Triangles']
  const init = delaunayPlayer.panels!(steps[0], input)
  expect(init.map((p) => p.title)).toEqual(titles)
  expect(init[0].rows.map((r) => r.text)).toEqual(input.order.map((i) => `v${i + 1}`))
  expect(init[1].rows).toHaveLength(0)
  expect(init[1].empty).toBe('Stack is empty')
  expect(init[2].rows).toHaveLength(0)
  expect(init[2].empty).toBe('No triangles yet')

  const legalize = steps.filter((s) => s.state.phase === 'legalize')
  expect(legalize.length).toBeGreaterThan(0)
  for (const step of legalize) {
    const [order, stack] = delaunayPlayer.panels!(step, input)
    expect(order.rows.filter((r) => r.highlight === 'active').map((r) => r.text)).toEqual([`v${step.state.current! + 1}`])
    // the stack rows (top first), plus the popped entry under test highlighted as 'testing'
    const plain = stack.rows.filter((r) => r.highlight !== 'testing')
    expect(plain).toHaveLength(step.state.stack.length)
    expect(stack.rows.filter((r) => r.highlight === 'testing')).toHaveLength(step.state.testing ? 1 : 0)
    for (const r of stack.rows) expect(r.text).toMatch(/^(v\d+|p₋[₁₂])–(v\d+|p₋[₁₂])$/)
  }

  // a split step marks its new real triangles, a located step its located triangle
  // (the textbook order never lands in a real triangle; "Two clusters" does)
  const clusters = delaunayPlayer.presets!.find((p) => p.name === 'Two clusters')!.input
  const located = delaunayPlayer
    .computeSteps(clusters)
    .find((s) => s.state.located && !s.state.located.t.some((v) => v < 0))!
  const tri = delaunayPlayer.panels!(located, clusters)[2]
  expect(tri.rows.filter((r) => r.highlight === 'active').map((r) => r.text)).toEqual([
    located.state.located!.t.map((v) => `v${v + 1}`).join(' '),
  ])
  const flip = steps.find((s) => s.state.flipped && !s.state.flipped.to.some((v) => v < 0))!
  expect(delaunayPlayer.panels!(flip, input)[2].rows.filter((r) => r.highlight === 'new').length).toBeGreaterThanOrEqual(1)

  const done = delaunayPlayer.panels!(steps[steps.length - 1], input)[2]
  expect(done.rows).toHaveLength(delaunay(input.points, input.order).triangles.length)
  for (const r of done.rows) expect(r.text).toMatch(/^v\d+ v\d+ v\d+$/)
})

test('presets expose five names', () => {
  expect(delaunayPlayer.presets!.map((p) => p.name)).toEqual(DELAUNAY_PRESETS.map((p) => p.name))
  expect(delaunayPlayer.presets).toHaveLength(5)
  expect(delaunayPlayer.presets![0].input).toEqual({ points: DELAUNAY_PRESETS[0].points, order: DELAUNAY_PRESETS[0].order })
  expect(delaunayPlayer.canvas).toEqual({ width: 775, height: 360 })
  expect(delaunayPlayer.hint).toBe(
    'Drag the points to change the input; the insertion order stays. Keys: ← → to step, Space to play or pause.',
  )
})
