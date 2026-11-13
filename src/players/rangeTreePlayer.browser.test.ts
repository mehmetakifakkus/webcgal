import { afterEach, expect, test } from 'vitest'
import paper from 'paper'
import { createScene, type Scene } from '../engine/scene'
import { mulberry32 } from '../geometry/algorithms/delaunay/delaunay'
import { randomPointSet } from '../geometry/algorithms/delaunay/verify'
import { bruteForceRange } from '../geometry/algorithms/kdtree/verify'
import { RT_PRESETS, randomRangeTreeInput } from '../geometry/algorithms/rangetree/presets'
import { RT_LINE, RT_PSEUDOCODE } from '../geometry/algorithms/rangetree/pseudocode'
import { RT_PLANE, buildTree1D, type Tree1DNode } from '../geometry/algorithms/rangetree/rangeTree'
import { distance } from '../geometry/primitives'
import type { Pt, RangeTreeInput } from '../geometry/types'
import themeCss from '../styles/theme.css?raw'
import rangeTreePlayer from './rangeTreePlayer'

const W = 775
const H = 480
const scenes: Scene[] = []
afterEach(() => {
  scenes.splice(0).forEach((s) => s.dispose())
})
function makeScene() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  document.body.appendChild(canvas)
  const scene = createScene(canvas)
  scenes.push(scene)
  return scene
}
const layer = (scene: Scene) => scene.paper.project.activeLayer
/** Every item under `root`, depth first. */
function descendants(root: paper.Item): paper.Item[] {
  const out: paper.Item[] = []
  for (const c of root.children ?? []) out.push(c, ...descendants(c))
  return out
}
const all = (scene: Scene) => descendants(layer(scene))
const texts = (scene: Scene) => all(scene).filter((it): it is paper.PointText => it instanceof scene.paper.PointText)
const named = (scene: Scene, prefix: string) => all(scene).filter((it) => it.name?.startsWith(prefix)) as paper.Path[]
const byName = (scene: Scene, name: string) => {
  const found = all(scene).filter((it) => it.name === name) as paper.Path[]
  expect(found, name).toHaveLength(1)
  return found[0]
}
const fill = (it: paper.Item) => it.fillColor?.toCSS(true)
const stroke = (it: paper.Item) => it.strokeColor?.toCSS(true)
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6

const C = { current: '#e66100', path: '#1a5fb4', canonical: '#26a269', slab: '#99c1f1', faint: '#c0bfbc', ink: '#1c1e21', white: '#ffffff' }
const inPlane = (p: Pt) => p.x >= RT_PLANE.x0 && p.x <= RT_PLANE.x1 && p.y >= RT_PLANE.y0 && p.y <= RT_PLANE.y1
const preset = (name: string): RangeTreeInput => rangeTreePlayer.presets!.find((p) => p.name === name)!.input
const textbook = () => preset('Textbook example')
const grid = () => preset('Square grid 4×4')

function seededInput(seed: number, n: number): RangeTreeInput {
  const rng = mulberry32(seed)
  const points = randomPointSet(rng, n, { x0: 30, y0: 30, x1: 340, y1: 450 }, 12).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
  return { points, query: { x0: 90, y0: 100, x1: 260, y1: 330 } }
}
/** Random inputs as the player makes them (randomRangeTreeInput), with `n` points. */
function randomN(n: number, count: number): RangeTreeInput[] {
  const out: RangeTreeInput[] = []
  for (let seed = 1; out.length < count; seed++) {
    const input = randomRangeTreeInput(mulberry32(seed))
    if (input.points.length === n) out.push(input)
  }
  return out
}

test('render is pure', () => {
  const scene = makeScene()
  const input = textbook()
  const before = JSON.stringify(input)
  const steps = rangeTreePlayer.computeSteps(input)
  const pick = [
    steps[0],
    steps.find((s) => s.line === RT_LINE.leaf)!,
    steps.find((s) => s.line === RT_LINE.findSplit)!,
    steps.find((s) => s.line === RT_LINE.loQuery)!,
    steps.find((s) => s.line === RT_LINE.loAssoc)!,
    steps.find((s) => s.line === RT_LINE.loLeaf)!,
    steps.find((s) => s.line === RT_LINE.hiAssoc)!,
    steps[steps.length - 1],
  ]
  for (const step of pick) expect(step).toBeDefined()
  for (const step of pick) {
    const snap = JSON.stringify(step)
    rangeTreePlayer.render(scene, step, input)
    const n = all(scene).length
    rangeTreePlayer.render(scene, step, input)
    expect(all(scene).length).toBe(n)
    expect(n).toBeGreaterThan(0)
    expect(JSON.stringify(step)).toBe(snap)
  }
  expect(JSON.stringify(input)).toBe(before)
  // degenerate inputs in every mode (Review Focus 2 and 3)
  const R = { x0: 50, y0: 50, x1: 200, y1: 200 }
  const tiny: RangeTreeInput[] = [
    { points: [], query: R },
    { points: [{ x: 100, y: 100 }], query: R },
    { points: [{ x: 100, y: 100 }, { x: 300, y: 400 }], query: R },
    { points: [{ x: 100, y: 100 }, { x: 100, y: 100 }], query: { x0: 100, y0: 100, x1: 100, y1: 100 } },
    { points: textbook().points, query: { x0: 120, y0: 15, x1: 120, y1: 465 } },
  ]
  for (const t of tiny)
    for (const mode of ['full', 'build', 'query'])
      for (const step of rangeTreePlayer.computeSteps(t, mode)) {
        rangeTreePlayer.render(scene, step, t)
        rangeTreePlayer.panels!(step, t)
      }
})

test('random input is valid', () => {
  const sizes = new Set<number>()
  for (let k = 0; k < 60; k++) {
    const { points, query } = rangeTreePlayer.randomInput()
    sizes.add(points.length)
    expect(points.length).toBeGreaterThanOrEqual(8)
    expect(points.length).toBeLessThanOrEqual(16)
    for (const p of points) expect(inPlane(p)).toBe(true)
    expect(query.x0).toBeLessThanOrEqual(query.x1)
    expect(query.y0).toBeLessThanOrEqual(query.y1)
    expect(inPlane({ x: query.x0, y: query.y0 })).toBe(true)
    expect(inPlane({ x: query.x1, y: query.y1 })).toBe(true)
  }
  expect(sizes.size).toBeGreaterThan(3)
})

/** The handle StepPlayer grabs at `q`: the nearest within 12 units, the last of equally near ones. */
function grab(input: RangeTreeInput, q: Pt): number {
  let best = -1
  let bestD = 12
  rangeTreePlayer.handles(input).forEach((p, i) => {
    const d = distance(p, q)
    if (d <= bestD) {
      best = i
      bestD = d
    }
  })
  return best
}

test('corner handles stop at the opposite corner and are offset by 1', () => {
  const input = textbook()
  const n = input.points.length
  expect(input.query).toEqual({ x0: 104, y0: 131, x1: 289, y1: 376 })
  expect(rangeTreePlayer.handles(input).slice(-2)).toEqual([{ x: 104, y: 131 }, { x: 289, y: 376 }])
  const move = (inp: RangeTreeInput, k: number, p: Pt) => rangeTreePlayer.moveHandle(inp, k, p, 'full')
  // the lower-left corner pushed past the upper-right one stops there
  const a = move(input, n, { x: 320, y: 420 })
  expect(a.query).toEqual({ x0: 289, y0: 376, x1: 289, y1: 376 })
  expect(rangeTreePlayer.handles(a).slice(-2)).toEqual([{ x: 288, y: 375 }, { x: 289, y: 376 }])
  // only to the right: y follows the cursor
  const b = move(input, n, { x: 300, y: 150 })
  expect(b.query).toEqual({ x0: 289, y0: 150, x1: 289, y1: 376 })
  expect(rangeTreePlayer.handles(b).slice(-2)).toEqual([{ x: 288, y: 150 }, { x: 289, y: 376 }])
  // the upper-right corner below and left of the lower-left one
  const c = move(input, n + 1, { x: 40, y: 30 })
  expect(c.query).toEqual({ x0: 104, y0: 131, x1: 104, y1: 131 })
  // ordinary moves, rounded to integers and kept in the plane area
  expect(move(input, n, { x: 60.4, y: 40.6 }).query).toEqual({ x0: 60, y0: 41, x1: 289, y1: 376 })
  expect(move(input, n, { x: -20, y: -20 }).query).toEqual({ x0: 15, y0: 15, x1: 289, y1: 376 })
  expect(move(input, n + 1, { x: 900, y: 300.5 }).query).toEqual({ x0: 104, y0: 131, x1: 355, y1: 301 })
  for (const q of [a.query, b.query, c.query]) {
    expect(q.x0).toBeLessThanOrEqual(q.x1)
    expect(q.y0).toBeLessThanOrEqual(q.y1)
  }
  expect(a.points).toEqual(input.points)
  expect(a.points[0]).not.toBe(input.points[0])
  expect(input.query).toEqual({ x0: 104, y0: 131, x1: 289, y1: 376 })
  const steps = rangeTreePlayer.computeSteps(b)
  expect(steps[steps.length - 1].state.reported).toEqual(bruteForceRange(b.points, b.query))

  // a drag keeps its handle index: the corner that is not dragged stays put
  const drag = (k: number, path: Pt[], fixed: Pt) => {
    let cur = input
    for (const p of path) {
      cur = move(cur, k, p)
      const q = cur.query
      expect(q.x0).toBeLessThanOrEqual(q.x1)
      expect(q.y0).toBeLessThanOrEqual(q.y1)
      expect(k === n ? { x: q.x1, y: q.y1 } : { x: q.x0, y: q.y0 }).toEqual(fixed)
      expect(distance(rangeTreePlayer.handles(cur)[k === n ? n + 1 : n], fixed)).toBeLessThanOrEqual(Math.SQRT2 + 1e-9)
    }
    return cur.query
  }
  expect(drag(n, [{ x: 200, y: 250 }, { x: 300, y: 400 }, { x: 320, y: 420 }, { x: 150, y: 200 }], { x: 289, y: 376 })).toEqual({
    x0: 150, y0: 200, x1: 289, y1: 376,
  })
  expect(drag(n + 1, [{ x: 200, y: 250 }, { x: 60, y: 60 }, { x: 250, y: 300 }], { x: 104, y: 131 })).toEqual({
    x0: 104, y0: 131, x1: 250, y1: 300,
  })

  // collapsed at the plane's top-right corner: the lower-left handle sits 1 down / left
  let top = input
  for (const p of [{ x: 300, y: 400 }, { x: 500, y: 600 }]) top = move(move(top, n + 1, { x: 500, y: 600 }), n, p)
  expect(top.query).toEqual({ x0: 355, y0: 465, x1: 355, y1: 465 })
  const [lo, hi] = rangeTreePlayer.handles(top).slice(-2)
  expect([lo, hi]).toEqual([{ x: 354, y: 464 }, { x: 355, y: 465 }])
  expect(grab(top, { x: 355, y: 465 })).toBe(n + 1)
  expect(grab(top, { x: 350, y: 460 })).toBe(n)
  // collapsed at the lower-left corner: the upper-right handle moves up / right instead
  const low = move(input, n, { x: 0, y: 0 })
  const low2 = move(low, n + 1, { x: 0, y: 0 })
  expect(low2.query).toEqual({ x0: 15, y0: 15, x1: 15, y1: 15 })
  expect(rangeTreePlayer.handles(low2).slice(-2)).toEqual([{ x: 15, y: 15 }, { x: 16, y: 16 }])
  expect(grab(low2, { x: 20, y: 20 })).toBe(n + 1)
  expect(move(low2, n + 1, { x: 120, y: 90 }).query).toEqual({ x0: 15, y0: 15, x1: 120, y1: 90 })
})

test('point handles only with a build phase', () => {
  const input = textbook()
  const n = input.points.length
  const h = rangeTreePlayer.handles(input)
  expect(h).toHaveLength(n + 2)
  expect(h.slice(0, n)).toEqual(input.points)
  for (const mode of ['full', 'build', undefined]) {
    const moved = rangeTreePlayer.moveHandle(input, 2, { x: -40.3, y: 900 }, mode)
    expect(moved.points[2]).toEqual({ x: 15, y: 465 })
    expect(rangeTreePlayer.moveHandle(input, 2, { x: 100.6, y: 200.2 }, mode).points[2]).toEqual({ x: 101, y: 200 })
    expect(moved.query).toEqual(input.query)
    expect(input.points[2]).toEqual(textbook().points[2])
  }
  // Query only: the points stay put; Build only: the corners stay put
  expect(rangeTreePlayer.moveHandle(input, 2, { x: 100, y: 200 }, 'query')).toBe(input)
  expect(rangeTreePlayer.moveHandle(input, n, { x: 50, y: 50 }, 'build')).toBe(input)
  expect(rangeTreePlayer.moveHandle(input, n + 1, { x: 300, y: 400 }, 'build')).toBe(input)
  expect(rangeTreePlayer.moveHandle(input, n + 1, { x: 300, y: 400 }, 'query').query).toEqual({ x0: 104, y0: 131, x1: 300, y1: 400 })
  // the corners are drawn (7 px squares at the handles) only in modes with a query phase
  const scene = makeScene()
  for (const mode of ['full', 'build', 'query']) {
    const step = rangeTreePlayer.computeSteps(input, mode)[0]
    rangeTreePlayer.render(scene, step, input)
    const corners = named(scene, 'corner')
    if (mode === 'build') expect(corners).toHaveLength(0)
    else {
      expect(corners).toHaveLength(2)
      corners.forEach((sq, k) => {
        const c = h[n + k]
        expect(near(sq.bounds.center.x, c.x) && near(sq.bounds.center.y, c.y) && near(sq.bounds.width, 7)).toBe(true)
      })
    }
    // the points are drawn at their handles in every mode
    const dots = named(scene, 'point-')
    expect(dots.map((d) => ({ x: d.bounds.center.x, y: d.bounds.center.y }))).toEqual(input.points)
  }
})

test('panels by phase', () => {
  const input = textbook()
  const steps = rangeTreePlayer.computeSteps(input)
  const titles = ['Node', 'Result', 'Storage']
  const rows = (p: { rows: { text: string }[] }) => p.rows.map((r) => r.text)

  const first = rangeTreePlayer.panels!(steps[0], input)
  expect(first.map((p) => p.title)).toEqual(titles)
  expect(rows(first[0])).toEqual(['v1 · x-range [50, 336] · 10 points', 'associated leaves in y order: ' + yOrder(input, steps[0].state.nodes[0].points)])
  expect(first[0].rows[0].highlight).toBe('active')
  expect(first[1].rows).toHaveLength(0)
  expect(first[1].empty).toBe('Nothing reported yet')
  expect(first[0].empty).toBe('No node yet')
  // the whole tree's totals, in the build too
  expect(rows(first[2])).toEqual(['n = 10 · main tree 19 nodes · associated trees 44 leaves ≤ n·(depth + 1) = 50', 'a kd-tree stores n = 10 points once'])

  const leaf = steps.find((s) => s.line === RT_LINE.leaf)!
  const v = leaf.state.nodes[leaf.state.current!]
  const p = input.points[v.point!]
  expect(rows(rangeTreePlayer.panels!(leaf, input)[0])).toEqual([`leaf p${v.point! + 1} · (${p.x}, ${p.y})`, `associated leaves in y order: p${v.point! + 1}`])

  const lastBuild = steps.filter((s) => s.state.phase === 'build').pop()!
  expect(rows(rangeTreePlayer.panels!(lastBuild, input)[2])[0]).toBe(
    'n = 10 · main tree 19 nodes · associated trees 44 leaves ≤ n·(depth + 1) = 50',
  )

  // query: nothing yet at the split node, then the result so far
  const split = steps.find((s) => s.line === RT_LINE.findSplit)!
  const atSplit = rangeTreePlayer.panels!(split, input)
  expect(atSplit.map((p) => p.title)).toEqual(titles)
  expect(rows(atSplit[0])[0]).toBe('v1 · x-range [50, 336] · 10 points')
  expect(atSplit[1].rows).toHaveLength(0)
  expect(atSplit[1].empty).toBe('Nothing reported yet')
  const assoc = steps.find((s) => s.line === RT_LINE.loAssoc)!
  expect(rows(rangeTreePlayer.panels!(assoc, input)[1])).toEqual(['0 points reported', '1 canonical subtree · 1 associated query'])

  const done = rangeTreePlayer.panels!(steps[steps.length - 1], input)
  expect(done[0].rows).toHaveLength(0)
  expect(done[0].empty).toBe('No node yet')
  expect(rows(done[1])).toEqual(['4 points reported: p3, p6, p7, p8', '2 canonical subtrees · 2 associated queries', 'checked one by one: p3, p9'])
  expect(rows(done[2])).toEqual(['n = 10 · main tree 19 nodes · associated trees 44 leaves ≤ n·(depth + 1) = 50', 'a kd-tree stores n = 10 points once'])

  // the spec's rows: 12 points, and "=" for 16 (a power of two)
  const twelve: RangeTreeInput = { points: grid().points.slice(0, 12), query: grid().query }
  const s12 = rangeTreePlayer.computeSteps(twelve, 'query')
  expect(rows(rangeTreePlayer.panels!(s12[s12.length - 1], twelve)[2])).toEqual([
    'n = 12 · main tree 23 nodes · associated trees 56 leaves ≤ n·(depth + 1) = 60',
    'a kd-tree stores n = 12 points once',
  ])
  const s16 = rangeTreePlayer.computeSteps(grid(), 'query')
  expect(rows(rangeTreePlayer.panels!(s16[s16.length - 1], grid())[2])[0]).toBe(
    'n = 16 · main tree 31 nodes · associated trees 80 leaves = n·(depth + 1) = 80',
  )
  // the Storage row never shows running totals: every step of the grid has the Done step's row
  const full16 = rangeTreePlayer.computeSteps(grid())
  const doneRow = rows(rangeTreePlayer.panels!(full16[full16.length - 1], grid())[2])
  expect(rows(rangeTreePlayer.panels!(full16[0], grid())[2])).toEqual(doneRow)
  for (const step of full16) expect(rows(rangeTreePlayer.panels!(step, grid())[2])).toEqual(doneRow)
  // degenerate sizes
  const one: RangeTreeInput = { points: [{ x: 100, y: 100 }], query: input.query }
  const s1 = rangeTreePlayer.computeSteps(one)
  expect(rows(rangeTreePlayer.panels!(s1[s1.length - 1], one)[2])).toEqual([
    'n = 1 · main tree 1 node · associated trees 1 leaf = n·(depth + 1) = 1',
    'a kd-tree stores n = 1 point once',
  ])
  const none: RangeTreeInput = { points: [], query: input.query }
  const s0 = rangeTreePlayer.computeSteps(none)
  expect(rangeTreePlayer.panels!(s0[0], none).map((p) => p.rows.length)).toEqual([0, 0, 2])
})

function yOrder(input: RangeTreeInput, idx: number[]) {
  const P = input.points
  return [...idx]
    .sort((a, b) => P[a].y - P[b].y || P[a].x - P[b].x || a - b)
    .map((i) => `p${i + 1}`)
    .join(', ')
}

test('associated tree drawn for assocShown', () => {
  const scene = makeScene()
  for (const input of [textbook(), grid(), preset('Thin vertical strip')]) {
    for (const step of rangeTreePlayer.computeSteps(input)) {
      rangeTreePlayer.render(scene, step, input)
      const s = step.state
      const groups = all(scene).filter((it) => it.name === 'assoc')
      const group = groups.length ? groups[0] : null
      expect(groups.length).toBeLessThanOrEqual(1)
      const empty = texts(scene).filter((t) => t.content === 'No associated tree selected')
      if (s.assocShown === null) {
        expect(group).toBeNull()
        expect(empty).toHaveLength(1)
        continue
      }
      expect(empty).toHaveLength(0)
      expect(group).not.toBeNull()
      const v = s.nodes[s.assocShown]
      const inGroup = descendants(group!)
      const title = inGroup.filter((t): t is paper.PointText => t instanceof scene.paper.PointText && t.name === 'assoc-title')
      expect(title.map((t) => t.content)).toEqual([`T_assoc(${v.label}) on y`])
      // one shape per node of the associated tree (2m − 1), in its box
      const nodes = inGroup.filter((it) => it.name?.startsWith('assoc-node')) as paper.Path[]
      expect(nodes).toHaveLength(2 * v.points.length - 1)
      for (const it of nodes) {
        expect(it.bounds.left).toBeGreaterThanOrEqual(380)
        expect(it.bounds.right).toBeLessThanOrEqual(765)
        expect(it.bounds.top).toBeGreaterThanOrEqual(15)
        expect(it.bounds.bottom).toBeLessThanOrEqual(235)
      }
      // every node's colour by id, walking the rebuilt tree (its ids are those of assocPaths):
      // split nodes green if reported whole, blue if on a search path, white otherwise; leaves
      // green if their point is in the result, blue if on a search path, ink otherwise. No paths
      // before the 1DRangeQuery step.
      const q1 = s.assocPaths
      const onPath = new Set(q1 ? [...q1.pathLo, ...q1.pathHi] : [])
      const reportedRoots = new Set(q1?.reported ?? [])
      const result = new Set(q1?.result ?? [])
      const tree = buildTree1D(input.points, v.points, 'y')
      const shape = (name: string) => {
        const found = nodes.filter((it) => it.name === name)
        expect(found, name).toHaveLength(1)
        return found[0]
      }
      const walk = (u: Tree1DNode) => {
        if (u.kind === 'split') {
          const want = reportedRoots.has(u.id) ? C.canonical : onPath.has(u.id) ? C.path : C.white
          expect(fill(shape(`assoc-node-split-${u.id}`)), `${step.description}: split ${u.id}`).toBe(want)
          walk(u.left)
          walk(u.right)
        } else {
          const want = result.has(u.point) ? C.canonical : onPath.has(u.id) ? C.path : C.ink
          expect(fill(shape(`assoc-node-leaf-${u.id}`)), `${step.description}: leaf ${u.id}`).toBe(want)
        }
      }
      walk(tree.root!)
      if (q1) {
        expect(onPath.size).toBeGreaterThan(0)
        // the canonical child is green in the main tree, the path node v orange
        expect(fill(byName(scene, `main-${s.assocShown}`))).toBe(C.canonical)
        expect(fill(byName(scene, `main-${s.current}`))).toBe(C.current)
      }
      // split values on y are shown as integers, so they fit their circle
      const values = inGroup.filter((t): t is paper.PointText => t instanceof scene.paper.PointText && /^\d/.test(t.content))
      expect(values).toHaveLength(v.points.length - 1)
      for (const t of values) expect(t.content).toMatch(/^\d+$/)
    }
  }
  // a split value with decimals (a point placed by the API, not by a drag) is rounded on the canvas
  const odd: RangeTreeInput = { points: [{ x: 100, y: 120.46 }, { x: 200, y: 300 }], query: { x0: 50, y0: 50, x1: 250, y1: 400 } }
  rangeTreePlayer.render(scene, rangeTreePlayer.computeSteps(odd, 'build')[0], odd)
  expect(texts(scene).map((t) => t.content)).toContain('120')
})

test('build phase: unbuilt nodes faint, the current node and its points orange, its split line', () => {
  const scene = makeScene()
  const input = grid()
  const steps = rangeTreePlayer.computeSteps(input, 'build')
  for (const step of steps) {
    rangeTreePlayer.render(scene, step, input)
    const s = step.state
    const nodes = s.nodes.map((v) => byName(scene, `main-${v.id}`))
    expect(nodes.every(Boolean)).toBe(true)
    nodes.forEach((it, id) => {
      if (id >= s.builtUpTo) expect(stroke(it)).toBe(C.faint)
      else expect(stroke(it)).not.toBe(C.faint)
    })
    expect(fill(nodes[s.current!])).toBe(C.current)
    const cur = new Set(s.nodes[s.current!].points)
    const dots = named(scene, 'point-')
    dots.forEach((d, i) => expect(fill(d) === C.current).toBe(cur.has(i)))
    const line = named(scene, 'split-line')
    const v = s.nodes[s.current!]
    if (v.kind === 'split') {
      expect(line).toHaveLength(1)
      expect(near(line[0].bounds.left, v.value!) && near(line[0].bounds.right, v.value!)).toBe(true)
      expect(line[0].bounds.top).toBe(15)
      expect(line[0].bounds.bottom).toBe(465)
    } else expect(line).toHaveLength(0)
  }
})

test('query phase: slab, paths blue, canonical green, reported points green', () => {
  const scene = makeScene()
  for (const input of [...RT_PRESETS.map((p) => preset(p.name)), seededInput(3, 13), seededInput(9, 16)]) {
    const steps = rangeTreePlayer.computeSteps(input, 'query')
    for (const step of steps) {
      rangeTreePlayer.render(scene, step, input)
      const s = step.state
      const slab = named(scene, 'slab')
      expect(slab).toHaveLength(1)
      expect(fill(slab[0])).toBe(C.slab)
      expect(slab[0].fillColor!.alpha).toBeLessThanOrEqual(0.3)
      expect([slab[0].bounds.left, slab[0].bounds.right, slab[0].bounds.top, slab[0].bounds.bottom]).toEqual([
        input.query.x0, input.query.x1, 15, 465,
      ])
      const path = new Set([...s.pathLo, ...s.pathHi])
      const canonical = new Set(s.canonical)
      for (const v of s.nodes) {
        const want =
          v.id === s.current ? C.current
          : canonical.has(v.id) ? C.canonical
          : v.point !== undefined && s.reported.includes(v.point) ? C.canonical
          : path.has(v.id) ? C.path
          : undefined
        if (want) expect(fill(byName(scene, `main-${v.id}`)), `${step.description} ${v.label}`).toBe(want)
      }
      const green = named(scene, 'point-')
        .map((d, i) => (fill(d) === C.canonical ? i : -1))
        .filter((i) => i >= 0)
      expect(green).toEqual(s.reported)
    }
    const done = steps[steps.length - 1].state
    expect(done.reported).toEqual(bruteForceRange(input.points, input.query))
  }
})

test('labels fit at n = 16', () => {
  const scene = makeScene()
  const check = (input: RangeTreeInput, mode: string, pickSteps: (steps: ReturnType<typeof rangeTreePlayer.computeSteps>) => typeof steps) => {
    for (const step of pickSteps(rangeTreePlayer.computeSteps(input, mode))) {
      rangeTreePlayer.render(scene, step, input)
      const labels = texts(scene).filter((t) => t.content.trim() !== '')
      expect(labels.length).toBeGreaterThan(30)
      for (const t of labels) {
        const b = t.bounds
        expect(b.left, t.content).toBeGreaterThanOrEqual(0)
        expect(b.right, t.content).toBeLessThanOrEqual(W)
        expect(b.top, t.content).toBeGreaterThanOrEqual(0)
        expect(b.bottom, t.content).toBeLessThanOrEqual(H)
      }
      for (let i = 0; i < labels.length; i++)
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i].bounds
          const b = labels[j].bounds
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          expect(Math.min(ox, oy), `${step.description}: "${labels[i].content}" and "${labels[j].content}"`).toBeLessThanOrEqual(2)
        }
      // tree labels stay in their boxes
      for (const t of labels.filter((x) => x.bounds.left > 370)) {
        const b = t.bounds
        expect(b.left).toBeGreaterThanOrEqual(378)
        expect(b.right).toBeLessThanOrEqual(767)
        const main = b.top >= 242
        expect(b.top).toBeGreaterThanOrEqual(main ? 250 : 15)
        expect(b.bottom).toBeLessThanOrEqual(main ? 465 : 235)
      }
    }
  }
  // everything drawn: the root's associated tree (16 leaves) on the first build step, the last
  // build step, a 1DRangeQuery step and the last query step
  check(grid(), 'full', (steps) => [
    steps[0],
    steps.filter((s) => s.state.phase === 'build').pop()!,
    steps.find((s) => s.line === RT_LINE.loAssoc)!,
    steps[steps.length - 1],
  ])
  const firstOneDLast = (steps: ReturnType<typeof rangeTreePlayer.computeSteps>) => [
    steps[0],
    steps.find((s) => s.line === RT_LINE.loAssoc || s.line === RT_LINE.hiAssoc) ?? steps[0],
    steps[steps.length - 1],
  ]
  for (const input of randomN(16, 6)) check(input, 'full', firstOneDLast)
  // unbalanced, n = 13: leaves at depths 3 and 4, in every step of the grid's first 13 points
  // and in random 13-point inputs
  const grid13: RangeTreeInput = { points: grid().points.slice(0, 13), query: grid().query }
  check(grid13, 'full', (steps) => steps)
  for (const input of randomN(13, 4)) check(input, 'full', firstOneDLast)
  check(preset('Thin vertical strip'), 'query', (steps) => steps)
  // coincident points share one label, so they do not pile up (see the next test)
  check({ points: Array.from({ length: 16 }, () => ({ x: 150, y: 200 })), query: grid().query }, 'full', firstOneDLast)
})

test('plane labels of coincident points are merged', () => {
  const scene = makeScene()
  const planeLabels = (input: RangeTreeInput) => {
    rangeTreePlayer.render(scene, rangeTreePlayer.computeSteps(input)[0], input)
    return texts(scene).filter((t) => t.bounds.right < 367)
  }
  const Q = { x0: 50, y0: 50, x1: 250, y1: 400 }
  const same = (k: number, extra: Pt[] = []) => ({ points: [...Array.from({ length: k }, () => ({ x: 150, y: 200 })), ...extra], query: Q })
  // 16 points at one spot: one label
  expect(planeLabels(same(16)).map((t) => t.content)).toEqual(['p1 +15'])
  // two points 1 px apart: one label at the first point
  const two = planeLabels({ points: [{ x: 150, y: 200 }, { x: 151, y: 200 }], query: Q })
  expect(two.map((t) => t.content)).toEqual(['p1, p2'])
  expect(two[0].bounds.left).toBeCloseTo(156, 0)
  // up to three are listed, more are counted; 8 px still merges, 9 px does not
  expect(planeLabels(same(3)).map((t) => t.content)).toEqual(['p1, p2, p3'])
  expect(planeLabels(same(4)).map((t) => t.content)).toEqual(['p1 +3'])
  expect(planeLabels({ points: [{ x: 100, y: 100 }, { x: 108, y: 100 }, { x: 300, y: 300 }, { x: 300, y: 309 }], query: Q }).map((t) => t.content)).toEqual([
    'p1, p2',
    'p3',
    'p4',
  ])
  // merging follows the earlier labelled point: p3 is within 8 of p2 but not of p1, and p2 has no label
  expect(planeLabels({ points: [{ x: 100, y: 100 }, { x: 107, y: 100 }, { x: 114, y: 100 }], query: Q }).map((t) => t.content)).toEqual([
    'p1, p2',
    'p3',
  ])
  // the tree labels are unchanged: one per main-tree node
  rangeTreePlayer.render(scene, rangeTreePlayer.computeSteps(same(16))[0], same(16))
  expect(texts(scene).filter((t) => t.bounds.left > 370 && t.bounds.top >= 250 && /^[vp]\d+$/.test(t.content))).toHaveLength(31)
})

test('modes, dimmed lines, presets, canvas, hint and colours', () => {
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  expect(rangeTreePlayer.modes).toEqual([
    { id: 'full', label: 'Build and query' },
    { id: 'build', label: 'Build only' },
    { id: 'query', label: 'Query only' },
  ])
  expect(rangeTreePlayer.pseudocode).toBe(RT_PSEUDOCODE)
  expect(rangeTreePlayer.dimmedLines!('build')).toEqual(range(8, 27))
  expect(rangeTreePlayer.dimmedLines!('query')).toEqual(range(0, 7))
  expect(rangeTreePlayer.dimmedLines!('full')).toEqual([])
  expect(rangeTreePlayer.dimmedLines!()).toEqual([])
  const input = textbook()
  expect(rangeTreePlayer.computeSteps(input)).toEqual(rangeTreePlayer.computeSteps(input, 'full'))
  expect(rangeTreePlayer.computeSteps(input, 'build').every((s) => s.line <= 7)).toBe(true)
  expect(rangeTreePlayer.computeSteps(input, 'query').every((s) => s.line >= 9)).toBe(true)

  expect(rangeTreePlayer.presets!.map((p) => p.name)).toEqual(RT_PRESETS.map((p) => p.name))
  rangeTreePlayer.presets!.forEach((p, k) => {
    expect(p.input).toEqual(RT_PRESETS[k].input)
    expect(p.input.points).not.toBe(RT_PRESETS[k].input.points)
  })
  expect(rangeTreePlayer.canvas).toEqual({ width: 775, height: 480 })
  expect(rangeTreePlayer.hint).toBe('Drag the points or the corners of the query rectangle. Keys: ← → to step, Space to play or pause.')
  // the tokens, identical in the light and dark blocks
  const tokens = { '--rt-current': C.current, '--rt-path': C.path, '--rt-canonical': C.canonical, '--rt-slab': C.slab, '--rt-faint': C.faint }
  for (const [name, value] of Object.entries(tokens)) expect(themeCss.split(`${name}: ${value};`).length - 1, name).toBe(2)
})
