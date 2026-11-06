import { describe, expect, it } from 'vitest'
import { circleFrom2, circumcircle, smallestEnclosingDisk } from './smallestEnclosingDisk'
import { distance } from '../primitives'
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

describe('smallestEnclosingDisk', () => {
  it('empty and single point', () => {
    expect(smallestEnclosingDisk([])).toEqual({ center: p(0, 0), radius: 0 })
    expect(smallestEnclosingDisk([p(3, 4)])).toEqual({ center: p(3, 4), radius: 0 })
  })
  it('two points', () => {
    const c = smallestEnclosingDisk([p(0, 0), p(4, 2)])
    expect(c.center.x).toBeCloseTo(2, 6)
    expect(c.center.y).toBeCloseTo(1, 6)
    expect(c.radius).toBeCloseTo(Math.sqrt(20) / 2, 6)
  })
  it('equilateral triangle', () => {
    const c = smallestEnclosingDisk([p(0, 0), p(2, 0), p(1, Math.sqrt(3))])
    expect(c.center.x).toBeCloseTo(1, 6)
    expect(c.center.y).toBeCloseTo(Math.sqrt(3) / 3, 6)
    expect(c.radius).toBeCloseTo(2 / Math.sqrt(3), 6)
  })
  it('obtuse triangle uses the longest side', () => {
    const c = smallestEnclosingDisk([p(0, 0), p(10, 0), p(5, 1)])
    expect(c.center.x).toBeCloseTo(5, 6)
    expect(c.center.y).toBeCloseTo(0, 6)
    expect(c.radius).toBeCloseTo(5, 6)
  })
  it('collinear', () => {
    const c = smallestEnclosingDisk([p(0, 0), p(1, 0), p(5, 0)])
    expect(c.center.x).toBeCloseTo(2.5, 6)
    expect(c.center.y).toBeCloseTo(0, 6)
    expect(c.radius).toBeCloseTo(2.5, 6)
  })
  it('duplicates', () => {
    const c = smallestEnclosingDisk([p(1, 1), p(1, 1), p(1, 1)])
    expect(c).toEqual({ center: p(1, 1), radius: 0 })
  })
  it('random 100 points are all enclosed', () => {
    const rnd = mulberry32(42)
    const pts = Array.from({ length: 100 }, () => p(rnd() * 200 - 100, rnd() * 200 - 100))
    const c = smallestEnclosingDisk(pts, mulberry32(7))
    for (const q of pts) expect(distance(c.center, q)).toBeLessThanOrEqual(c.radius + 1e-9)
    // minimality: at least two points lie on the boundary
    const onBoundary = pts.filter((q) => Math.abs(distance(c.center, q) - c.radius) < 1e-6)
    expect(onBoundary.length).toBeGreaterThanOrEqual(2)
  })
  it('does not mutate input', () => {
    const pts = [p(0, 0), p(2, 0), p(1, 5)]
    const copy = pts.map((q) => ({ ...q }))
    smallestEnclosingDisk(pts, mulberry32(1))
    expect(pts).toEqual(copy)
  })
})

describe('circle helpers', () => {
  it('circleFrom2', () => {
    expect(circleFrom2(p(0, 0), p(2, 0))).toEqual({ center: p(1, 0), radius: 1 })
  })
  it('circumcircle of right triangle', () => {
    const c = circumcircle(p(0, 0), p(2, 0), p(0, 2))!
    expect(c.center.x).toBeCloseTo(1, 9)
    expect(c.center.y).toBeCloseTo(1, 9)
    expect(c.radius).toBeCloseTo(Math.SQRT2, 9)
  })
  it('circumcircle returns null for collinear', () => {
    expect(circumcircle(p(0, 0), p(1, 1), p(2, 2))).toBeNull()
  })
})
