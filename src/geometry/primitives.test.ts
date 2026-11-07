import { describe, expect, it } from 'vitest'
import {
  circumcenter,
  cross,
  inCircle,
  distance,
  isHorizontal,
  lowerEndpoint,
  onSegment,
  orientation,
  samePt,
  segmentIntersection,
  upperEndpoint,
  xAtY,
} from './primitives'
import type { Pt, Segment } from './types'

describe('primitives', () => {
  it('cross of a left turn is positive', () => {
    expect(cross({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1)
  })
  it('orientation returns 1, -1 and 0', () => {
    const o = { x: 0, y: 0 }
    expect(orientation(o, { x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1)
    expect(orientation(o, { x: 1, y: 0 }, { x: 0, y: -1 })).toBe(-1)
    expect(orientation(o, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(0)
  })
  it('distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})
const near = (p: Pt, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 7)
  expect(p.y).toBeCloseTo(y, 7)
}
const expectPoint = (r: ReturnType<typeof segmentIntersection>, x: number, y: number) => {
  expect(r?.kind).toBe('point')
  if (r?.kind === 'point') near(r.p, x, y)
}
const expectOverlap = (
  r: ReturnType<typeof segmentIntersection>,
  p: [number, number],
  q: [number, number],
) => {
  expect(r?.kind).toBe('overlap')
  if (r?.kind !== 'overlap') return
  const key = (u: Pt) => `${u.x.toFixed(6)},${u.y.toFixed(6)}`
  expect([key(r.a), key(r.b)].sort()).toEqual(
    [key({ x: p[0], y: p[1] }), key({ x: q[0], y: q[1] })].sort(),
  )
}

describe('segments', () => {
  it('crossing', () => expectPoint(segmentIntersection(seg(0, 0, 4, 4), seg(0, 4, 4, 0)), 2, 2))
  it('touching at endpoint', () =>
    expectPoint(segmentIntersection(seg(0, 0, 2, 2), seg(2, 2, 4, 0)), 2, 2))
  it('endpoint on interior', () =>
    expectPoint(segmentIntersection(seg(0, 0, 4, 0), seg(2, 0, 2, 3)), 2, 0))
  it('parallel', () => expect(segmentIntersection(seg(0, 0, 4, 0), seg(0, 1, 4, 1))).toBeNull())
  it('collinear disjoint', () =>
    expect(segmentIntersection(seg(0, 0, 1, 0), seg(2, 0, 3, 0))).toBeNull())
  it('collinear touching', () =>
    expectPoint(segmentIntersection(seg(0, 0, 2, 0), seg(2, 0, 4, 0)), 2, 0))
  it('partial overlap', () =>
    expectOverlap(segmentIntersection(seg(0, 0, 3, 0), seg(1, 0, 5, 0)), [1, 0], [3, 0]))
  it('containment', () =>
    expectOverlap(segmentIntersection(seg(0, 0, 6, 0), seg(2, 0, 4, 0)), [2, 0], [4, 0]))
  it('identical', () =>
    expectOverlap(segmentIntersection(seg(0, 0, 3, 1), seg(0, 0, 3, 1)), [0, 0], [3, 1]))
  it('vertical x horizontal', () =>
    expectPoint(segmentIntersection(seg(2, -1, 2, 5), seg(0, 1, 4, 1)), 2, 1))
  it('is symmetric', () => {
    const pairs: [Segment, Segment][] = [
      [seg(0, 0, 4, 4), seg(0, 4, 4, 0)],
      [seg(0, 0, 3, 0), seg(1, 0, 5, 0)],
      [seg(0, 0, 1, 0), seg(2, 0, 3, 0)],
      [seg(0, 0, 4, 0), seg(2, 0, 2, 3)],
      [seg(1, 1, 1, 1), seg(0, 0, 2, 2)],
    ]
    for (const [s, t] of pairs) {
      const r1 = segmentIntersection(s, t)
      const r2 = segmentIntersection(t, s)
      expect(r1?.kind).toBe(r2?.kind)
      if (r1?.kind === 'point' && r2?.kind === 'point') near(r1.p, r2.p.x, r2.p.y)
      if (r1?.kind === 'overlap' && r2?.kind === 'overlap') {
        near(r1.a, r2.a.x, r2.a.y)
        near(r1.b, r2.b.x, r2.b.y)
      }
    }
  })
  it('overlap a is the upper endpoint', () => {
    const r = segmentIntersection(seg(0, 0, 3, 3), seg(5, 5, 1, 1))
    expect(r?.kind).toBe('overlap')
    if (r?.kind === 'overlap') {
      near(r.a, 3, 3)
      near(r.b, 1, 1)
    }
    const h = segmentIntersection(seg(0, 0, 3, 0), seg(1, 0, 5, 0))
    expect(h?.kind).toBe('overlap')
    if (h?.kind === 'overlap') {
      near(h.a, 1, 0)
      near(h.b, 3, 0)
    }
  })
  it('zero-length segments behave as points', () => {
    expectPoint(segmentIntersection(seg(1, 1, 1, 1), seg(0, 0, 2, 2)), 1, 1)
    expectPoint(segmentIntersection(seg(0, 0, 2, 2), seg(1, 1, 1, 1)), 1, 1)
    expect(segmentIntersection(seg(1, 2, 1, 2), seg(0, 0, 2, 2))).toBeNull()
    expectPoint(segmentIntersection(seg(1, 1, 1, 1), seg(1, 1, 1, 1)), 1, 1)
    expect(segmentIntersection(seg(1, 1, 1, 1), seg(2, 2, 2, 2))).toBeNull()
  })
  it('upperEndpoint / lowerEndpoint', () => {
    expect(upperEndpoint(seg(0, 0, 0, 5))).toEqual({ x: 0, y: 5 })
    expect(lowerEndpoint(seg(0, 0, 0, 5))).toEqual({ x: 0, y: 0 })
    expect(upperEndpoint(seg(3, 1, 1, 1))).toEqual({ x: 1, y: 1 })
    expect(lowerEndpoint(seg(3, 1, 1, 1))).toEqual({ x: 3, y: 1 })
  })
  it('xAtY', () => {
    expect(xAtY(seg(0, 0, 4, 4), 1)).toBeCloseTo(1)
    expect(xAtY(seg(7, 2, 3, 2), 2)).toBe(7)
  })
  it('isHorizontal / samePt / onSegment', () => {
    expect(isHorizontal(seg(0, 1, 5, 1))).toBe(true)
    expect(isHorizontal(seg(0, 1, 5, 2))).toBe(false)
    expect(samePt({ x: 1, y: 1 }, { x: 1 + 1e-12, y: 1 })).toBe(true)
    expect(samePt({ x: 1, y: 1 }, { x: 1.001, y: 1 })).toBe(false)
    expect(onSegment({ x: 2, y: 2 }, seg(0, 0, 4, 4))).toBe(true)
    expect(onSegment({ x: 0, y: 0 }, seg(0, 0, 4, 4))).toBe(true)
    expect(onSegment({ x: 5, y: 5 }, seg(0, 0, 4, 4))).toBe(false)
    expect(onSegment({ x: 2, y: 3 }, seg(0, 0, 4, 4))).toBe(false)
    expect(onSegment({ x: 1, y: 1 }, seg(1, 1, 1, 1))).toBe(true)
    expect(onSegment({ x: 1, y: 2 }, seg(1, 1, 1, 1))).toBe(false)
  })
  it('uses one tolerance: crossing agrees with onSegment', () => {
    // (a) 5e-7 beyond the end of s: not touching
    const s = seg(0, 0, 800, 0)
    const t = seg(800.0000005, -1, 800.0000005, 1)
    expect(segmentIntersection(s, t)).toBeNull()
    expect(segmentIntersection(t, s)).toBeNull()
    // (b) t starts 5e-8 past the end of s: touching at t.a
    const s2 = seg(0, 0, 1, 0)
    const t2 = seg(1 + 5e-8, 0, 2, 5)
    expect(onSegment(t2.a, s2)).toBe(true)
    expectPoint(segmentIntersection(s2, t2), 1 + 5e-8, 0)
    expectPoint(segmentIntersection(t2, s2), 1 + 5e-8, 0)
  })
  it('canvas scale: endpoint on interior near u = 1 agrees with onSegment', () => {
    const s = seg(0, 400, 800, 400)
    for (const dx of [-1e-6, -1e-9, 0, 1e-9, 1e-6]) {
      const t = seg(800 + dx, 300, 800 + dx, 400)
      const r = segmentIntersection(s, t)
      expect(r !== null).toBe(onSegment({ x: 800 + dx, y: 400 }, s))
      expect(segmentIntersection(t, s) !== null).toBe(r !== null)
    }
  })
  it('samePt uses the geometric tolerance', () => {
    expect(samePt({ x: 1, y: 1 }, { x: 1 + 5e-8, y: 1 })).toBe(true)
    expect(samePt({ x: 1, y: 1 }, { x: 1 + 5e-7, y: 1 })).toBe(false)
  })
})

describe('inCircle', () => {
  const a = { x: 1, y: 0 }
  const b = { x: 0, y: 1 }
  const c = { x: -1, y: 0 }
  const scale = (p: { x: number; y: number }, k: number) => ({ x: p.x * k, y: p.y * k })

  it('classifies inside, outside and on the circle', () => {
    expect(inCircle(a, b, c, { x: 0, y: 0 })).toBe(1)
    expect(inCircle(a, b, c, { x: 2, y: 0 })).toBe(-1)
    expect(inCircle(a, b, c, { x: 0, y: -1 })).toBe(0)
  })

  it('is independent of the orientation of (a, b, c)', () => {
    expect(inCircle(b, a, c, { x: 0, y: 0 })).toBe(1)
    expect(inCircle(b, a, c, { x: 2, y: 0 })).toBe(-1)
    expect(inCircle(b, a, c, { x: 0, y: -1 })).toBe(0)
  })

  it('gives the same results at a large scale', () => {
    const k = 1000
    expect(inCircle(scale(a, k), scale(b, k), scale(c, k), { x: 0, y: 0 })).toBe(1)
    expect(inCircle(scale(a, k), scale(b, k), scale(c, k), { x: 2 * k, y: 0 })).toBe(-1)
    expect(inCircle(scale(a, k), scale(b, k), scale(c, k), { x: 0, y: -k })).toBe(0)
  })

  it('is not loosened for tiny coordinates', () => {
    const t = { x: 0, y: 0 }
    expect(inCircle(t, { x: 1e-3, y: 0 }, { x: 0, y: 1e-3 }, { x: 0.9e-3, y: 0.9e-3 })).toBe(1)
    const k = 1e-3
    expect(inCircle(scale(a, k), scale(b, k), scale(c, k), { x: 0, y: 0 })).toBe(1)
    expect(inCircle(scale(a, k), scale(b, k), scale(c, k), { x: 2 * k, y: 0 })).toBe(-1)
    expect(inCircle(scale(a, k), scale(b, k), scale(c, k), { x: 0, y: -k })).toBe(0)
  })

  it('circumcenter of a right triangle is the hypotenuse midpoint', () => {
    const o = circumcenter({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 })
    expect(o).not.toBeNull()
    expect(o!.x).toBeCloseTo(2)
    expect(o!.y).toBeCloseTo(2)
  })

  it('circumcenter of collinear points is null', () => {
    expect(circumcenter({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull()
  })
})
