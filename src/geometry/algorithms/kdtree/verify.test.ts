import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { buildKdTree, type KdNode, type KdTree } from './kdTree'
import { bruteForceRange, checkKdTree } from './verify'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))

const TEXTBOOK = P([
  [60, 280], [110, 90], [150, 200], [200, 320], [240, 60],
  [280, 170], [330, 260], [370, 110], [410, 300], [430, 40],
])

const clone = (t: KdTree): KdTree => structuredClone(t)

/** First leaf in pre-order below `v`. */
function firstLeaf(v: KdNode): Extract<KdNode, { kind: 'leaf' }> {
  return v.kind === 'leaf' ? v : firstLeaf(v.left)
}

describe('bruteForceRange', () => {
  it('returns the indices in the closed rectangle, ascending', () => {
    const pts = P([[5, 5], [0, 0], [10, 10], [11, 5], [5, -1]])
    expect(bruteForceRange(pts, { x0: 0, y0: 0, x1: 10, y1: 10 })).toEqual([0, 1, 2])
    expect(bruteForceRange(pts, { x0: 5, y0: -1, x1: 5, y1: 5 })).toEqual([0, 4])
    expect(bruteForceRange([], { x0: 0, y0: 0, x1: 1, y1: 1 })).toEqual([])
  })
})

describe('checkKdTree', () => {
  it('accepts built trees', () => {
    expect(checkKdTree(TEXTBOOK, buildKdTree(TEXTBOOK))).toEqual({ ok: true })
    expect(checkKdTree([], buildKdTree([]))).toEqual({ ok: true })
  })

  it('rejects a split axis that does not alternate', () => {
    // on a diagonal the x and y orders agree, so only the axis is wrong
    const pts = P([[50, 50], [100, 100], [150, 150], [200, 200]])
    expect(checkKdTree(pts, buildKdTree(pts))).toEqual({ ok: true })
    for (const flip of ['root', 'child'] as const) {
      const t = clone(buildKdTree(pts))
      const root = t.root!
      if (root.kind !== 'split' || root.left.kind !== 'split') throw new Error('unexpected shape')
      if (flip === 'root') root.axis = 'y'
      else root.left.axis = 'x'
      const res = checkKdTree(pts, t)
      expect(res.ok).toBe(false)
      expect(res.reason).toMatch(/axis/)
    }
  })

  it('rejects a missing root', () => {
    const t = clone(buildKdTree(TEXTBOOK))
    t.root = null
    const res = checkKdTree(TEXTBOOK, t)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/leaf/)
  })

  it('rejects a removed leaf', () => {
    const t = clone(buildKdTree(TEXTBOOK))
    const root = t.root!
    if (root.kind !== 'split' || root.left.kind !== 'split') throw new Error('unexpected shape')
    // replace the left child's split by its right subtree: the points of its left subtree vanish
    root.left = root.left.right
    const res = checkKdTree(TEXTBOOK, t)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/leaf/)
  })

  it('rejects a point stored twice', () => {
    const t = clone(buildKdTree(TEXTBOOK))
    const a = firstLeaf(t.root!)
    const root = t.root!
    if (root.kind !== 'split') throw new Error('unexpected shape')
    firstLeaf(root.right).point = a.point
    const res = checkKdTree(TEXTBOOK, t)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/leaf/)
  })

  it('rejects a point on the wrong side', () => {
    const t = clone(buildKdTree(TEXTBOOK))
    const root = t.root!
    if (root.kind !== 'split') throw new Error('unexpected shape')
    const l = firstLeaf(root.left)
    const r = firstLeaf(root.right)
    ;[l.point, r.point] = [r.point, l.point]
    const res = checkKdTree(TEXTBOOK, t)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/side/)
  })

  it('rejects a wrong split value', () => {
    const t = clone(buildKdTree(TEXTBOOK))
    const root = t.root!
    if (root.kind !== 'split') throw new Error('unexpected shape')
    root.value = 250
    const res = checkKdTree(TEXTBOOK, t)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/side/)
  })

  it('rejects a child region outside its parent', () => {
    const t = clone(buildKdTree(TEXTBOOK))
    const root = t.root!
    if (root.kind !== 'split') throw new Error('unexpected shape')
    root.right.region = { ...root.right.region, x1: 500 }
    const res = checkKdTree(TEXTBOOK, t)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/region/)
  })

  it('rejects a point outside its leaf region', () => {
    const t = clone(buildKdTree(TEXTBOOK))
    const leaf = firstLeaf(t.root!)
    leaf.region = { x0: 15, y0: 15, x1: 20, y1: 20 }
    const res = checkKdTree(TEXTBOOK, t)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/region/)
  })

  it('rejects an unbalanced tree', () => {
    // 4 points split 3 | 1 at the root: every other check passes, but the height is 3, not ⌈log₂ 4⌉ = 2
    const pts = P([[10, 10], [20, 20], [30, 30], [40, 40]])
    const box = { x0: 0, y0: 0, x1: 50, y1: 50 }
    const leaf = (id: number, depth: number, point: number, region: typeof box): KdNode => ({ kind: 'leaf', id, depth, point, region })
    const tree: KdTree = {
      box,
      nodes: 7,
      depth: 3,
      root: {
        kind: 'split', id: 0, depth: 0, axis: 'x', value: 30, size: 4, region: box,
        right: leaf(6, 1, 3, { x0: 30, y0: 0, x1: 50, y1: 50 }),
        left: {
          kind: 'split', id: 1, depth: 1, axis: 'y', value: 20, size: 3, region: { x0: 0, y0: 0, x1: 30, y1: 50 },
          right: leaf(5, 2, 2, { x0: 0, y0: 20, x1: 30, y1: 50 }),
          left: {
            kind: 'split', id: 2, depth: 2, axis: 'x', value: 10, size: 2, region: { x0: 0, y0: 0, x1: 30, y1: 20 },
            left: leaf(3, 3, 0, { x0: 0, y0: 0, x1: 10, y1: 20 }),
            right: leaf(4, 3, 1, { x0: 10, y0: 0, x1: 30, y1: 20 }),
          },
        },
      },
    }
    const res = checkKdTree(pts, tree)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/height/)
  })
})
