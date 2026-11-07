import { describe, expect, it } from 'vitest'
import type { Pt, Triangle } from '../../types'
import { distance } from '../../primitives'
import { mulberry32 } from './delaunay'
import { hullBoundaryCount, isDelaunay, randomPointSet } from './verify'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))

describe('isDelaunay', () => {
  it('accepts either diagonal of a square (cocircular)', () => {
    const sq = P([[0, 0], [100, 0], [100, 100], [0, 100]])
    expect(isDelaunay(sq, [[0, 1, 2], [0, 2, 3]])).toEqual({ ok: true })
    expect(isDelaunay(sq, [[0, 1, 3], [1, 2, 3]])).toEqual({ ok: true })
  })

  it('rejects the wrong diagonal of a squashed square', () => {
    // rhombus: the short diagonal 1-3 is Delaunay, the long one 0-2 is not
    const rh = P([[0, 0], [100, -30], [200, 0], [100, 30]])
    expect(isDelaunay(rh, [[0, 1, 3], [1, 2, 3]])).toEqual({ ok: true })
    const bad = isDelaunay(rh, [[0, 1, 2], [0, 2, 3]])
    expect(bad.ok).toBe(false)
    expect(bad.reason).toMatch(/circumcircle/)
  })

  it('rejects clockwise triangles, wrong counts and gaps', () => {
    const sq = P([[0, 0], [100, 0], [100, 100], [0, 100]])
    expect(isDelaunay(sq, [[0, 2, 1], [0, 3, 2]]).reason).toMatch(/not counter-clockwise/)
    expect(isDelaunay(sq, [[0, 1, 2]]).reason).toMatch(/expected 2 triangles/)
    const withCenter = P([[0, 0], [100, 0], [100, 100], [0, 100], [50, 40]])
    // four triangles around the centre point, but one is listed twice and one is missing
    const tris: Triangle[] = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [2, 3, 4]]
    expect(isDelaunay(withCenter, tris).ok).toBe(false)
  })

  it('accepts no triangles for collinear points and fewer than three points', () => {
    expect(isDelaunay(P([[0, 0], [10, 0], [20, 0]]), [])).toEqual({ ok: true })
    expect(isDelaunay(P([[0, 0], [10, 5]]), [])).toEqual({ ok: true })
    expect(isDelaunay(P([[0, 0], [10, 0], [20, 0]]), [[0, 1, 2]]).ok).toBe(false)
  })
})

describe('hullBoundaryCount', () => {
  it('counts hull vertices and collinear points on hull edges', () => {
    const grid: Pt[] = []
    for (const y of [60, 140, 220, 300]) for (const x of [160, 320, 480, 640]) grid.push({ x, y })
    expect(hullBoundaryCount(grid)).toBe(12)
    expect(hullBoundaryCount(P([[150, 100], [300, 100], [450, 100], [600, 100], [380, 280]]))).toBe(5)
    expect(hullBoundaryCount(P([[0, 0], [10, 0], [20, 0]]))).toBe(3)
  })
})

describe('randomPointSet', () => {
  it('stays in the box and keeps the minimum distance', () => {
    const rng = mulberry32(5)
    const box = { x0: 93, y0: 43, x1: 682, y1: 317 }
    for (let s = 0; s < 20; s++) {
      const pts = randomPointSet(rng, 30, box, 25)
      expect(pts).toHaveLength(30)
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(box.x0)
        expect(p.x).toBeLessThanOrEqual(box.x1)
        expect(p.y).toBeGreaterThanOrEqual(box.y0)
        expect(p.y).toBeLessThanOrEqual(box.y1)
      }
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) expect(distance(pts[i], pts[j])).toBeGreaterThanOrEqual(25)
    }
  })
})
