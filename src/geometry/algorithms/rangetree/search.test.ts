import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import type { Box } from '../voronoi/clip'
import { mulberry32 } from '../delaunay/delaunay'
import { bruteForceRange } from '../kdtree/verify'
import { buildTree1D, rangeTree, type RangeTree, type RTNode, type Tree1D, type Tree1DNode } from './rangeTree'
import { oneDRangeQuery, rangeQuery2D } from './search'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))
const ascending = (a: number, b: number) => a - b

function randomSet(rng: () => number, n: number, lattice: boolean): Pt[] {
  const c = (a: number, b: number) => (lattice ? a + 50 * Math.floor(rng() * 5) : Math.round(a + rng() * (b - a)))
  return Array.from({ length: n }, () => ({ x: c(15, 355), y: c(15, 465) }))
}

/**
 * A random closed rectangle by `kind`: general, of zero width (2), zero height (3) or both (4),
 * or outside all points (5, 6). With `snap` its sides lie on the lattice lines of `randomSet`
 * or halfway between them.
 */
function randomRect(rng: () => number, kind: number, snap: boolean): Box {
  const r = (a: number, b: number) =>
    snap ? 15 + 50 * Math.floor(rng() * 5) - 25 * Math.floor(rng() * 2) : Math.round(a + rng() * (b - a))
  const [xa, xb, ya, yb] = [r(0, 370), r(0, 370), r(0, 480), r(0, 480)]
  const R = { x0: Math.min(xa, xb), y0: Math.min(ya, yb), x1: Math.max(xa, xb), y1: Math.max(ya, yb) }
  if (kind === 2) R.x1 = R.x0
  if (kind === 3) R.y1 = R.y0
  if (kind === 4) return { x0: R.x0, x1: R.x0, y0: R.y0, y1: R.y0 }
  if (kind === 5) return { x0: 400, x1: 500, y0: R.y0, y1: R.y1 }
  if (kind === 6) return { x0: R.x0, x1: R.x1, y0: -100, y1: 0 }
  return R
}

/** Pre-order index of every node of a 1-D tree, with its leaves and its parent. */
function index1D(t: Tree1D) {
  const byId = new Map<number, { node: Tree1DNode; leaves: number[]; parent: number | null }>()
  const walk = (v: Tree1DNode, parent: number | null): number[] => {
    const leaves = v.kind === 'leaf' ? [v.point] : [...walk(v.left, v.id), ...walk(v.right, v.id)]
    byId.set(v.id, { node: v, leaves, parent })
    return leaves
  }
  if (t.root) walk(t.root, null)
  return byId
}

function ancestors(parent: (id: number) => number | null, id: number): number[] {
  const out: number[] = []
  for (let p = parent(id); p !== null; p = parent(p)) out.push(p)
  return out
}

function isPath(children: (id: number) => number[], path: number[], rootId: number) {
  expect(path[0]).toBe(rootId)
  for (let i = 1; i < path.length; i++) expect(children(path[i - 1])).toContain(path[i])
  expect(children(path[path.length - 1])).toEqual([])
}

function check1D(pts: Pt[], idx: number[], t: Tree1D, lo: number, hi: number) {
  const q = oneDRangeQuery(pts, t, lo, hi)
  const expected = idx.filter((i) => pts[i][t.axis] >= lo && pts[i][t.axis] <= hi).sort(ascending)
  expect(q.result).toEqual(expected)
  if (!t.root) {
    expect(q.split).toBeNull()
    return
  }
  const byId = index1D(t)
  const children = (id: number) => {
    const v = byId.get(id)!.node
    return v.kind === 'leaf' ? [] : [v.left.id, v.right.id]
  }
  const parent = (id: number) => byId.get(id)!.parent
  isPath(children, q.pathLo, t.root.id)
  isPath(children, q.pathHi, t.root.id)
  expect(q.pathLo).toContain(q.split)
  expect(q.pathHi).toContain(q.split)
  // reported subtrees: disjoint, every point inside [lo, hi]
  for (const a of q.reported) {
    for (const b of q.reported) if (a !== b) expect(ancestors(parent, b)).not.toContain(a)
    for (const i of byId.get(a)!.leaves) expect(pts[i][t.axis] >= lo && pts[i][t.axis] <= hi).toBe(true)
  }
  const union = [
    ...q.reported.flatMap((id) => byId.get(id)!.leaves),
    ...q.checkedLeaves.filter((i) => pts[i][t.axis] >= lo && pts[i][t.axis] <= hi),
  ].sort(ascending)
  expect(union).toEqual(expected)
  expect(q.checkedLeaves.length).toBeLessThanOrEqual(2)
}

describe('oneDRangeQuery', () => {
  it('empty tree', () => {
    expect(oneDRangeQuery([], buildTree1D([], [], 'y'), 0, 10)).toEqual({
      split: null, pathLo: [], pathHi: [], reported: [], checkedLeaves: [], result: [],
    })
  })

  it('matches brute force on y-trees and x-trees, with ties, lo = hi and lo > all', () => {
    const rng = mulberry32(77)
    for (let s = 0; s < 200; s++) {
      const n = 1 + Math.floor(rng() * 20)
      const pts = randomSet(rng, n, s % 2 === 1)
      const idx = Array.from({ length: n }, (_, i) => i).filter(() => rng() < 0.8)
      for (const axis of ['y', 'x'] as const) {
        const t = buildTree1D(pts, idx, axis)
        const keys = idx.map((i) => pts[i][axis])
        const some = () => (keys.length ? keys[Math.floor(rng() * keys.length)] : 0)
        const a = Math.round(rng() * 480)
        const b = Math.round(rng() * 480)
        check1D(pts, idx, t, Math.min(a, b), Math.max(a, b))
        const k = some()
        check1D(pts, idx, t, k, k) // lo = hi on a key: all its ties
        const [k1, k2] = [some(), some()].sort(ascending)
        check1D(pts, idx, t, k1, k2) // both bounds on keys
        check1D(pts, idx, t, 1000, 2000) // lo > all
        check1D(pts, idx, t, -20, -10) // hi < all
        check1D(pts, idx, t, -1e9, 1e9) // everything
      }
    }
  })

  it('a bound equal to the split value includes every tie on both sides', () => {
    // y-tree on 6 points that all have y = 5: the root value is 5, the ties sit on both sides
    const pts = P([[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]])
    const t = buildTree1D(pts, [0, 1, 2, 3, 4, 5], 'y')
    expect(t.root?.kind === 'split' && t.root.value).toBe(5)
    expect(oneDRangeQuery(pts, t, 5, 5).result).toEqual([0, 1, 2, 3, 4, 5])
    expect(oneDRangeQuery(pts, t, 0, 5).result).toEqual([0, 1, 2, 3, 4, 5])
    expect(oneDRangeQuery(pts, t, 5, 9).result).toEqual([0, 1, 2, 3, 4, 5])
    expect(oneDRangeQuery(pts, t, 0, 4).result).toEqual([])
    expect(oneDRangeQuery(pts, t, 6, 9).result).toEqual([])
  })

  it('a single leaf is the split node', () => {
    const pts = P([[1, 5]])
    const t = buildTree1D(pts, [0], 'y')
    expect(oneDRangeQuery(pts, t, 5, 5)).toEqual({ split: 0, pathLo: [0], pathHi: [0], reported: [], checkedLeaves: [0], result: [0] })
    expect(oneDRangeQuery(pts, t, 6, 7).result).toEqual([])
  })

  it('lo > hi is an empty interval', () => {
    const pts = P([[1, 5], [2, 6]])
    expect(oneDRangeQuery(pts, buildTree1D(pts, [0, 1], 'y'), 7, 4).result).toEqual([])
  })
})

function walkMain(v: RTNode | null | undefined, parent: number | null, out: Map<number, number | null>) {
  if (!v) return out
  out.set(v.id, parent)
  walkMain(v.left, v.id, out)
  walkMain(v.right, v.id, out)
  return out
}

function check2D(pts: Pt[], tree: RangeTree, R: Box) {
  const q = rangeQuery2D(pts, tree, R)
  const expected = bruteForceRange(pts, R)
  expect(q.reported).toEqual(expected)
  if (!tree.root) {
    expect(q.split).toBeNull()
    return q
  }
  const parents = walkMain(tree.root, null, new Map())
  const parent = (id: number) => parents.get(id) ?? null
  const children = (id: number) => {
    const v = tree.nodes[id]
    return v.kind === 'leaf' ? [] : [v.left!.id, v.right!.id]
  }
  isPath(children, q.pathLo, tree.root.id)
  isPath(children, q.pathHi, tree.root.id)
  expect(q.pathLo).toContain(q.split)
  expect(q.pathHi).toContain(q.split)
  // canonical subtrees: disjoint, at most 2 per depth, inside the x-slab
  const perDepth = new Map<number, number>()
  for (const a of q.canonical) {
    for (const b of q.canonical) if (a !== b) expect(ancestors(parent, b)).not.toContain(a)
    const v = tree.nodes[a]
    perDepth.set(v.depth, (perDepth.get(v.depth) ?? 0) + 1)
    expect(pts[v.points[0]].x).toBeGreaterThanOrEqual(R.x0)
    expect(pts[v.points[v.points.length - 1]].x).toBeLessThanOrEqual(R.x1)
  }
  for (const k of perDepth.values()) expect(k).toBeLessThanOrEqual(2)
  expect(q.assocQueries.map((a) => a.node)).toEqual(q.canonical)
  for (const a of q.assocQueries)
    expect(a.result).toEqual(tree.nodes[a.node].points.filter((i) => pts[i].y >= R.y0 && pts[i].y <= R.y1).sort(ascending))
  const union = [
    ...q.assocQueries.flatMap((a) => a.result),
    ...q.checkedLeaves.filter((i) => expected.includes(i)),
  ].sort(ascending)
  expect(union).toEqual(expected)
  expect(q.checkedLeaves.length).toBeLessThanOrEqual(2)
  return q
}

describe('rangeQuery2D', () => {
  it('empty tree', () => {
    expect(rangeQuery2D([], rangeTree([]), { x0: 0, y0: 0, x1: 500, y1: 500 })).toEqual({
      split: null, pathLo: [], pathHi: [], canonical: [], assocQueries: [], checkedLeaves: [], reported: [],
    })
  })

  it('matches brute force on 500 random set/rectangle pairs', () => {
    const rng = mulberry32(5)
    let nonEmpty = 0
    let degenerateHits = 0
    let canonical = 0
    for (let s = 0; s < 500; s++) {
      const n = Math.floor(rng() * 21)
      const pts = randomSet(rng, n, s % 2 === 1)
      const q = check2D(pts, rangeTree(pts), randomRect(rng, s % 7, s % 2 === 1))
      if (q.reported.length) nonEmpty++
      if (q.reported.length && s % 7 >= 2 && s % 7 <= 4) degenerateHits++
      canonical += q.canonical.length
    }
    // the sample is not degenerate: (98, 14, 482) for this seed
    expect(nonEmpty).toBeGreaterThan(80)
    expect(degenerateHits).toBeGreaterThan(10)
    expect(canonical).toBeGreaterThan(300)
  })

  it('every point a duplicate: rectangles on the lattice lines', () => {
    const pts = P([[50, 50], [50, 50], [50, 100], [100, 50], [100, 100], [100, 100], [50, 100], [100, 50]])
    const tree = rangeTree(pts)
    for (const x0 of [0, 50, 100]) for (const x1 of [50, 100, 150]) for (const y0 of [0, 50, 100]) for (const y1 of [50, 100, 150])
      if (x0 <= x1 && y0 <= y1) check2D(pts, tree, { x0, x1, y0, y1 })
  })

  it('n = 1: the split node is the leaf', () => {
    const pts = P([[10, 20]])
    const tree = rangeTree(pts)
    const q = check2D(pts, tree, { x0: 10, x1: 10, y0: 20, y1: 20 })
    expect(q).toEqual({ split: 0, pathLo: [0], pathHi: [0], canonical: [], assocQueries: [], checkedLeaves: [0], reported: [0] })
    expect(check2D(pts, tree, { x0: 0, x1: 5, y0: 0, y1: 50 }).reported).toEqual([])
  })

  it('n = 2: a query on one point returns that point', () => {
    const pts = P([[70, 10], [30, 50]])
    const tree = rangeTree(pts)
    expect(check2D(pts, tree, { x0: 70, x1: 70, y0: 10, y1: 10 }).reported).toEqual([0])
    expect(check2D(pts, tree, { x0: 30, x1: 30, y0: 50, y1: 50 }).reported).toEqual([1])
    const both = check2D(pts, tree, { x0: 0, x1: 100, y0: 0, y1: 100 })
    expect(both.split).toBe(0)
    expect(both.checkedLeaves).toEqual([1, 0])
    expect(both.reported).toEqual([0, 1])
  })

  it('a wide slab reports canonical subtrees through their associated trees', () => {
    const pts = randomSet(mulberry32(16), 16, false)
    const tree = rangeTree(pts)
    const q = check2D(pts, tree, { x0: 0, x1: 400, y0: 0, y1: 500 })
    expect(q.reported).toHaveLength(16)
    expect(q.canonical.length).toBeGreaterThan(0)
  })

  it('x0 > x1 is an empty rectangle', () => {
    const pts = randomSet(mulberry32(1), 6, false)
    expect(rangeQuery2D(pts, rangeTree(pts), { x0: 300, x1: 100, y0: 0, y1: 500 }).reported).toEqual([])
  })
})
