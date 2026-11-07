import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { TriangleMesh } from './mesh'
import { P_MINUS_1, P_MINUS_2, orient } from './symbolic'

const pts = (...xy: [number, number][]): Pt[] => xy.map(([x, y]) => ({ x, y }))

function expectAllCcw(points: Pt[], mesh: TriangleMesh) {
  for (const t of mesh.alive()) {
    const [a, b, c] = mesh.tris[t].v
    expect(orient(points, a, b, c)).toBe(1)
  }
}

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('TriangleMesh', () => {
  const base = pts([0, 10], [0, 0], [3, 4], [0, 5])

  it('init creates a single CCW triangle', () => {
    const m = new TriangleMesh(base)
    const t = m.init(0, P_MINUS_1, P_MINUS_2)
    expect(m.alive()).toEqual([t])
    expect(m.tris[t].v).toEqual([0, P_MINUS_1, P_MINUS_2])
    expect(m.tris[t].n).toEqual([-1, -1, -1])
    expect(m.checkAdjacency()).toBeNull()
    expectAllCcw(base, m)
  })

  it('split3 makes three CCW mutually adjacent triangles', () => {
    const m = new TriangleMesh(base)
    const t = m.init(0, P_MINUS_1, P_MINUS_2)
    const loc = m.locate(1)
    expect(loc).toEqual({ t })
    const created = m.split3(t, 1)
    expect(m.alive().sort()).toEqual([...created].sort())
    expect(m.tris[t].alive).toBe(false)
    expectAllCcw(base, m)
    expect(m.checkAdjacency()).toBeNull()
    for (const c of created) {
      expect(m.tris[c].v).toContain(1)
      expect(m.tris[c].n.filter((x) => created.includes(x))).toHaveLength(2)
    }
  })

  it('split4 splits a shared real edge into four triangles', () => {
    const m = new TriangleMesh(base)
    m.split3(m.init(0, P_MINUS_1, P_MINUS_2), 1)
    const loc = m.locate(3)
    expect(loc.edge).toBeDefined()
    const { t, edge } = loc
    const [a, b] = [m.tris[t].v[edge!], m.tris[t].v[(edge! + 1) % 3]]
    expect([a, b].sort()).toEqual([0, 1])
    const before = m.alive().length
    const created = m.split4(t, edge!, 3)
    expect(created).toHaveLength(4)
    expect(m.alive()).toHaveLength(before + 2)
    expect(new Set(created).size).toBe(4)
    for (const c of created) expect(m.tris[c].v).toContain(3)
    expectAllCcw(base, m)
    expect(m.checkAdjacency()).toBeNull()
    expect(m.edges()).toContainEqual([0, 3])
    expect(m.edges()).toContainEqual([1, 3])
    expect(m.edges()).not.toContainEqual([0, 1])
  })

  it('locate throws when no triangle contains the point', () => {
    const m = new TriangleMesh(pts([0, 10], [0, 0], [100, 100]))
    m.init(0, P_MINUS_1, P_MINUS_2)
    m.split3(0, 1)
    // With every triangle dead, nothing can contain the point.
    for (const t of m.tris) t.alive = false
    expect(() => m.locate(2)).toThrow('point is outside every triangle')
  })

  it('flip swaps the diagonal of a convex quad and flipping back restores it', () => {
    const sq = pts([0, 10], [-5, 0], [5, 0], [0, 4])
    const m = new TriangleMesh(sq)
    m.init(0, P_MINUS_1, P_MINUS_2)
    for (const p of [1, 2, 3]) {
      const { t, edge } = m.locate(p)
      if (edge === undefined) m.split3(t, p)
      else m.split4(t, edge, p)
    }
    const key = ([a, b]: number[]) => [Math.min(a, b), Math.max(a, b)]
    let flipped = false
    for (const t of m.alive()) {
      for (let e = 0; e < 3 && !flipped; e++) {
        const o = m.opposite(t, e)
        if (!o) continue
        const { v } = m.tris[t]
        const r = v[e], b = v[(e + 1) % 3], c = v[(e + 2) % 3], k = o.vertex
        if (orient(sq, r, b, k) !== 1 || orient(sq, r, k, c) !== 1) continue
        const f = m.flip(t, e)
        expect(f.newEdge).toEqual([r, k])
        expect(m.tris[f.a].v[0]).toBe(r)
        expect(m.tris[f.b].v[0]).toBe(r)
        expect(m.checkAdjacency()).toBeNull()
        expectAllCcw(sq, m)
        expect(m.edges()).toContainEqual(key([r, k]))
        expect(m.edges()).not.toContainEqual(key([b, c]))
        // In triangle a the edge opposite b is r-k; flipping it restores b-c.
        const back = m.flip(f.a, m.tris[f.a].v.indexOf(b))
        expect(back.newEdge).toEqual([b, c])
        expect(m.checkAdjacency()).toBeNull()
        expect(m.edges()).toContainEqual(key([b, c]))
        expect(m.edges()).not.toContainEqual(key([r, k]))
        flipped = true
      }
    }
    expect(flipped).toBe(true)
  })

  it('opposite returns the neighbor and its far vertex, null on the boundary', () => {
    const m = new TriangleMesh(base)
    const [a] = m.split3(m.init(0, P_MINUS_1, P_MINUS_2), 1)
    expect(m.tris[a].n[2]).toBe(-1)
    expect(m.opposite(a, 2)).toBeNull()
    const o = m.opposite(a, 0)!
    expect(o.tri).toBe(m.tris[a].n[0])
    expect(m.tris[o.tri].v[0] === o.vertex || m.tris[o.tri].v.includes(o.vertex)).toBe(true)
  })

  it('edges() has no duplicates and realTriangles() drops symbolic ones', () => {
    const m = new TriangleMesh(base)
    m.split3(m.init(0, P_MINUS_1, P_MINUS_2), 1)
    const e = m.edges()
    expect(new Set(e.map(([a, b]) => `${a},${b}`)).size).toBe(e.length)
    expect(e).toHaveLength(6)
    for (const [a, b] of e) expect(a).toBeLessThan(b)
    expect(m.realTriangles()).toEqual([])
    const snap = m.snapshot()
    expect(snap).toHaveLength(m.tris.length)
    snap[0].v[0] = 99
    expect(m.tris[0].v[0]).not.toBe(99)
  })

  it('100 random split/flip steps keep adjacency and orientation valid', () => {
    const rnd = mulberry(7)
    const points: Pt[] = Array.from({ length: 40 }, () => ({ x: rnd() * 100, y: rnd() * 100 }))
    let p0 = 0
    for (let i = 1; i < points.length; i++) if (points[i].y > points[p0].y) p0 = i
    const m = new TriangleMesh(points)
    m.init(p0, P_MINUS_1, P_MINUS_2)
    let flips = 0
    for (let i = 0; i < points.length; i++) {
      if (i === p0) continue
      const { t, edge } = m.locate(i)
      if (edge === undefined) m.split3(t, i)
      else m.split4(t, edge, i)
      expect(m.checkAdjacency()).toBeNull()
      for (let s = 0; s < 3; s++) {
        const alive = m.alive()
        const tt = alive[Math.floor(rnd() * alive.length)]
        const e = Math.floor(rnd() * 3)
        const o = m.opposite(tt, e)
        if (!o) continue
        const { v } = m.tris[tt]
        const r = v[e], b = v[(e + 1) % 3], c = v[(e + 2) % 3]
        if (orient(points, r, b, o.vertex) !== 1 || orient(points, r, o.vertex, c) !== 1) continue
        m.flip(tt, e)
        flips++
        expect(m.checkAdjacency()).toBeNull()
      }
      expectAllCcw(points, m)
    }
    expect(flips).toBeGreaterThan(20)
    // Euler: 2n+1 triangles for n real points + 2 symbolic with a triangular outer face.
    expect(m.alive()).toHaveLength(2 * (points.length - 1) + 1)
  })
})
