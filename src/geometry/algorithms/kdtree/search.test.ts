import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import type { Box } from '../voronoi/clip'
import { mulberry32 } from '../delaunay/delaunay'
import { randomPointSet } from '../delaunay/verify'
import { PLANE_BOX, buildKdTree } from './kdTree'
import type { KdPatch, KdRecorderContext } from './kdState'
import { searchKdTree } from './search'
import { bruteForceRange, checkKdTree } from './verify'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))

const TEXTBOOK = P([
  [60, 280], [110, 90], [150, 200], [200, 320], [240, 60],
  [280, 170], [330, 260], [370, 110], [410, 300], [430, 40],
])

const SMALL = P([[10, 10], [30, 40], [20, 30], [40, 20]])
const SMALL_BOX: Box = { x0: 0, y0: 0, x1: 50, y1: 50 }

function record() {
  const steps: { line: number; description: string; patch: KdPatch; ctx: KdRecorderContext }[] = []
  const rec = (line: number, description: string, patch: KdPatch, ctx: KdRecorderContext) =>
    steps.push({ line, description, patch, ctx })
  return { steps, rec }
}

/** A random rectangle inside `box`, optionally snapped to a grid of 10. */
function randomRect(rng: () => number, box: Box, snap: boolean): Box {
  const r = (a: number, b: number) => {
    const v = a + rng() * (b - a)
    return snap ? Math.round(v / 10) * 10 : v
  }
  const xa = r(box.x0, box.x1)
  const xb = r(box.x0, box.x1)
  const ya = r(box.y0, box.y1)
  const yb = r(box.y0, box.y1)
  return { x0: Math.min(xa, xb), y0: Math.min(ya, yb), x1: Math.max(xa, xb), y1: Math.max(ya, yb) }
}

describe('searchKdTree', () => {
  it('empty tree', () => {
    expect(searchKdTree([], buildKdTree([]), { x0: 0, y0: 0, x1: 500, y1: 500 })).toEqual({
      reported: [], visited: 0, inside: 0, pruned: 0,
    })
  })

  it('random 200 × 5 queries = brute force', () => {
    const rng = mulberry32(2026)
    for (let s = 0; s < 200; s++) {
      const n = 1 + Math.floor(rng() * 40)
      const snap = s % 2 === 1
      let pts = randomPointSet(rng, n, PLANE_BOX, 0)
      if (snap) pts = pts.map((p) => ({ x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 }))
      const tree = buildKdTree(pts)
      expect(checkKdTree(pts, tree)).toEqual({ ok: true })
      for (let q = 0; q < 5; q++) {
        const R = randomRect(rng, PLANE_BOX, snap)
        const res = searchKdTree(pts, tree, R)
        expect(res.reported).toEqual(bruteForceRange(pts, R))
        expect(res.visited).toBeGreaterThanOrEqual(1)
        expect(res.visited).toBeLessThanOrEqual(tree.nodes)
      }
    }
  })

  it('boundary points reported', () => {
    const pts = P([[100, 100], [200, 100], [100, 200], [200, 200], [150, 100], [100, 150], [150, 150], [201, 150], [150, 99]])
    const R = { x0: 100, y0: 100, x1: 200, y1: 200 }
    const res = searchKdTree(pts, buildKdTree(pts), R)
    expect(res.reported).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(res.reported).toEqual(bruteForceRange(pts, R))
  })

  it('degenerate rectangle (x0 = x1)', () => {
    const pts = P([[200, 40], [200, 80], [200, 120], [200, 160], [200, 200], [150, 100], [250, 100], [200, 300]])
    const R = { x0: 200, y0: 60, x1: 200, y1: 200 }
    const res = searchKdTree(pts, buildKdTree(pts), R)
    expect(res.reported).toEqual([1, 2, 3, 4])
    expect(res.reported).toEqual(bruteForceRange(pts, R))
    // a single point as the rectangle
    expect(searchKdTree(pts, buildKdTree(pts), { x0: 150, y0: 100, x1: 150, y1: 100 }).reported).toEqual([5])
  })

  it('counts', () => {
    const R = { x0: 130, y0: 80, x1: 350, y1: 280 }
    const res = searchKdTree(TEXTBOOK, buildKdTree(TEXTBOOK), R)
    expect(res.reported).toEqual(bruteForceRange(TEXTBOOK, R))
    expect(res.reported).toEqual([2, 5, 6])
    // no region of this tree lies inside R: every node is either searched or skipped
    expect(res).toMatchObject({ visited: 17, inside: 0, pruned: 2 })

    const grid: Pt[] = []
    for (const y of [60, 140, 220, 300]) for (const x of [80, 180, 280, 380]) grid.push({ x, y })
    const G = { x0: 150, y0: 100, x1: 330, y1: 260 }
    const g = searchKdTree(grid, buildKdTree(grid), G)
    expect(g.reported).toEqual(bruteForceRange(grid, G))
    expect(g).toEqual({ reported: [5, 6, 9, 10], visited: 21, inside: 1, pruned: 5 })
    expect(g.visited).toBeGreaterThan(0)
    expect(g.inside).toBeGreaterThan(0)
    expect(g.pruned).toBeGreaterThan(0)
  })

  it('query covering everything visits only the root', () => {
    const tree = buildKdTree(TEXTBOOK)
    expect(searchKdTree(TEXTBOOK, tree, PLANE_BOX)).toEqual({
      reported: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], visited: 1, inside: 2, pruned: 0,
    })
  })
})

describe('searchKdTree recorder', () => {
  it('recorder lines and descriptions', () => {
    const tree = buildKdTree(SMALL, SMALL_BOX)
    const { steps, rec } = record()
    const res = searchKdTree(SMALL, tree, { x0: 15, y0: 15, x1: 50, y1: 50 }, rec)
    expect(steps.map((s) => [s.line, s.description])).toEqual([
      [16, 'region(lc) intersects R → descend'],
      [15, 'region(lc) is disjoint from R → skip'],
      [20, 'region(rc) intersects R → descend'],
      [12, 'Leaf v3 lies in R → report'],
      [20, 'region(rc) intersects R → descend'],
      [16, 'region(lc) intersects R → descend'],
      [12, 'Leaf v4 lies in R → report'],
      [18, 'region(rc) lies in R → report its 1 point'],
      [20, 'Done: 3 points reported, 5 nodes visited, 1 subtree reported whole, 1 subtree skipped'],
    ])
    expect(steps.map((s) => s.patch)).toEqual([
      { current: 0, test: { child: 1, relation: 'intersects' } },
      { current: 1, test: { child: 2, relation: 'disjoint' } },
      { current: 1, test: { child: 3, relation: 'intersects' } },
      { current: 3, newlyReported: [2] },
      { current: 0, test: { child: 4, relation: 'intersects' } },
      { current: 4, test: { child: 5, relation: 'intersects' } },
      { current: 5, newlyReported: [3] },
      { current: 4, test: { child: 6, relation: 'inside' }, newlyReported: [1] },
      {},
    ])
    expect(steps.map((s) => s.ctx.phase)).toEqual([...Array(8).fill('query'), 'done'])
    expect(steps.every((s) => s.ctx.nodes.length === 7)).toBe(true)
    expect(steps[3].ctx).toMatchObject({
      visited: [0, 1, 3], reported: [2], inside: [], pruned: [2], counts: { visited: 3, inside: 0, pruned: 1 },
    })
    expect(steps[8].ctx).toMatchObject({
      visited: [0, 1, 3, 4, 5], reported: [1, 2, 3], inside: [6], pruned: [2], counts: { visited: 5, inside: 1, pruned: 1 },
    })
    expect(steps[8].ctx.nodes[6]).toEqual({
      id: 6, parent: 4, side: 'right', depth: 2, region: { x0: 20, y0: 20, x1: 50, y1: 50 }, point: 1, size: 1,
    })
    expect(res).toEqual({ reported: [1, 2, 3], visited: 5, inside: 1, pruned: 1 })
  })

  it('leaf outside R', () => {
    const tree = buildKdTree(SMALL, SMALL_BOX)
    const { steps, rec } = record()
    searchKdTree(SMALL, tree, { x0: 15, y0: 5, x1: 50, y1: 50 }, rec)
    expect(steps.map((s) => [s.line, s.description])).toEqual([
      [16, 'region(lc) intersects R → descend'],
      [16, 'region(lc) intersects R → descend'],
      [11, 'Leaf v1 lies outside R'],
      [20, 'region(rc) intersects R → descend'],
      [12, 'Leaf v3 lies in R → report'],
      [20, 'region(rc) intersects R → descend'],
      [16, 'region(lc) intersects R → descend'],
      [12, 'Leaf v4 lies in R → report'],
      [18, 'region(rc) lies in R → report its 1 point'],
      [20, 'Done: 3 points reported, 6 nodes visited, 1 subtree reported whole, 0 subtrees skipped'],
    ])
    expect(steps[2].patch).toEqual({ current: 2 })
  })

  it('whole subtrees and plural forms', () => {
    const tree = buildKdTree(SMALL, SMALL_BOX)
    const { steps, rec } = record()
    searchKdTree(SMALL, tree, SMALL_BOX, rec)
    expect(steps.map((s) => [s.line, s.description])).toEqual([
      [14, 'region(lc) lies in R → report its 2 points'],
      [18, 'region(rc) lies in R → report its 2 points'],
      [20, 'Done: 4 points reported, 1 node visited, 2 subtrees reported whole, 0 subtrees skipped'],
    ])
    expect(steps[0].patch).toEqual({ current: 0, test: { child: 1, relation: 'inside' }, newlyReported: [0, 2] })
    expect(steps[1].patch.newlyReported).toEqual([1, 3])
    expect(steps[2].ctx.reported).toEqual([0, 1, 2, 3])
  })

  it('skipped right child and singular forms', () => {
    const tree = buildKdTree(SMALL, SMALL_BOX)
    const { steps, rec } = record()
    searchKdTree(SMALL, tree, { x0: 0, y0: 0, x1: 12, y1: 12 }, rec)
    expect(steps.map((s) => [s.line, s.description])).toEqual([
      [16, 'region(lc) intersects R → descend'],
      [16, 'region(lc) intersects R → descend'],
      [12, 'Leaf v1 lies in R → report'],
      [20, 'region(rc) intersects R → descend'],
      [11, 'Leaf v3 lies outside R'],
      [19, 'region(rc) is disjoint from R → skip'],
      [20, 'Done: 1 point reported, 4 nodes visited, 0 subtrees reported whole, 1 subtree skipped'],
    ])
  })

  it('snapshots are copies', () => {
    const tree = buildKdTree(SMALL, SMALL_BOX)
    const { steps, rec } = record()
    searchKdTree(SMALL, tree, { x0: 15, y0: 15, x1: 50, y1: 50 }, rec)
    steps[0].ctx.visited.push(99)
    steps[0].ctx.nodes[0].region.x0 = -1
    expect(steps[1].ctx.visited).toEqual([0, 1])
    expect(steps[1].ctx.nodes[0].region.x0).toBe(0)
    expect(tree.root!.region.x0).toBe(0)
  })
})
