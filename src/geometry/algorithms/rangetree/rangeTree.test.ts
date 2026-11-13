import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { mulberry32 } from '../delaunay/delaunay'
import { compareOn } from '../kdtree/kdTree'
import { buildTree1D, rangeTree, type RTNode, type Tree1DNode } from './rangeTree'
import { checkRangeTree, checkTree1D } from './verify'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))

/** n random points; with `lattice` on a 5×5 integer lattice (heavy ties and duplicates). */
function randomSet(rng: () => number, n: number, lattice: boolean): Pt[] {
  const c = (a: number, b: number) => (lattice ? a + 50 * Math.floor(rng() * 5) : Math.round(a + rng() * (b - a)))
  return Array.from({ length: n }, () => ({ x: c(15, 355), y: c(15, 465) }))
}

function leaves1D(v: Tree1DNode | null): Tree1DNode[] {
  if (!v) return []
  return v.kind === 'leaf' ? [v] : [...leaves1D(v.left), ...leaves1D(v.right)]
}

const mainLeaves = (nodes: RTNode[]) => nodes.filter((v) => v.kind === 'leaf')

describe('buildTree1D', () => {
  it('balances and orders, m = 1..17', () => {
    const rng = mulberry32(51)
    for (let m = 1; m <= 17; m++) {
      for (const lattice of [false, true]) {
        const pts = randomSet(rng, m + 3, lattice)
        // a shuffled subset of size m: the input order must not matter
        const idx = Array.from({ length: m + 3 }, (_, i) => i)
          .sort(() => rng() - 0.5)
          .slice(0, m)
        for (const axis of ['x', 'y'] as const) {
          const t = buildTree1D(pts, idx, axis)
          expect(t.axis).toBe(axis)
          expect(t.size).toBe(m)
          const sorted = [...idx].sort((a, b) => compareOn(pts, axis, a, b))
          expect(leaves1D(t.root).map((v) => (v.kind === 'leaf' ? v.point : -1))).toEqual(sorted)
          // the same tree for another input order
          expect(buildTree1D(pts, [...idx].reverse(), axis)).toEqual(t)

          let pre = 0
          const walk = (v: Tree1DNode): number => {
            expect(v.id).toBe(pre++)
            if (v.kind === 'leaf') return 1
            const size = leaves1D(v).length
            const L = leaves1D(v.left)
            expect(L.length).toBe(Math.ceil(size / 2))
            const last = L[L.length - 1]
            expect(last.kind === 'leaf' && v.value === pts[last.point][axis]).toBe(true)
            return walk(v.left) + walk(v.right)
          }
          expect(walk(t.root!)).toBe(m)
          expect(checkTree1D(pts, t, idx)).toEqual({ ok: true })
        }
      }
    }
  })

  it('empty input → root null', () => {
    expect(buildTree1D([], [], 'y')).toEqual({ axis: 'y', root: null, size: 0 })
  })

  it('a single point → one leaf with id 0', () => {
    expect(buildTree1D(P([[3, 4]]), [0], 'x')).toEqual({ axis: 'x', size: 1, root: { kind: 'leaf', id: 0, point: 0 } })
  })

  it('checkTree1D rejects a broken tree', () => {
    const pts = P([[1, 5], [2, 3], [3, 1]])
    const t = buildTree1D(pts, [0, 1, 2], 'y')
    const bad = structuredClone(t)
    if (bad.root?.kind === 'split') bad.root.value = 99
    expect(checkTree1D(pts, bad, [0, 1, 2]).ok).toBe(false)
    expect(checkTree1D(pts, t, [0, 1]).ok).toBe(false)
  })
})

describe('rangeTree', () => {
  it('n = 0 → root null, depth 0, storage 0', () => {
    const t = rangeTree([])
    expect(t).toEqual({ root: null, nodes: [], depth: 0, storage: 0 })
    expect(checkRangeTree([], t)).toEqual({ ok: true })
  })

  it('n = 1 → a leaf with a one-leaf associated tree', () => {
    const t = rangeTree(P([[10, 20]]))
    expect(t.root).toEqual({
      id: 0,
      label: 'p1',
      kind: 'leaf',
      point: 0,
      assoc: { axis: 'y', size: 1, root: { kind: 'leaf', id: 0, point: 0 } },
      depth: 0,
      points: [0],
    })
    expect(t.nodes).toHaveLength(1)
    expect(t.depth).toBe(0)
    expect(t.storage).toBe(1)
  })

  it('n = 2 → split at the smaller x, labels v1, p#', () => {
    const pts = P([[70, 10], [30, 50]])
    const t = rangeTree(pts)
    expect(checkRangeTree(pts, t)).toEqual({ ok: true })
    expect(t.nodes.map((v) => v.label)).toEqual(['v1', 'p2', 'p1'])
    expect(t.root!.value).toBe(30)
    expect(t.root!.points).toEqual([1, 0])
    expect(t.root!.assoc.size).toBe(2)
    expect(t.depth).toBe(1)
    expect(t.storage).toBe(4)
  })

  it('n = 12: depth 4, storage 56, 23 main nodes', () => {
    const pts = randomSet(mulberry32(12), 12, false)
    const t = rangeTree(pts)
    expect(checkRangeTree(pts, t)).toEqual({ ok: true })
    expect(t.depth).toBe(4)
    expect(t.storage).toBe(56)
    expect(t.nodes).toHaveLength(23)
    expect(t.nodes.filter((v) => v.kind === 'split').map((v) => v.label)).toEqual(
      Array.from({ length: 11 }, (_, i) => `v${i + 1}`),
    )
  })

  it('n = 16: storage 80 = n·(depth + 1)', () => {
    const pts = randomSet(mulberry32(16), 16, true)
    const t = rangeTree(pts)
    expect(checkRangeTree(pts, t)).toEqual({ ok: true })
    expect(t.depth).toBe(4)
    expect(t.storage).toBe(80)
  })

  it('structure on 300 random sets, half on a 5×5 lattice', () => {
    const rng = mulberry32(2026)
    for (let s = 0; s < 300; s++) {
      const n = Math.floor(rng() * 21)
      const pts = randomSet(rng, n, s % 2 === 1)
      const t = rangeTree(pts)
      expect(checkRangeTree(pts, t)).toEqual({ ok: true })
      expect(t.storage).toBe(mainLeaves(t.nodes).reduce((a, v) => a + v.depth + 1, 0))
      expect(t.nodes).toHaveLength(Math.max(0, 2 * n - 1))
      t.nodes.forEach((v, i) => expect(v.id).toBe(i))
    }
  })

  it('all points coincident', () => {
    const pts = P(Array.from({ length: 7 }, () => [100, 100] as [number, number]))
    const t = rangeTree(pts)
    expect(checkRangeTree(pts, t)).toEqual({ ok: true })
    expect(t.root!.points).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('is plain data: structuredClone gives an equal tree', () => {
    const pts = randomSet(mulberry32(3), 9, true)
    const t = rangeTree(pts)
    expect(structuredClone(t)).toEqual(t)
  })

  it('checkRangeTree rejects broken trees', () => {
    const pts = randomSet(mulberry32(8), 8, false)
    const t = rangeTree(pts)
    const breakers: ((b: ReturnType<typeof rangeTree>) => void)[] = [
      (b) => (b.storage += 1),
      (b) => (b.depth += 1),
      (b) => (b.root!.value = -1),
      (b) => (b.root!.assoc.size = 3),
      (b) => (b.root!.points = [...b.root!.points].reverse()),
      (b) => (b.root!.label = 'v9'),
      (b) => {
        const l = b.root!.left!
        b.root!.left = b.root!.right
        b.root!.right = l
      },
    ]
    for (const f of breakers) {
      const b = structuredClone(t)
      // nodes must stay the same objects as the tree's nodes
      const walk = (v: RTNode | undefined, out: RTNode[]): RTNode[] => {
        if (!v) return out
        out.push(v)
        walk(v.left, out)
        walk(v.right, out)
        return out
      }
      b.nodes = walk(b.root!, [])
      f(b)
      expect(checkRangeTree(pts, b).ok).toBe(false)
    }
    expect(checkRangeTree(pts.slice(1), t).ok).toBe(false)
  })
})
