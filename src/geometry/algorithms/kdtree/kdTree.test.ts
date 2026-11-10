import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { mulberry32 } from '../delaunay/delaunay'
import { randomPointSet } from '../delaunay/verify'
import { PLANE_BOX, buildKdTree, label, type KdNode } from './kdTree'
import type { KdRecorderContext } from './kdState'
import { checkKdTree } from './verify'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))

const TEXTBOOK = P([
  [60, 280], [110, 90], [150, 200], [200, 320], [240, 60],
  [280, 170], [330, 260], [370, 110], [410, 300], [430, 40],
])

function leaves(node: KdNode | null): number[] {
  if (!node) return []
  return node.kind === 'leaf' ? [node.point] : [...leaves(node.left), ...leaves(node.right)]
}

function record() {
  const steps: { line: number; description: string; ctx: KdRecorderContext; current?: number }[] = []
  const rec = (line: number, description: string, patch: { current?: number }, ctx: KdRecorderContext) =>
    steps.push({ line, description, ctx, current: patch.current })
  return { steps, rec }
}

describe('label', () => {
  it('is 1-based', () => {
    expect(label(0)).toBe('v1')
    expect(label(9)).toBe('v10')
  })
})

describe('buildKdTree', () => {
  it('n = 0 → root null', () => {
    const t = buildKdTree([])
    expect(t.root).toBeNull()
    expect(t.nodes).toBe(0)
    expect(t.depth).toBe(0)
    expect(t.box).toEqual(PLANE_BOX)
    expect(checkKdTree([], t)).toEqual({ ok: true })
  })

  it('single point → leaf', () => {
    const t = buildKdTree(P([[100, 200]]))
    expect(t.root).toEqual({ kind: 'leaf', id: 0, depth: 0, point: 0, region: PLANE_BOX })
    expect(t.nodes).toBe(1)
    expect(t.depth).toBe(0)
  })

  it('two points → split, two leaves', () => {
    const box = { x0: 0, y0: 0, x1: 100, y1: 100 }
    const t = buildKdTree(P([[70, 10], [30, 50]]), box)
    expect(t.root).toEqual({
      kind: 'split',
      id: 0,
      depth: 0,
      axis: 'x',
      value: 30,
      size: 2,
      region: box,
      left: { kind: 'leaf', id: 1, depth: 1, point: 1, region: { x0: 0, y0: 0, x1: 30, y1: 100 } },
      right: { kind: 'leaf', id: 2, depth: 1, point: 0, region: { x0: 30, y0: 0, x1: 100, y1: 100 } },
    })
    expect(t.nodes).toBe(3)
    expect(t.depth).toBe(1)
  })

  it('textbook preset shape', () => {
    const t = buildKdTree(TEXTBOOK)
    expect(t.nodes).toBe(19)
    expect(t.depth).toBe(4)
    const root = t.root!
    expect(root.kind).toBe('split')
    if (root.kind !== 'split') return
    expect(root.axis).toBe('x')
    expect(root.value).toBe(240)
    expect(root.size).toBe(10)
    expect(leaves(root.left).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    expect(leaves(root.right).sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9])
    expect(root.left.kind === 'split' && root.left.axis).toBe('y')
    // left half by y: 60, 90, 200 | 280, 320 → value 200
    expect(root.left.kind === 'split' && root.left.value).toBe(200)
    expect(root.left.region).toEqual({ x0: 15, y0: 15, x1: 240, y1: 345 })
    expect(root.right.region).toEqual({ x0: 240, y0: 15, x1: 455, y1: 345 })
    expect(checkKdTree(TEXTBOOK, t)).toEqual({ ok: true })
  })

  it('assigns pre-order ids', () => {
    const t = buildKdTree(TEXTBOOK)
    const ids: number[] = []
    const walk = (v: KdNode) => {
      ids.push(v.id)
      if (v.kind === 'split') {
        walk(v.left)
        walk(v.right)
      }
    }
    walk(t.root!)
    expect(ids).toEqual(Array.from({ length: 19 }, (_, i) => i))
  })

  it('equal x coordinates', () => {
    const pts = P([[200, 40], [200, 80], [200, 120], [200, 160], [200, 200]])
    const t = buildKdTree(pts)
    expect(leaves(t.root).sort()).toEqual([0, 1, 2, 3, 4])
    expect(t.depth).toBe(3)
    expect(t.nodes).toBe(9)
    expect(checkKdTree(pts, t)).toEqual({ ok: true })
  })

  it('grid 4x4', () => {
    const pts: Pt[] = []
    for (const y of [60, 140, 220, 300]) for (const x of [80, 180, 280, 380]) pts.push({ x, y })
    const t = buildKdTree(pts)
    expect(t.depth).toBe(4)
    expect(t.nodes).toBe(31)
    expect(checkKdTree(pts, t)).toEqual({ ok: true })
  })

  it('duplicates', () => {
    const pts = P([[100, 100], [300, 200], [100, 100], [50, 300]])
    const t = buildKdTree(pts)
    expect(leaves(t.root).sort()).toEqual([0, 1, 2, 3])
    expect(t.nodes).toBe(7)
    expect(t.depth).toBe(2)
    expect(checkKdTree(pts, t)).toEqual({ ok: true })
  })

  it('height = ceil(log2 n)', () => {
    const rng = mulberry32(7)
    for (let n = 1; n <= 64; n++) {
      const pts = randomPointSet(rng, n, PLANE_BOX, 0)
      const t = buildKdTree(pts)
      expect(t.depth).toBe(Math.ceil(Math.log2(n)))
      expect(t.nodes).toBe(2 * n - 1)
      expect(checkKdTree(pts, t)).toEqual({ ok: true })
    }
  })
})

describe('buildKdTree recorder', () => {
  it('recorder lines and descriptions', () => {
    const pts = P([[10, 10], [30, 40], [20, 30], [40, 20]])
    const { steps, rec } = record()
    buildKdTree(pts, { x0: 0, y0: 0, x1: 50, y1: 50 }, rec)
    expect(steps.map((s) => [s.line, s.description, s.current])).toEqual([
      [4, 'Split v1, v2, v3, v4 at x = 20.0 (median): 2 left, 2 right', 0],
      [5, 'Split v1, v3 at y = 10.0 (median): 1 left, 1 right', 1],
      [2, 'Leaf v1', 2],
      [2, 'Leaf v3', 3],
      [5, 'Split v2, v4 at y = 20.0 (median): 1 left, 1 right', 4],
      [2, 'Leaf v4', 5],
      [2, 'Leaf v2', 6],
      [9, 'kd-tree ready: 7 nodes, depth 2', undefined],
    ])
    expect(steps.map((s) => s.ctx.nodes.length)).toEqual([1, 2, 3, 4, 5, 6, 7, 7])
    expect(steps.every((s) => s.ctx.phase === 'build')).toBe(true)
    const last = steps[steps.length - 1].ctx
    expect(last.nodes.map((v) => [v.id, v.parent, v.side, v.depth, v.size])).toEqual([
      [0, null, null, 0, 4],
      [1, 0, 'left', 1, 2],
      [2, 1, 'left', 2, 1],
      [3, 1, 'right', 2, 1],
      [4, 0, 'right', 1, 2],
      [5, 4, 'left', 2, 1],
      [6, 4, 'right', 2, 1],
    ])
    expect(last.nodes[0]).toEqual({
      id: 0, parent: null, side: null, depth: 0, region: { x0: 0, y0: 0, x1: 50, y1: 50 }, axis: 'x', value: 20, size: 4,
    })
    expect(last.nodes[6]).toEqual({
      id: 6, parent: 4, side: 'right', depth: 2, region: { x0: 20, y0: 20, x1: 50, y1: 50 }, point: 1, size: 1,
    })
    expect(last).toMatchObject({ visited: [], reported: [], inside: [], pruned: [], counts: { visited: 0, inside: 0, pruned: 0 } })
  })

  it('snapshots are copies', () => {
    const { steps, rec } = record()
    buildKdTree(P([[10, 10], [30, 40], [20, 30]]), PLANE_BOX, rec)
    steps[0].ctx.nodes[0].region.x0 = -999
    expect(steps[1].ctx.nodes[0].region.x0).toBe(15)
    expect(steps[0].ctx.nodes).not.toBe(steps[1].ctx.nodes)
  })

  it('ties broken by y / by x', () => {
    const { steps, rec } = record()
    buildKdTree(P([[200, 40], [200, 80], [200, 120], [200, 160], [200, 200]]), PLANE_BOX, rec)
    expect(steps[0].description).toBe('Split v1, v2, v3, v4, v5 at x = 200.0 (median): 3 left, 2 right — ties broken by y')
    expect(steps[1].description).toBe('Split v1, v2, v3 at y = 80.0 (median): 2 left, 1 right')

    const r2 = record()
    buildKdTree(P([[10, 5], [20, 5], [30, 5], [40, 5]]), PLANE_BOX, r2.rec)
    expect(r2.steps[0].description).toBe('Split v1, v2, v3, v4 at x = 20.0 (median): 2 left, 2 right')
    expect(r2.steps[1].description).toBe('Split v1, v2 at y = 5.0 (median): 1 left, 1 right — ties broken by x')
  })

  it('more than 10 points are counted, not listed', () => {
    const { steps, rec } = record()
    const pts = Array.from({ length: 14 }, (_, i) => ({ x: 20 + 30 * i, y: 100 + ((i * 37) % 200) }))
    buildKdTree(pts, PLANE_BOX, rec)
    expect(steps[0].description).toBe('Split 14 points at x = 200.0 (median): 7 left, 7 right')
    expect(steps[steps.length - 1].description).toBe('kd-tree ready: 27 nodes, depth 4')
  })

  it('singular forms and empty input', () => {
    const one = record()
    buildKdTree(P([[1, 2]]), PLANE_BOX, one.rec)
    expect(one.steps.map((s) => [s.line, s.description])).toEqual([
      [2, 'Leaf v1'],
      [9, 'kd-tree ready: 1 node, depth 0'],
    ])
    const none = record()
    buildKdTree([], PLANE_BOX, none.rec)
    expect(none.steps.map((s) => [s.line, s.description])).toEqual([[9, 'kd-tree ready: 0 nodes, depth 0']])
  })
})
