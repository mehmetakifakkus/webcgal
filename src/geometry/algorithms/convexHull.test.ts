import { describe, expect, it } from 'vitest'
import { convexHull } from './convexHull'
import { orientation } from '../primitives'
import type { Pt } from '../types'

const p = (x: number, y: number): Pt => ({ x, y })

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('convexHull', () => {
  it('square with interior point', () => {
    expect(convexHull([p(0, 0), p(2, 0), p(2, 2), p(0, 2), p(1, 1)])).toEqual([
      p(0, 0), p(0, 2), p(2, 2), p(2, 0),
    ])
  })
  it('collinear points on edge are dropped', () => {
    expect(convexHull([p(0, 0), p(1, 0), p(2, 0), p(1, 1)])).toHaveLength(3)
  })
  it('all collinear', () => {
    expect(convexHull([p(0, 0), p(1, 1), p(2, 2)])).toEqual([p(0, 0), p(2, 2)])
  })
  it('duplicates', () => {
    expect(convexHull([p(1, 1), p(1, 1), p(0, 0)])).toHaveLength(2)
  })
  it('0/1/2 points', () => {
    expect(convexHull([])).toEqual([])
    expect(convexHull([p(3, 4)])).toEqual([p(3, 4)])
    expect(convexHull([p(1, 0), p(0, 0)])).toEqual([p(0, 0), p(1, 0)])
  })
  it('random 200 points', () => {
    const rnd = mulberry32(42)
    const pts = Array.from({ length: 200 }, () => p(rnd() * 100, rnd() * 100))
    const h = convexHull(pts)
    expect(h.length).toBeGreaterThanOrEqual(3)
    const n = h.length
    for (let i = 0; i < n; i++) {
      expect(orientation(h[i], h[(i + 1) % n], h[(i + 2) % n])).toBe(-1)
    }
    for (let i = 0; i < n; i++) {
      for (const q of pts) {
        expect(orientation(h[i], h[(i + 1) % n], q)).toBeLessThanOrEqual(0)
      }
    }
  })
})
