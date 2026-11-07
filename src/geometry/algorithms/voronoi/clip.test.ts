import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { CANVAS_BOX, clipLine, clipPolygonToBox, clipRay, clipSegment } from './clip'

const P = (x: number, y: number): Pt => ({ x, y })

function area(poly: Pt[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    s += p.x * q.y - q.x * p.y
  }
  return s / 2
}

function expectPts(actual: [Pt, Pt] | null, expected: [Pt, Pt]) {
  expect(actual).not.toBeNull()
  const [a, b] = actual as [Pt, Pt]
  expect(a.x).toBeCloseTo(expected[0].x, 9)
  expect(a.y).toBeCloseTo(expected[0].y, 9)
  expect(b.x).toBeCloseTo(expected[1].x, 9)
  expect(b.y).toBeCloseTo(expected[1].y, 9)
}

describe('CANVAS_BOX', () => {
  it('matches the canvas size', () => {
    expect(CANVAS_BOX).toEqual({ x0: 0, y0: 0, x1: 775, y1: 360 })
  })
})

describe('clipSegment', () => {
  it('keeps a segment fully inside', () => {
    expectPts(clipSegment(P(10, 10), P(700, 300), CANVAS_BOX), [P(10, 10), P(700, 300)])
  })
  it('cuts the outside end at the box border', () => {
    expectPts(clipSegment(P(100, 100), P(900, 100), CANVAS_BOX), [P(100, 100), P(775, 100)])
    expectPts(clipSegment(P(100, 100), P(100, -50), CANVAS_BOX), [P(100, 100), P(100, 0)])
  })
  it('cuts both ends and keeps parameter order', () => {
    expectPts(clipSegment(P(-100, 100), P(900, 100), CANVAS_BOX), [P(0, 100), P(775, 100)])
    expectPts(clipSegment(P(900, 100), P(-100, 100), CANVAS_BOX), [P(775, 100), P(0, 100)])
  })
  it('returns null when fully outside', () => {
    expect(clipSegment(P(-10, -10), P(-5, 500), CANVAS_BOX)).toBeNull()
    expect(clipSegment(P(800, 0), P(900, 360), CANVAS_BOX)).toBeNull()
  })
  it('keeps a segment parallel to and on the box border', () => {
    expectPts(clipSegment(P(100, 0), P(300, 0), CANVAS_BOX), [P(100, 0), P(300, 0)])
    expectPts(clipSegment(P(775, -20), P(775, 100), CANVAS_BOX), [P(775, 0), P(775, 100)])
  })
  it('returns null for a parallel segment just outside', () => {
    expect(clipSegment(P(100, -1), P(300, -1), CANVAS_BOX)).toBeNull()
  })
  it('returns null for a zero-length segment', () => {
    expect(clipSegment(P(-5, -5), P(-5, -5), CANVAS_BOX)).toBeNull()
    expect(clipSegment(P(5, 5), P(5, 5), CANVAS_BOX)).toBeNull()
  })
})

describe('clipRay', () => {
  it('clips a ray starting inside', () => {
    expectPts(clipRay(P(100, 100), P(1, 0), CANVAS_BOX), [P(100, 100), P(775, 100)])
    const s = Math.SQRT1_2
    expectPts(clipRay(P(100, 100), P(-s, -s), CANVAS_BOX), [P(100, 100), P(0, 0)])
  })
  it('returns null when the ray starts outside and misses the box', () => {
    expect(clipRay(P(-50, 100), P(-1, 0), CANVAS_BOX)).toBeNull()
    expect(clipRay(P(-50, 500), P(1, 0), CANVAS_BOX)).toBeNull()
  })
  it('returns the crossing part when the ray starts outside and hits the box', () => {
    expectPts(clipRay(P(-50, 100), P(1, 0), CANVAS_BOX), [P(0, 100), P(775, 100)])
  })
  it('returns null for a zero direction', () => {
    expect(clipRay(P(100, 100), P(0, 0), CANVAS_BOX)).toBeNull()
  })
})

describe('clipLine', () => {
  it('clips a vertical line, ordered by increasing parameter', () => {
    expectPts(clipLine(P(387, 180), P(0, 1), CANVAS_BOX), [P(387, 0), P(387, 360)])
    expectPts(clipLine(P(387, 180), P(0, -1), CANVAS_BOX), [P(387, 360), P(387, 0)])
  })
  it('clips a diagonal line on both sides', () => {
    expectPts(clipLine(P(100, 100), P(1, 1), CANVAS_BOX), [P(0, 0), P(360, 360)])
  })
  it('returns null when the line misses the box', () => {
    expect(clipLine(P(-5, 0), P(0, 1), CANVAS_BOX)).toBeNull()
  })
  it('returns null for a zero direction', () => {
    expect(clipLine(P(100, 100), P(0, 0), CANVAS_BOX)).toBeNull()
  })
})

describe('clipPolygonToBox', () => {
  it('keeps a triangle inside the box unchanged', () => {
    const tri = [P(100, 100), P(300, 100), P(200, 250)]
    expect(clipPolygonToBox(tri, CANVAS_BOX)).toEqual(tri)
  })
  it('turns a huge triangle covering the box into the whole box', () => {
    const tri = [P(-100, -100), P(2000, -100), P(-100, 2000)]
    const out = clipPolygonToBox(tri, CANVAS_BOX)
    expect(out).toHaveLength(4)
    expect(area(out)).toBeCloseTo(775 * 360, 6)
    for (const c of [P(0, 0), P(775, 0), P(775, 360), P(0, 360)]) {
      expect(out.some((p) => Math.abs(p.x - c.x) < 1e-9 && Math.abs(p.y - c.y) < 1e-9)).toBe(true)
    }
  })
  it('cuts a corner off the box and stays CCW', () => {
    // Hypotenuse x + y = 800 removes a right triangle with legs 335 at the (775, 360) corner.
    const tri = [P(-100, -100), P(900, -100), P(-100, 900)]
    const out = clipPolygonToBox(tri, CANVAS_BOX)
    expect(out).toHaveLength(5)
    expect(area(out)).toBeCloseTo(775 * 360 - (335 * 335) / 2, 6)
  })
  it('returns [] when fully outside', () => {
    expect(clipPolygonToBox([P(-50, -50), P(-10, -50), P(-30, -10)], CANVAS_BOX)).toEqual([])
    expect(clipPolygonToBox([], CANVAS_BOX)).toEqual([])
  })
})
