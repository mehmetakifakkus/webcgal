import { describe, expect, it } from 'vitest'
import { isMonotone, monotoneDirections } from './monotone'
import type { Pt } from '../types'

const p = (x: number, y: number): Pt => ({ x, y })
const square = [p(0, 0), p(2, 0), p(2, 2), p(0, 2)]
const U = [p(0, 0), p(3, 0), p(3, 3), p(2, 3), p(2, 1), p(1, 1), p(1, 3), p(0, 3)]
const covers = (r: Array<[number, number]>, a: number) => r.some(([s, e]) => a >= s && a <= e)

describe('isMonotone', () => {
  it('U shape: monotone horizontally, not vertically', () => {
    expect(isMonotone(U, 0)).toBe(true)
    expect(isMonotone(U, 90)).toBe(false)
  })
  it('does not depend on vertex order', () => {
    expect(isMonotone([...U].reverse(), 0)).toBe(true)
    expect(isMonotone([...U].reverse(), 90)).toBe(false)
  })
  it('square is monotone in every direction', () => {
    for (const a of [0, 30, 45, 90, 135]) expect(isMonotone(square, a)).toBe(true)
  })
})

describe('monotoneDirections', () => {
  it('convex polygon', () => {
    expect(monotoneDirections(square)).toEqual([[0, 180]])
  })
  it('U shape contains 0 and not 90', () => {
    const r = monotoneDirections(U)
    expect(covers(r, 0)).toBe(true)
    expect(covers(r, 90)).toBe(false)
    expect(covers(r, 45)).toBe(false)
    for (const [s, e] of r) {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(e).toBeLessThanOrEqual(180)
      expect(s).toBeLessThanOrEqual(e)
    }
  })
  it('results agree with isMonotone on a sweep', () => {
    const r = monotoneDirections(U)
    for (let a = 0.5; a < 180; a += 1) {
      const inside = r.some(([s, e]) => a > s && a < e)
      expect(inside).toBe(isMonotone(U, a))
    }
  })
})
