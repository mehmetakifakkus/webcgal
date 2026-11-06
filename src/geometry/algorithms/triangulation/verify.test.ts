import { describe, expect, it } from 'vitest'
import type { Polygon } from '../../types'
import { isSimple, signedArea } from './polygon'
import { diagonalInside, diagonalsCross, isValidTriangulation, pointInPolygon, randomStarPolygon } from './verify'

const P = (pts: Array<[number, number]>): Polygon => pts.map(([x, y]) => ({ x, y }))
const square = P([[0, 0], [4, 0], [4, 4], [0, 4]])

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('verify', () => {
  it('pointInPolygon', () => {
    expect(pointInPolygon({ x: 2, y: 2 }, square)).toBe(true)
    expect(pointInPolygon({ x: 5, y: 2 }, square)).toBe(false)
    expect(pointInPolygon({ x: 4, y: 2 }, square)).toBe(true)
    expect(pointInPolygon({ x: 0, y: 0 }, square)).toBe(true)
  })

  it('diagonalInside', () => {
    expect(diagonalInside(square, [0, 2])).toBe(true)
    expect(diagonalInside(square, [0, 1])).toBe(false)
    const l = P([[0, 0], [4, 0], [4, 4], [2, 4], [2, 2], [0, 2]])
    expect(diagonalInside(l, [1, 5])).toBe(true)
    expect(diagonalInside(l, [2, 5])).toBe(false) // midpoint lies on the notch edge
    expect(diagonalInside(l, [0, 4])).toBe(true)
  })

  it('diagonalsCross', () => {
    expect(diagonalsCross(square, [0, 2], [1, 3])).toBe(true)
    expect(diagonalsCross(square, [0, 2], [0, 2])).toBe(true)
    const hex = P([[0, 0], [2, -1], [4, 0], [4, 3], [2, 4], [0, 3]])
    expect(diagonalsCross(hex, [0, 2], [0, 3])).toBe(false)
  })

  it('isValidTriangulation', () => {
    expect(isValidTriangulation(square, [[0, 2]]).ok).toBe(true)
    expect(isValidTriangulation(square, [[0, 1]]).ok).toBe(false)
    expect(isValidTriangulation(square, [[0, 2], [1, 3]]).ok).toBe(false)
    expect(isValidTriangulation(square, []).ok).toBe(false)
    const pent = P([[0, 0], [4, 0], [5, 3], [2, 5], [-1, 3]])
    expect(isValidTriangulation(pent, [[0, 2], [0, 3]]).ok).toBe(true)
    expect(isValidTriangulation(pent, [[0, 2], [1, 3]]).ok).toBe(false)
    expect(isValidTriangulation(pent, [[0, 2], [0, 2]]).ok).toBe(false)
  })

  it('randomStarPolygon is simple and CCW', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const n of [5, 12, 20]) {
        const poly = randomStarPolygon(mulberry32(seed), n, 400, 300, 80, 250)
        expect(poly).toHaveLength(n)
        expect(isSimple(poly), `seed ${seed} n ${n}`).toBe(true)
        expect(signedArea(poly)).toBeGreaterThan(0)
      }
    }
  })
})
