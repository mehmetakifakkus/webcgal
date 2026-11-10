import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { bruteForceDisk, isMinimalDisk } from './verify'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))
const disk = (x: number, y: number, radius: number) => ({ center: { x, y }, radius })

describe('isMinimalDisk', () => {
  it('accepts a diameter pair and a triangle around the centre', () => {
    expect(isMinimalDisk(P([[0, 0], [10, 0], [5, 1]]), disk(5, 0, 5))).toEqual({ ok: true })
    expect(isMinimalDisk(P([[0, 0], [10, 0], [5, 8], [5, 1]]), disk(5, 2.4375, 5.5625))).toEqual({ ok: true })
  })

  it('accepts the degenerate cases', () => {
    expect(isMinimalDisk([], null)).toEqual({ ok: true })
    expect(isMinimalDisk(P([[3, 4]]), disk(3, 4, 0))).toEqual({ ok: true })
    expect(isMinimalDisk(P([[3, 4], [3, 4]]), disk(3, 4, 0))).toEqual({ ok: true })
  })

  it('accepts a right triangle (centre on the closed triangle)', () => {
    expect(isMinimalDisk(P([[0, 0], [2, 0], [0, 2]]), disk(1, 1, Math.SQRT2))).toEqual({ ok: true })
  })

  it('rejects a point outside', () => {
    const res = isMinimalDisk(P([[0, 0], [10, 0], [5, 6]]), disk(5, 0, 5))
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/outside/)
    expect(res.reason).toMatch(/v3/)
  })

  it('rejects an unnecessarily large disc', () => {
    const pts = P([[0, 0], [10, 0], [5, 1]])
    const res = isMinimalDisk(pts, disk(5, 0, 8))
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/not minimal/)
  })

  it('rejects a circumcircle whose centre lies outside the triangle', () => {
    // obtuse triangle: all three points on the circumcircle, but the diameter disc of the
    // longest side is smaller
    const pts = P([[0, 0], [10, 0], [5, 1]])
    const res = isMinimalDisk(pts, disk(5, -12, 13))
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/not minimal/)
  })

  it('rejects a missing disc for a non-empty set', () => {
    expect(isMinimalDisk(P([[1, 1]]), null).ok).toBe(false)
  })
})

describe('bruteForceDisk', () => {
  it('finds the smallest disc of small sets', () => {
    expect(bruteForceDisk(P([[3, 4]]))).toEqual(disk(3, 4, 0))
    const two = bruteForceDisk(P([[0, 0], [4, 2]]))
    expect(two.center.x).toBeCloseTo(2, 9)
    expect(two.center.y).toBeCloseTo(1, 9)
    expect(two.radius).toBeCloseTo(Math.sqrt(5), 9)
    const tri = bruteForceDisk(P([[0, 0], [10, 0], [5, 8], [5, 1]]))
    expect(tri.center.x).toBeCloseTo(5, 9)
    expect(tri.center.y).toBeCloseTo(2.4375, 9)
    expect(tri.radius).toBeCloseTo(5.5625, 9)
    const obtuse = bruteForceDisk(P([[0, 0], [10, 0], [5, 1]]))
    expect(obtuse.center.x).toBeCloseTo(5, 9)
    expect(obtuse.center.y).toBeCloseTo(0, 9)
    expect(obtuse.radius).toBeCloseTo(5, 9)
  })
})
