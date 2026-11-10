import { afterEach, expect, test } from 'vitest'
import paper from 'paper'
import { createScene, type Scene } from '../engine/scene'
import { mulberry32 } from '../geometry/algorithms/delaunay/delaunay'
import { randomPointSet } from '../geometry/algorithms/delaunay/verify'
import { PLANE_BOX } from '../geometry/algorithms/kdtree/kdTree'
import { KD_PRESETS } from '../geometry/algorithms/kdtree/presets'
import { bruteForceRange } from '../geometry/algorithms/kdtree/verify'
import { distance } from '../geometry/primitives'
import type { KdInput, Pt } from '../geometry/types'
import kdTreePlayer from './kdTreePlayer'

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
const items = (scene: Scene) => scene.paper.project.activeLayer.children
const paths = (scene: Scene) => items(scene).filter((c): c is paper.Path => c instanceof scene.paper.Path)
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
/** Tree nodes: closed paths right of the separator, 12×12 squares (splits) or r = 5 circles (leaves). */
const treeNodes = (scene: Scene) =>
  paths(scene).filter(
    (p) =>
      p.closed &&
      p.bounds.center.x > 465 &&
      ((near(p.bounds.width, 12) && near(p.bounds.height, 12)) || (near(p.bounds.width, 10) && near(p.bounds.height, 10))),
  )
/** Plane points: r = 4 circles left of the separator. */
const planeDots = (scene: Scene) =>
  paths(scene).filter((p) => p.closed && p.bounds.center.x < 465 && near(p.bounds.width, 8) && near(p.bounds.height, 8))

const inBox = (p: Pt) => p.x >= PLANE_BOX.x0 && p.x <= PLANE_BOX.x1 && p.y >= PLANE_BOX.y0 && p.y <= PLANE_BOX.y1
const planeArea = (PLANE_BOX.x1 - PLANE_BOX.x0) * (PLANE_BOX.y1 - PLANE_BOX.y0)
const preset = (name: string): KdInput => kdTreePlayer.presets!.find((p) => p.name === name)!.input
const textbook = () => preset('Textbook example')

function seededInput(seed: number, n: number): KdInput {
  const rng = mulberry32(seed)
  return { points: randomPointSet(rng, n, { x0: 25, y0: 25, x1: 445, y1: 335 }, 12), query: { x0: 100, y0: 80, x1: 330, y1: 260 } }
}

test('random input: 14 points inside PLANE_BOX, pairwise ≥ 20, query area 25–40% of the plane', () => {
  for (let k = 0; k < 30; k++) {
    const { points, query } = kdTreePlayer.randomInput()
    expect(points).toHaveLength(14)
    for (const p of points) expect(inBox(p)).toBe(true)
    for (let i = 0; i < 14; i++) for (let j = i + 1; j < 14; j++) expect(distance(points[i], points[j])).toBeGreaterThanOrEqual(20)
    expect(query.x0).toBeLessThan(query.x1)
    expect(query.y0).toBeLessThan(query.y1)
    expect(inBox({ x: query.x0, y: query.y0 })).toBe(true)
    expect(inBox({ x: query.x1, y: query.y1 })).toBe(true)
    const frac = ((query.x1 - query.x0) * (query.y1 - query.y0)) / planeArea
    expect(frac).toBeGreaterThanOrEqual(0.25)
    expect(frac).toBeLessThanOrEqual(0.4)
  }
})

test('render is pure', () => {
  const scene = makeScene()
  const input = textbook()
  const before = JSON.stringify(input)
  const steps = kdTreePlayer.computeSteps(input)
  const pick = [
    steps[0],
    steps.find((s) => s.line === 2)!,
    steps.find((s) => s.line === 9)!,
    steps.find((s) => s.state.test?.relation === 'inside')!,
    steps.find((s) => s.state.test?.relation === 'disjoint')!,
    steps.find((s) => s.line === 12)!,
    steps[steps.length - 1],
  ]
  for (const step of pick) expect(step).toBeDefined()
  for (const step of pick) {
    const snap = JSON.stringify(step)
    kdTreePlayer.render(scene, step, input)
    const n = items(scene).length
    kdTreePlayer.render(scene, step, input)
    expect(items(scene).length).toBe(n)
    expect(n).toBeGreaterThan(0)
    expect(JSON.stringify(step)).toBe(snap)
  }
  expect(JSON.stringify(input)).toBe(before)
  const R = { x0: 50, y0: 50, x1: 200, y1: 200 }
  for (const tiny of [{ points: [], query: R }, { points: [{ x: 100, y: 100 }], query: R }]) {
    for (const mode of ['full', 'build', 'query'])
      for (const step of kdTreePlayer.computeSteps(tiny, mode)) {
        kdTreePlayer.render(scene, step, tiny)
        kdTreePlayer.panels!(step, tiny)
      }
  }
})

test('handles inside the plane box', () => {
  for (const input of [textbook(), kdTreePlayer.randomInput(), kdTreePlayer.randomInput()]) {
    const h = kdTreePlayer.handles(input)
    expect(h).toHaveLength(input.points.length + 2)
    for (const p of h) expect(inBox(p)).toBe(true)
    expect(h.slice(0, input.points.length)).toEqual(input.points)
    expect(h.slice(-2)).toEqual([
      { x: input.query.x0, y: input.query.y0 },
      { x: input.query.x1, y: input.query.y1 },
    ])
  }
  const input = textbook()
  const moved = kdTreePlayer.moveHandle(input, 2, { x: -40, y: 900 })
  expect(moved.points[2]).toEqual({ x: PLANE_BOX.x0, y: PLANE_BOX.y1 })
  expect(input.points[2]).toEqual({ x: 150, y: 200 })
  expect(moved.query).toEqual(input.query)
  const corner = kdTreePlayer.moveHandle(input, input.points.length + 1, { x: 800, y: 400 })
  expect(corner.query).toEqual({ x0: 130, y0: 100, x1: PLANE_BOX.x1, y1: PLANE_BOX.y1 })
  for (const p of kdTreePlayer.handles(corner)) expect(inBox(p)).toBe(true)
  // the corners are drawn as 7px squares
  const scene = makeScene()
  const steps = kdTreePlayer.computeSteps(input)
  kdTreePlayer.render(scene, steps[0], input)
  for (const c of kdTreePlayer.handles(input).slice(-2)) {
    const sq = paths(scene).filter((p) => near(p.bounds.center.x, c.x) && near(p.bounds.center.y, c.y) && near(p.bounds.width, 7))
    expect(sq).toHaveLength(1)
    expect(sq[0].segments).toHaveLength(4)
    expect(sq[0].fillColor!.toCSS(true)).toBe('#9141ac')
  }
})

test('build step draws as many tree nodes as nodes.length', () => {
  const scene = makeScene()
  for (const input of [textbook(), preset('Square grid 4×4'), seededInput(7, 23)]) {
    const steps = kdTreePlayer.computeSteps(input, 'build')
    expect(steps.every((s) => s.state.phase === 'build')).toBe(true)
    for (const step of steps) {
      kdTreePlayer.render(scene, step, input)
      expect(treeNodes(scene)).toHaveLength(step.state.nodes.length)
      const splits = step.state.nodes.filter((v) => v.axis).length
      expect(treeNodes(scene).filter((p) => near(p.bounds.width, 12))).toHaveLength(splits)
    }
  }
  // the active node is filled with --kd-current
  const input = textbook()
  const first = kdTreePlayer.computeSteps(input, 'build')[0]
  kdTreePlayer.render(scene, first, input)
  const [root] = treeNodes(scene)
  expect(root.fillColor!.toCSS(true)).toBe('#e66100')
  expect(root.strokeColor!.toCSS(true)).toBe('#1a5fb4')
})

test('done reports the brute-force set', () => {
  const scene = makeScene()
  const inputs = [...KD_PRESETS.map((p) => preset(p.name)), seededInput(3, 18), seededInput(11, 30)]
  for (const input of inputs) {
    const steps = kdTreePlayer.computeSteps(input)
    const done = steps[steps.length - 1]
    expect(done.state.phase).toBe('done')
    kdTreePlayer.render(scene, done, input)
    const dots = planeDots(scene)
    expect(dots).toHaveLength(input.points.length)
    const green = dots
      .filter((d) => d.fillColor!.toCSS(true) === '#26a269')
      .map((d) => input.points.findIndex((q) => near(q.x, d.bounds.center.x) && near(q.y, d.bounds.center.y)))
      .sort((a, b) => a - b)
    expect(green).toEqual(bruteForceRange(input.points, input.query))
  }
})

test('Query only starts with the full tree', () => {
  const scene = makeScene()
  for (const input of [textbook(), seededInput(5, 12)]) {
    const steps = kdTreePlayer.computeSteps(input, 'query')
    const first = steps[0]
    expect(first.line).toBe(9)
    expect(first.state.nodes).toHaveLength(2 * input.points.length - 1)
    kdTreePlayer.render(scene, first, input)
    expect(treeNodes(scene)).toHaveLength(2 * input.points.length - 1)
    expect(steps.slice(1).every((s) => s.line >= 11)).toBe(true)
  }
  // the full mode reaches the same tree only at its last build step
  const input = textbook()
  const full = kdTreePlayer.computeSteps(input)
  expect(full[0].state.nodes.length).toBeLessThan(19)
})

test('moveHandle normalizes', () => {
  const input = textbook()
  const n = input.points.length
  // a dragged corner stops at the opposite one: the lower-left corner pushed past the upper-right
  const a = kdTreePlayer.moveHandle(input, n, { x: 420, y: 320 })
  expect(a.query).toEqual({ x0: 370, y0: 280, x1: 370, y1: 280 })
  // lower-left corner only to the right: y follows the cursor
  const b = kdTreePlayer.moveHandle(input, n, { x: 400, y: 150 })
  expect(b.query).toEqual({ x0: 370, y0: 150, x1: 370, y1: 280 })
  // upper-right corner below and left of the lower-left one
  const c = kdTreePlayer.moveHandle(input, n + 1, { x: 40, y: 30 })
  expect(c.query).toEqual({ x0: 130, y0: 100, x1: 130, y1: 100 })
  // ordinary moves
  expect(kdTreePlayer.moveHandle(input, n, { x: 60, y: 40 }).query).toEqual({ x0: 60, y0: 40, x1: 370, y1: 280 })
  expect(kdTreePlayer.moveHandle(input, n + 1, { x: 900, y: 300 }).query).toEqual({ x0: 130, y0: 100, x1: PLANE_BOX.x1, y1: 300 })
  for (const q of [a.query, b.query, c.query]) {
    expect(q.x0).toBeLessThanOrEqual(q.x1)
    expect(q.y0).toBeLessThanOrEqual(q.y1)
  }
  expect(a.points).toEqual(input.points)
  expect(a.points[0]).not.toBe(input.points[0])
  expect(input.query).toEqual({ x0: 130, y0: 100, x1: 370, y1: 280 })
  const steps = kdTreePlayer.computeSteps(b)
  expect(steps[steps.length - 1].state.reported).toEqual(bruteForceRange(b.points, b.query))
})

test('dragging a corner across the other keeps the handle indices stable', () => {
  const start = textbook()
  const n = start.points.length
  // the player keeps the same handle index for the whole drag
  const drag = (k: number, path: Pt[], fixed: Pt) => {
    let input = start
    for (const p of path) {
      input = kdTreePlayer.moveHandle(input, k, p)
      const q = input.query
      expect(q.x0).toBeLessThanOrEqual(q.x1)
      expect(q.y0).toBeLessThanOrEqual(q.y1)
      expect(kdTreePlayer.handles(input)[k === n ? n + 1 : n]).toEqual(fixed)
    }
    return input.query
  }
  const lowerLeft = drag(n, [{ x: 300, y: 250 }, { x: 400, y: 300 }, { x: 410, y: 310 }, { x: 420, y: 320 }, { x: 200, y: 150 }], { x: 370, y: 280 })
  expect(lowerLeft).toEqual({ x0: 200, y0: 150, x1: 370, y1: 280 })
  const upperRight = drag(n + 1, [{ x: 200, y: 150 }, { x: 100, y: 60 }, { x: 40, y: 30 }, { x: 300, y: 250 }], { x: 130, y: 100 })
  expect(upperRight).toEqual({ x0: 130, y0: 100, x1: 300, y1: 250 })
})

test('tree stays in its area', () => {
  const scene = makeScene()
  const isText = (it: paper.Item) => it instanceof scene.paper.PointText
  const check = (input: KdInput) => {
    const steps = kdTreePlayer.computeSteps(input)
    for (const step of [steps[Math.min(5, steps.length - 1)], steps.find((s) => s.line === 9)!, steps[steps.length - 1]]) {
      kdTreePlayer.render(scene, step, input)
      const tree = items(scene).filter((it) => it.bounds.right > 465)
      expect(tree.length).toBeGreaterThanOrEqual(step.state.nodes.length)
      for (const it of tree) {
        expect(it.bounds.left).toBeGreaterThanOrEqual(470)
        expect(it.bounds.right).toBeLessThanOrEqual(770)
        // labels within the area proper (y 20–340), shapes within it up to their half size
        expect(it.bounds.top).toBeGreaterThanOrEqual(isText(it) ? 20 : 10)
        expect(it.bounds.bottom).toBeLessThanOrEqual(isText(it) ? 340 : 350)
      }
    }
    return items(scene).filter((it) => isText(it) && it.bounds.left > 465).length
  }
  // 30 points: no labels
  for (const seed of [1, 2, 3]) expect(check(seededInput(seed, 30))).toBe(0)
  // small trees (≤ 24 nodes) are labelled
  for (const input of [textbook(), seededInput(4, 12), seededInput(8, 9), seededInput(6, 1)])
    expect(check(input)).toBeGreaterThan(0)
})

test('panels by phase', () => {
  const input = textbook()
  const steps = kdTreePlayer.computeSteps(input)
  const titles = ['Node', 'Query', 'Reported']

  const first = kdTreePlayer.panels!(steps[0], input)
  expect(first.map((p) => p.title)).toEqual(titles)
  expect(first[0].rows.map((r) => r.text)).toEqual(['x = 240.0 · depth 0 · region [15, 455] × [15, 345]'])
  expect(first[1].rows).toHaveLength(0)
  expect(first[1].empty).toBe('Query not started')
  expect(first[2].rows).toHaveLength(0)
  expect(first[2].empty).toBe('Nothing reported yet')

  const leaf = steps.find((s) => s.line === 2)!
  const v = leaf.state.nodes.find((x) => x.id === leaf.state.current)!
  const p = input.points[v.point!]
  expect(kdTreePlayer.panels!(leaf, input)[0].rows.map((r) => r.text)).toEqual([
    `leaf v${v.point! + 1} · (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`,
  ])

  const ready = kdTreePlayer.panels!(steps.find((s) => s.line === 9)!, input)
  expect(ready[0].rows).toHaveLength(0)
  expect(ready[0].empty).toBe('No node yet')

  const inside = steps.find((s) => s.state.test?.relation === 'inside')!
  const side = inside.state.nodes.find((x) => x.id === inside.state.test!.child)!.side === 'left' ? 'lc' : 'rc'
  const c = inside.state.counts
  const [, query, reported] = kdTreePlayer.panels!(inside, input)
  expect(query.rows.map((r) => r.text)).toEqual([
    `region(${side}) ∩ R: inside`,
    `reported ${inside.state.reported.length} · visited ${c.visited} · inside ${c.inside} · skipped ${c.pruned}`,
  ])
  expect(reported.rows.map((r) => r.text)).toEqual(inside.state.reported.map((i) => `v${i + 1}`))
  expect(reported.rows.filter((r) => r.highlight === 'new').map((r) => r.text)).toEqual(
    inside.state.newlyReported!.map((i) => `v${i + 1}`),
  )

  const done = kdTreePlayer.panels!(steps[steps.length - 1], input)
  const e = KD_PRESETS[0].expected
  expect(done[0].rows).toHaveLength(0)
  expect(done[1].rows.map((r) => r.text)).toEqual([
    `reported ${e.reported.length} · visited ${e.visited} · inside ${e.inside} · skipped ${e.pruned}`,
  ])
  expect(done[2].rows.map((r) => r.text)).toEqual(e.reported.map((i) => `v${i + 1}`))
  expect(done[2].rows.every((r) => r.highlight === undefined)).toBe(true)
})

test('presets expose six names', () => {
  expect(kdTreePlayer.presets!.map((p) => p.name)).toEqual(KD_PRESETS.map((p) => p.name))
  expect(kdTreePlayer.presets).toHaveLength(6)
  kdTreePlayer.presets!.forEach((p, k) => {
    expect(p.input).toEqual(KD_PRESETS[k].input)
    expect(p.input.points).not.toBe(KD_PRESETS[k].input.points)
  })
  expect(kdTreePlayer.canvas).toEqual({ width: 775, height: 360 })
  expect(kdTreePlayer.hint).toBe(
    'Drag the points or the two corners of the query rectangle. Keys: ← → to step, Space to play or pause.',
  )
})

test('dimmed lines per mode', () => {
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  expect(kdTreePlayer.modes).toEqual([
    { id: 'full', label: 'Build and query' },
    { id: 'build', label: 'Build only' },
    { id: 'query', label: 'Query only' },
  ])
  expect(kdTreePlayer.dimmedLines!('build')).toEqual(range(10, 20))
  expect(kdTreePlayer.dimmedLines!('query')).toEqual(range(0, 9))
  expect(kdTreePlayer.dimmedLines!('full')).toEqual([])
  expect(kdTreePlayer.dimmedLines!()).toEqual([])
  const input = textbook()
  expect(kdTreePlayer.computeSteps(input)).toEqual(kdTreePlayer.computeSteps(input, 'full'))
  expect(kdTreePlayer.computeSteps(input, 'build').every((s) => s.line <= 9)).toBe(true)
})
