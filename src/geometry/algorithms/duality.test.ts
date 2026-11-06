import { describe, expect, it } from 'vitest'
import { dualLine, dualPoint, findStabber } from './duality'
import type { Pt } from '../types'

const p = (x: number, y: number): Pt => ({ x, y })
const stabs = (l: { slope: number; intercept: number }, [a, b]: [Pt, Pt]) => {
  const ra = a.y - (l.slope * a.x + l.intercept)
  const rb = b.y - (l.slope * b.x + l.intercept)
  return ra * rb <= 1e-9
}

describe('duality', () => {
  it('dualLine / dualPoint', () => {
    expect(dualLine(p(2, 3))).toEqual({ slope: 2, intercept: -3 })
    expect(dualPoint(dualLine(p(2, 3)))).toEqual(p(2, 3))
  })
})

describe('findStabber', () => {
  it('finds a stabbing line for three vertical segments', () => {
    const segs: [Pt, Pt][] = [[p(0, 0), p(0, 2)], [p(2, 1), p(2, 3)], [p(4, 2), p(4, 4)]]
    const l = findStabber(segs)
    expect(l).not.toBeNull()
    for (const s of segs) expect(stabs(l!, s)).toBe(true)
  })
  it('returns null when no line stabs', () => {
    expect(findStabber([[p(0, 0), p(0, 1)], [p(1, 5), p(1, 6)], [p(2, 0), p(2, 1)]])).toBeNull()
  })
  it('0 and 1 segments', () => {
    expect(findStabber([])).toEqual({ slope: 0, intercept: 0 })
    expect(findStabber([[p(0, 0), p(2, 2)]])).toEqual({ slope: 1, intercept: 0 })
    expect(findStabber([[p(1, 3), p(1, 5)]])).toEqual({ slope: 0, intercept: 3 })
  })
})
