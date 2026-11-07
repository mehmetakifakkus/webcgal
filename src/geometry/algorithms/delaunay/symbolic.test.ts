import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import {
  highestIndex,
  isSymbolic,
  lexHigher,
  orient,
  P_MINUS_1,
  P_MINUS_2,
  pointInTriangle,
} from './symbolic'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer coordinates on a coarse grid, so ties in y and x occur; distinct points. */
function randomPoints(seed: number): Pt[] {
  const rnd = mulberry32(seed)
  const n = 3 + Math.floor(rnd() * 18)
  const pts: Pt[] = []
  while (pts.length < n) {
    const p = { x: Math.floor(rnd() * 8) * 50, y: Math.floor(rnd() * 8) * 50 }
    if (!pts.some((q) => q.x === p.x && q.y === p.y)) pts.push(p)
  }
  return pts
}

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1)

describe('lexHigher / highestIndex', () => {
  it('compares y first, then x', () => {
    expect(lexHigher({ x: 1, y: 5 }, { x: 3, y: 5 })).toBe(false)
    expect(lexHigher({ x: 3, y: 5 }, { x: 1, y: 5 })).toBe(true)
    expect(lexHigher({ x: 0, y: 6 }, { x: 9, y: 5 })).toBe(true)
    expect(lexHigher({ x: 9, y: 5 }, { x: 0, y: 6 })).toBe(false)
  })

  it('picks the highest point, the larger x on a y tie', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 9 }, { x: 5, y: 9 }, { x: 9, y: 3 }]
    expect(highestIndex(pts)).toBe(2)
  })

  it('knows symbolic indices', () => {
    expect(isSymbolic(P_MINUS_1)).toBe(true)
    expect(isSymbolic(P_MINUS_2)).toBe(true)
    expect(isSymbolic(0)).toBe(false)
  })
})

describe('orient', () => {
  it('equals the plain orientation for real points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
    expect(orient(pts, 0, 1, 2)).toBe(1)
    expect(orient(pts, 0, 2, 1)).toBe(-1)
    expect(orient(pts, 0, 1, 1)).toBe(0)
  })

  it('invariant (i): the initial triangle is counter-clockwise', () => {
    for (const seed of SEEDS) {
      const pts = randomPoints(seed)
      expect(orient(pts, highestIndex(pts), P_MINUS_1, P_MINUS_2)).toBe(1)
    }
  })

  it('invariant (ii): every real point lies inside [p0, p-1, p-2]', () => {
    for (const seed of SEEDS) {
      const pts = randomPoints(seed)
      const tri: [number, number, number] = [highestIndex(pts), P_MINUS_1, P_MINUS_2]
      for (let p = 0; p < pts.length; p++) {
        expect(pointInTriangle(pts, tri, p).inside).toBe(true)
      }
    }
  })

  it('invariant (iii): antisymmetry and cyclic consistency for all argument patterns', () => {
    for (const seed of SEEDS) {
      const pts = randomPoints(seed)
      const ids = [...pts.keys(), P_MINUS_1, P_MINUS_2]
      for (const i of ids)
        for (const j of ids)
          for (const k of ids) {
            const o = orient(pts, i, j, k)
            expect(orient(pts, j, k, i)).toBe(o)
            expect(orient(pts, k, i, j)).toBe(o)
            expect(orient(pts, j, i, k)).toBe(-o === 0 ? 0 : -o)
          }
    }
  })

  it('p-1 lies to the left of an upward real edge, p-2 to the right', () => {
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 1 }]
    expect(orient(pts, 0, 1, P_MINUS_1)).toBe(1)
    expect(orient(pts, 1, 0, P_MINUS_1)).toBe(-1)
    expect(orient(pts, 0, 1, P_MINUS_2)).toBe(-1)
    expect(orient(pts, 1, 0, P_MINUS_2)).toBe(1)
  })
})

describe('pointInTriangle', () => {
  const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 0 }]
  const tri: [number, number, number] = [0, 1, 2]

  it('detects interior, edge and exterior points', () => {
    expect(pointInTriangle(pts, tri, 3)).toEqual({ inside: true })
    expect(pointInTriangle(pts, tri, 5).inside).toBe(false)
    expect(pointInTriangle(pts, tri, 6)).toEqual({ inside: true, edge: 0 })
    expect(pointInTriangle(pts, tri, 4)).toEqual({ inside: true, edge: 1 })
  })

  it('handles a triangle with one symbolic vertex', () => {
    // [(4,0), p-1, (0,0)]: the real edge is tri[2]->tri[0], i.e. (0,0)->(4,0), with p-1 to its left.
    const t: [number, number, number] = [1, P_MINUS_1, 0]
    expect(orient(pts, 1, P_MINUS_1, 0)).toBe(1)
    expect(pointInTriangle(pts, t, 3).inside).toBe(false) // orient((4,0), p-1, (1,1)) = -1: (4,0) is not lexicographically higher than (1,1)
    // (2,0) lies on the real edge (edge 2 = tri[2]->tri[0]); it is never reported on a symbolic edge.
    const r = pointInTriangle(pts, t, 6)
    expect(r).toEqual({ inside: true, edge: 2 })
  })
})
