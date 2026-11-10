import { describe, expect, it } from 'vitest'
import type { Circle, Pt } from '../../types'
import { distance } from '../../primitives'
import { mulberry32 } from '../delaunay/delaunay'
import { randomPointSet } from '../delaunay/verify'
import { smallestEnclosingDisk } from '../smallestEnclosingDisk'
import { defaultOrder, label, minidisc, normalizeOrder } from './minidisc'
import type { MdPatch, MdRecorderContext } from './miniDiscState'
import { bruteForceDisk, isMinimalDisk } from './verify'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))
const BOX = { x0: 93, y0: 43, x1: 682, y1: 317 }

function expectDisk(d: Circle | null, cx: number, cy: number, r: number, digits = 6) {
  expect(d).not.toBeNull()
  expect(d!.center.x).toBeCloseTo(cx, digits)
  expect(d!.center.y).toBeCloseTo(cy, digits)
  expect(d!.radius).toBeCloseTo(r, digits)
}

function expectSameDisk(a: Circle | null, b: Circle | null) {
  expect(a).not.toBeNull()
  expect(b).not.toBeNull()
  expect(Math.abs(a!.center.x - b!.center.x)).toBeLessThanOrEqual(1e-6)
  expect(Math.abs(a!.center.y - b!.center.y)).toBeLessThanOrEqual(1e-6)
  expect(Math.abs(a!.radius - b!.radius)).toBeLessThanOrEqual(1e-6)
}

describe('minidisc', () => {
  it('two points', () => {
    const res = minidisc(P([[0, 0], [4, 2]]))
    expectDisk(res.disk, 2, 1, Math.sqrt(5))
    expect([...res.boundary].sort()).toEqual([0, 1])
    expect(res.tests).toBe(0)
    expect(res.updates).toBe(0)
  })

  it('acute triangle → 3 boundary points', () => {
    const pts = P([[0, 0], [10, 0], [5, 8]])
    const res = minidisc(pts, [0, 1, 2])
    expectDisk(res.disk, 5, 39 / 16, 89 / 16)
    expect([...res.boundary].sort()).toEqual([0, 1, 2])
    expect(isMinimalDisk(pts, res.disk)).toEqual({ ok: true })
  })

  it('obtuse triangle → 2 boundary points, longest side', () => {
    const pts = P([[0, 0], [10, 0], [5, 1]])
    for (const order of [[0, 1, 2], [2, 0, 1], [1, 2, 0]]) {
      const res = minidisc(pts, order)
      expectDisk(res.disk, 5, 0, 5)
      expect([...res.boundary].sort()).toEqual([0, 1])
    }
  })

  it('collinear 5 → extremes', () => {
    const pts = P([[150, 180], [250, 180], [400, 180], [520, 180], [640, 180]])
    const res = minidisc(pts, [2, 1, 3, 0, 4])
    expectDisk(res.disk, 395, 180, 245)
    expect([...res.boundary].sort()).toEqual([0, 4])
    expect(isMinimalDisk(pts, res.disk)).toEqual({ ok: true })
  })

  it('duplicates', () => {
    const pts = P([[100, 100], [100, 100], [300, 100]])
    for (const order of [[0, 1, 2], [2, 0, 1], [0, 2, 1], [1, 0, 2]]) {
      const res = minidisc(pts, order)
      expectDisk(res.disk, 200, 100, 100)
      expect(res.boundary).toHaveLength(2)
      expect(res.boundary).toContain(2)
      expect(isMinimalDisk(pts, res.disk)).toEqual({ ok: true })
    }
  })

  it('n = 0 → null, n = 1 → r 0', () => {
    expect(minidisc([])).toEqual({ disk: null, boundary: [], tests: 0, updates: 0 })
    expect(minidisc(P([[3, 4]]))).toEqual({ disk: { center: { x: 3, y: 4 }, radius: 0 }, boundary: [0], tests: 0, updates: 0 })
  })

  it('points on a circle', () => {
    const pts: Pt[] = Array.from({ length: 8 }, (_, k) => ({
      x: 387 + 140 * Math.cos((k * Math.PI) / 4),
      y: 180 + 140 * Math.sin((k * Math.PI) / 4),
    }))
    for (const order of [defaultOrder(8, 8), [0, 1, 2, 3, 4, 5, 6, 7], [7, 3, 5, 1, 0, 6, 2, 4]]) {
      const res = minidisc(pts, order)
      expectDisk(res.disk, 387, 180, 140)
      expect(Math.abs(res.disk!.radius - 140)).toBeLessThanOrEqual(1e-6)
      expect(isMinimalDisk(pts, res.disk)).toEqual({ ok: true })
    }
  })

  it('random 200 × 3 orders', () => {
    const rng = mulberry32(2026)
    for (let s = 0; s < 200; s++) {
      const n = 2 + Math.floor(rng() * 39)
      const pts = randomPointSet(rng, n, BOX, 1)
      const orders = [defaultOrder(n, s), defaultOrder(n, s + 1000), Array.from({ length: n }, (_, i) => n - 1 - i)]
      const results = orders.map((o) => minidisc(pts, o))
      for (const res of results) {
        expect(isMinimalDisk(pts, res.disk)).toEqual({ ok: true })
        expect(res.boundary.length).toBeGreaterThanOrEqual(2)
        expect(res.boundary.length).toBeLessThanOrEqual(3)
        for (const b of res.boundary)
          expect(Math.abs(distance(res.disk!.center, pts[b]) - res.disk!.radius)).toBeLessThanOrEqual(1e-7 * Math.max(1, res.disk!.radius))
        expect(res.tests).toBeGreaterThanOrEqual(n - 2)
      }
      expectSameDisk(results[0].disk, results[1].disk)
      expectSameDisk(results[0].disk, results[2].disk)
    }
  })

  it('matches brute force', () => {
    const rng = mulberry32(99)
    for (let s = 0; s < 100; s++) {
      const n = 2 + Math.floor(rng() * 8)
      const pts = randomPointSet(rng, n, BOX, 1)
      const res = minidisc(pts, defaultOrder(n, s))
      expectSameDisk(res.disk, bruteForceDisk(pts))
    }
  })

  it('wrapper returns the same disk', () => {
    const rng = mulberry32(7)
    for (let s = 0; s < 50; s++) {
      const n = 1 + Math.floor(rng() * 30)
      const pts = randomPointSet(rng, n, BOX, 1)
      const copy = pts.map((p) => ({ ...p }))
      expectSameDisk(smallestEnclosingDisk(pts, mulberry32(s)), minidisc(pts).disk)
      expect(pts).toEqual(copy)
    }
    expect(smallestEnclosingDisk([], mulberry32(1))).toEqual({ center: { x: 0, y: 0 }, radius: 0 })
  })

  it('does not mutate the order', () => {
    const order = [2, 0, 1]
    minidisc(P([[0, 0], [10, 0], [5, 8]]), order)
    expect(order).toEqual([2, 0, 1])
  })
})

describe('order helpers', () => {
  it('normalizeOrder drops invalid and repeated indices, appends the missing ones', () => {
    expect(normalizeOrder(5, [3, 3, 7, -1, 1.5, 0])).toEqual([3, 0, 1, 2, 4])
    expect(normalizeOrder(4, [])).toEqual([0, 1, 2, 3])
    expect(normalizeOrder(3, [2, 1, 0])).toEqual([2, 1, 0])
    expect(normalizeOrder(0, [0, 1])).toEqual([])
    expect(normalizeOrder(6)).toEqual(defaultOrder(6))
  })

  it('defaultOrder is a seeded permutation, seed defaults to n', () => {
    const o = defaultOrder(12, 5)
    expect([...o].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i))
    expect(defaultOrder(12, 5)).toEqual(o)
    expect(defaultOrder(12)).toEqual(defaultOrder(12, 12))
    expect(defaultOrder(12, 6)).not.toEqual(o)
    expect(defaultOrder(0)).toEqual([])
  })

  it('label is 1-based', () => {
    expect(label(0)).toBe('v1')
    expect(label(11)).toBe('v12')
  })
})

type Rec = { line: number; description: string; patch: MdPatch; ctx: MdRecorderContext }
function record(points: Pt[], order?: number[]) {
  const recs: Rec[] = []
  const res = minidisc(points, order, (line, description, patch, ctx) => recs.push({ line, description, patch, ctx }))
  return { res, recs }
}

describe('recorder', () => {
  // v1 lies inside the final disc; v2, v3, v4 define it (circumcentre (5, 2.4375), r 5.5625)
  const pts = P([[5, 1], [10, 0], [0, 0], [5, 8]])
  const order = [2, 1, 3, 0]

  it('recorder lines and descriptions', () => {
    const { res, recs } = record(pts, order)
    expect(recs.map((r) => r.line)).toEqual([1, 2, 4, 6, 9, 11, 13, 16, 18, 20, 21, 14, 4, 7])
    expect(recs.map((r) => r.description)).toEqual([
      'Order: v3, v2, v4, v1',
      'D₂: smallest disc of v3 and v2',
      'v4 is outside D → it must lie on the boundary of the new disc',
      'Call MiniDiscWithPoint with q = v4',
      'D₁: smallest disc with v4 and v3 on its boundary',
      'v2 is outside D → it must lie on the boundary of the new disc',
      'Call MiniDiscWith2Points with q₁ = v2, q₂ = v4',
      'D₀: smallest disc with v2 and v4 on its boundary',
      'v3 is outside D → it must lie on the boundary of the new disc',
      'D: disc through v2, v4 and v3',
      'Return D (r = 5.6) to MiniDiscWithPoint',
      'Return D (r = 5.6) to MiniDisc',
      'v1 is inside D → keep D',
      'Done: smallest disc through v2, v3 and v4 (r = 5.6), 4 tests, 3 updates',
    ])
    expect(res.boundary).toEqual([1, 2, 3])
    expect(res.tests).toBe(4)
    expect(res.updates).toBe(3)
    expectDisk(res.disk, 5, 2.4375, 5.5625)
  })

  it('records state: phase, stack frames, counters and patches', () => {
    const { recs } = record(pts, order)
    expect(recs.map((r) => r.ctx.phase)).toEqual(['init', ...Array(12).fill('run'), 'done'])
    expect(recs.map((r) => r.ctx.stack.length)).toEqual([0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 2, 1, 1])
    expect(recs.map((r) => r.ctx.tests)).toEqual([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4])
    expect(recs.map((r) => r.ctx.updates)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3])
    expect(recs[0].ctx.disk).toBeNull()
    expect(recs[0].ctx.order).toEqual(order)

    // line 20: innermost frame MiniDiscWith2Points(P = {v3}, q1 = v2, q2 = v4); fixed = [q, p_j]
    const r20 = recs[9]
    expect(r20.ctx.stack.map((f) => f.proc)).toEqual(['MiniDisc', 'WithPoint', 'With2Points'])
    expect(r20.ctx.stack.map((f) => f.fixed)).toEqual([[], [3], [3, 1]])
    expect(r20.ctx.stack.map((f) => f.prefix)).toEqual([4, 2, 1])
    expect(r20.ctx.stack.map((f) => f.index)).toEqual([2, 1, 0])
    expect(r20.patch.current).toBe(2)
    expectDisk(r20.patch.newDisk!, 5, 2.4375, 5.5625)
    expectDisk(r20.ctx.disk, 5, 2.4375, 5.5625)
    // the outer frames still hold their own discs: D₂ of v3, v2 and D₁ of v4, v3
    expectDisk(r20.ctx.stack[0].disk, 5, 0, 5)
    expectDisk(r20.ctx.stack[1].disk, 2.5, 4, Math.hypot(2.5, 4))

    expect(recs[8].patch).toEqual({ current: 2, testing: { point: 2, inside: false } })
    expect(recs[12].patch).toEqual({ current: 0, testing: { point: 0, inside: true } })
    expectDisk(recs[10].patch.returned!, 5, 2.4375, 5.5625)
    expectDisk(recs[11].patch.returned!, 5, 2.4375, 5.5625)
    expect(recs[3].patch).toEqual({ current: 3 })
    // initial discs at lines 2 / 9 / 16 and the index of each loop before its first test
    expectDisk(recs[1].ctx.disk, 5, 0, 5)
    expectDisk(recs[4].ctx.disk, 2.5, 4, Math.hypot(2.5, 4))
    expectDisk(recs[7].ctx.disk, 7.5, 4, Math.hypot(2.5, 4))
    expect(recs[1].ctx.stack[0].index).toBe(1)
    expect(recs[4].ctx.stack[1].index).toBe(0)
    expect(recs[7].ctx.stack[2].index).toBe(-1)
    // after the returns the outer frame holds the returned disc
    expectDisk(recs[12].ctx.disk, 5, 2.4375, 5.5625)
    expect(recs[12].ctx.stack[0].index).toBe(3)
  })

  it('stack frames are copies', () => {
    const { recs } = record(pts, order)
    const before = structuredClone(recs[1].ctx.stack)
    expect(recs[1].ctx.stack[0]).not.toBe(recs[2].ctx.stack[0])
    expect(recs[1].ctx.stack[0].disk).not.toBe(recs[2].ctx.stack[0].disk)
    expect(recs[1].ctx.stack).toEqual(before)
    expect(recs[1].ctx.stack[0].index).toBe(1)
    expect(recs[2].ctx.stack[0].index).toBe(2)
  })

  it('n ≤ 2 records the order, the initial disc and the done step', () => {
    expect(record([]).recs.map((r) => [r.line, r.description])).toEqual([
      [1, 'Order: none'],
      [7, 'Done: no points'],
    ])
    const one = record(P([[3, 4]])).recs
    expect(one.map((r) => [r.line, r.description])).toEqual([
      [1, 'Order: v1'],
      [7, 'Done: smallest disc through v1 (r = 0.0), 0 tests, 0 updates'],
    ])
    expect(one[1].ctx.phase).toBe('done')
    expect(one[1].ctx.disk).toEqual({ center: { x: 3, y: 4 }, radius: 0 })
    const two = record(P([[0, 0], [4, 2]]), [1, 0]).recs
    expect(two.map((r) => [r.line, r.description])).toEqual([
      [1, 'Order: v2, v1'],
      [2, 'D₂: smallest disc of v2 and v1'],
      [7, 'Done: smallest disc through v1 and v2 (r = 2.2), 0 tests, 0 updates'],
    ])
  })
})
