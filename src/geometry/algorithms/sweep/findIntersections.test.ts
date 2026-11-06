import { describe, expect, it } from 'vitest'
import type { IntersectionResult, Segment } from '../../types'
import { findIntersections, runSweep } from './findIntersections'
import { bruteForceIntersections } from './bruteForceIntersections'
import { sameResult } from './sameResult'

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const int = (rnd: () => number, n: number) => Math.floor(rnd() * n)

function randomSegments(rnd: () => number): Segment[] {
  const n = 2 + int(rnd, 11)
  const out: Segment[] = []
  for (let i = 0; i < n; i++) {
    out.push(seg(int(rnd, 701), int(rnd, 701), int(rnd, 701), int(rnd, 701)))
  }
  return out
}

/** Copies some endpoints onto another segment's endpoint or (rounded) midpoint. */
function snappedSegments(rnd: () => number): Segment[] {
  const segs = randomSegments(rnd)
  const k = 1 + int(rnd, segs.length)
  for (let m = 0; m < k; m++) {
    const i = int(rnd, segs.length)
    const j = int(rnd, segs.length)
    const t = segs[j]
    const r = rnd()
    const target =
      r < 0.4
        ? { ...t.a }
        : r < 0.7
          ? { ...t.b }
          : { x: Math.round((t.a.x + t.b.x) / 2), y: Math.round((t.a.y + t.b.y) / 2) }
    if (rnd() < 0.5) segs[i] = { a: target, b: segs[i].b }
    else segs[i] = { a: segs[i].a, b: target }
    if (rnd() < 0.1) segs[int(rnd, segs.length)] = { a: { ...t.a }, b: { ...t.b } } // identical
  }
  return segs
}

function check(segments: Segment[]): IntersectionResult {
  const r = findIntersections(segments)
  expect(sameResult(r, bruteForceIntersections(segments))).toBe(true)
  return r
}

describe('findIntersections', () => {
  it('two crossing segments', () => {
    const r = check([seg(0, 0, 4, 4), seg(0, 4, 4, 0)])
    expect(r.overlaps).toEqual([])
    expect(r.points).toHaveLength(1)
    expect(r.points[0].p.x).toBeCloseTo(2, 9)
    expect(r.points[0].p.y).toBeCloseTo(2, 9)
    expect(r.points[0].segments).toEqual([0, 1])
  })

  it('three through one point', () => {
    const r = check([seg(0, 0, 4, 4), seg(0, 4, 4, 0), seg(2, 5, 2, -1)])
    expect(r.points).toHaveLength(1)
    expect(r.points[0].segments).toEqual([0, 1, 2])
  })

  it('vertical and horizontal', () => {
    const r = check([seg(0, 1, 4, 1), seg(2, 0, 2, 3)])
    expect(r.points).toHaveLength(1)
    expect(r.points[0].p.x).toBeCloseTo(2, 9)
    expect(r.points[0].p.y).toBeCloseTo(1, 9)
    expect(r.points[0].segments).toEqual([0, 1])
  })

  it('shared endpoint of three', () => {
    const r = check([seg(0, 0, 2, 2), seg(2, 2, 4, 0), seg(2, 2, 2, 5)])
    expect(r.points).toHaveLength(1)
    expect(r.points[0].p).toEqual({ x: 2, y: 2 })
    expect(r.points[0].segments).toEqual([0, 1, 2])
  })

  it('endpoint on interior', () => {
    const r = check([seg(0, 0, 4, 4), seg(2, 2, 4, 0)])
    expect(r.points).toHaveLength(1)
    expect(r.points[0].p).toEqual({ x: 2, y: 2 })
    expect(r.points[0].segments).toEqual([0, 1])
  })

  it('partial overlap', () => {
    const segs = [seg(0, 0, 3, 0), seg(1, 0, 5, 0)]
    const r = check(segs)
    expect(r.overlaps).toHaveLength(1)
    expect(r.overlaps[0].segments).toEqual([0, 1])
    expect(r.overlaps[0].a).toEqual({ x: 1, y: 0 })
    expect(r.overlaps[0].b).toEqual({ x: 3, y: 0 })
    expect(r.points.map((q) => q.p)).toEqual([
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ])
    expect(r.points.every((q) => q.segments.join() === '0,1')).toBe(true)
  })

  it('identical segments', () => {
    const r = check([seg(0, 0, 3, 3), seg(3, 3, 0, 0)])
    expect(r.overlaps).toHaveLength(1)
    expect(r.overlaps[0].segments).toEqual([0, 1])
    expect(r.points).toHaveLength(2)
  })

  it('three identical segments', () => {
    const r = check([seg(0, 0, 3, 3), seg(0, 0, 3, 3), seg(0, 0, 3, 3)])
    expect(r.overlaps.map((o) => o.segments)).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ])
    expect(r.points).toHaveLength(2)
    expect(r.points[0].segments).toEqual([0, 1, 2])
  })

  it('containment', () => {
    const r = check([seg(0, 0, 0, 10), seg(0, 3, 0, 6)])
    expect(r.overlaps).toHaveLength(1)
    expect(r.overlaps[0].a).toEqual({ x: 0, y: 6 })
    expect(r.overlaps[0].b).toEqual({ x: 0, y: 3 })
    expect(r.points).toHaveLength(2)
  })

  it('collinear touching', () => {
    const r = check([seg(0, 0, 2, 2), seg(2, 2, 5, 5)])
    expect(r.points).toHaveLength(1)
    expect(r.overlaps).toHaveLength(0)
  })

  it('empty and single', () => {
    expect(findIntersections([])).toEqual({ points: [], overlaps: [] })
    expect(findIntersections([seg(0, 0, 1, 1)])).toEqual({ points: [], overlaps: [] })
  })

  it('zero-length segment', () => {
    const r = check([seg(1, 1, 1, 1), seg(0, 0, 2, 2)])
    expect(r.overlaps).toEqual([])
    expect(r.points).toHaveLength(1)
    expect(r.points[0].p).toEqual({ x: 1, y: 1 })
    expect(r.points[0].segments).toEqual([0, 1])
    expect(findIntersections([seg(1, 1, 1, 1)])).toEqual({ points: [], overlaps: [] })
  })

  it('random inputs equal brute force', () => {
    const rnd = mulberry32(2024)
    for (let k = 0; k < 200; k++) {
      const segs = randomSegments(rnd)
      const ok = sameResult(findIntersections(segs), bruteForceIntersections(segs))
      if (!ok) throw new Error(`mismatch for ${JSON.stringify(segs)}`)
    }
  })

  it('random inputs with snapped endpoints', () => {
    const rnd = mulberry32(77)
    for (let k = 0; k < 100; k++) {
      const segs = snappedSegments(rnd)
      const ok = sameResult(findIntersections(segs), bruteForceIntersections(segs))
      if (!ok) throw new Error(`mismatch for ${JSON.stringify(segs)}`)
    }
  })

  it('deterministic output order', () => {
    const rnd = mulberry32(5)
    const segs = snappedSegments(rnd)
    expect(findIntersections(segs)).toEqual(findIntersections(segs))
    expect(runSweep(segs)).toEqual(findIntersections(segs))
  })

  it('points come in sweep order with ascending segment lists', () => {
    const r = findIntersections([
      seg(0, 0, 10, 10),
      seg(0, 10, 10, 0),
      seg(0, 2, 10, 2),
      seg(3, 0, 3, 10),
    ])
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1].p
      const b = r.points[i].p
      expect(a.y > b.y || (a.y === b.y && a.x < b.x)).toBe(true)
    }
    for (const q of r.points) expect([...q.segments].sort((x, y) => x - y)).toEqual(q.segments)
  })

  it('records init first and done last', () => {
    const lines: number[] = []
    runSweep([seg(0, 0, 4, 4), seg(0, 4, 4, 0)], (line) => lines.push(line))
    expect(lines.slice(0, 2)).toEqual([1, 2])
    expect(lines[lines.length - 1]).toBe(3)
    expect(lines).toContain(10)
    const empty: number[] = []
    runSweep([], (line) => empty.push(line))
    expect(empty).toEqual([1, 2, 3])
  })
})

describe('sameResult', () => {
  it('distinguishes results', () => {
    const a: IntersectionResult = { points: [{ p: { x: 1, y: 1 }, segments: [0, 1] }], overlaps: [] }
    const b: IntersectionResult = { points: [{ p: { x: 1, y: 1 + 1e-9 }, segments: [1, 0] }], overlaps: [] }
    const c: IntersectionResult = { points: [{ p: { x: 1, y: 1 }, segments: [0, 2] }], overlaps: [] }
    expect(sameResult(a, b)).toBe(true)
    expect(sameResult(a, c)).toBe(false)
    expect(sameResult(a, { points: [], overlaps: [] })).toBe(false)
    const o1: IntersectionResult = {
      points: [],
      overlaps: [{ a: { x: 0, y: 1 }, b: { x: 0, y: 0 }, segments: [0, 1] }],
    }
    const o2: IntersectionResult = {
      points: [],
      overlaps: [{ a: { x: 0, y: 0 }, b: { x: 0, y: 1 }, segments: [0, 1] }],
    }
    expect(sameResult(o1, o2)).toBe(true)
  })
})
