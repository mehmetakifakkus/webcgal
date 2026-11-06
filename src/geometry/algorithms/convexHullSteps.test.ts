import { describe, expect, it } from 'vitest'
import { convexHull } from './convexHull'
import { CONVEX_HULL_PSEUDOCODE, convexHullSteps } from './convexHullSteps'
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

function randomPoints(n: number, seed: number): Pt[] {
  const rnd = mulberry32(seed)
  return Array.from({ length: n }, () => p(Math.round(rnd() * 1000), Math.round(rnd() * 1000)))
}

function finalHull(points: Pt[]): Pt[] {
  const steps = convexHullSteps(points)
  const last = steps[steps.length - 1].state
  expect(last.phase).toBe('done')
  return [...last.upper, ...last.lower.slice(1, -1)]
}

describe('convexHullSteps', () => {
  it('pseudocode has 13 lines', () => {
    expect(CONVEX_HULL_PSEUDOCODE).toHaveLength(13)
  })

  it('last step matches convexHull', () => {
    for (const seed of [1, 2, 3]) {
      const pts = randomPoints(50, seed)
      expect(finalHull(pts)).toEqual(convexHull(pts))
    }
  })

  it('last step matches convexHull for near-collinear input', () => {
    const pts = [p(0, 0), p(1, 1e-12), p(2, 0), p(3, -1e-12), p(4, 0), p(2, 1)]
    expect(finalHull(pts)).toEqual(convexHull(pts))
  })

  it('line indices are valid', () => {
    for (const s of convexHullSteps(randomPoints(50, 7))) {
      expect(s.line).toBeGreaterThanOrEqual(0)
      expect(s.line).toBeLessThan(CONVEX_HULL_PSEUDOCODE.length)
    }
  })

  it('every removal is preceded by a test', () => {
    const steps = convexHullSteps(randomPoints(50, 11))
    let removals = 0
    steps.forEach((s, i) => {
      if (s.line !== 5) return
      removals++
      const prev = steps[i - 1]
      expect(prev.line).toBe(4)
      expect(prev.state.testing![1]).toEqual(s.state.removed)
    })
    expect(removals).toBeGreaterThan(0)
  })

  it('describes points by their sorted index', () => {
    const steps = convexHullSteps([p(0, 0), p(1, 1), p(2, 0)])
    expect(steps.some((s) => s.description === 'p1, p2, p3 make a right turn: keep p2')).toBe(true)
  })

  it('degenerate inputs', () => {
    const cases: Pt[][] = [
      [],
      [p(1, 1)],
      [p(0, 0), p(3, 1)],
      [p(1, 1), p(1, 1)],
      [p(0, 0), p(1, 1), p(2, 2), p(3, 3)],
      [p(0, 0), p(0, 1), p(0, 2)],
      [p(2, 2), p(0, 0), p(1, 1), p(1, 1)],
    ]
    for (const pts of cases) {
      expect(() => convexHullSteps(pts)).not.toThrow()
      expect(finalHull(pts)).toEqual(convexHull(pts))
    }
  })

  it('snapshots are independent', () => {
    const steps = convexHullSteps(randomPoints(30, 5))
    const frozen = structuredClone(steps)
    expect(steps).toEqual(frozen)
    steps[0].state.sorted[0].x = -999
    expect(steps[1].state.sorted[0].x).not.toBe(-999)
    expect(steps[steps.length - 1].state.upper).not.toBe(steps[steps.length - 2].state.upper)
  })
})
