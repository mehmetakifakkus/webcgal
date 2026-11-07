import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { inCircle, orientation } from '../../primitives'
import { convexHull } from '../convexHull'
import { defaultOrder, delaunay, isIllegal, mulberry32 } from './delaunay'
import type { DelPatch, DelRecorderContext } from './delaunayState'
import { highestIndex, P_MINUS_1, P_MINUS_2 } from './symbolic'
import { isDelaunay, randomPointSet } from './verify'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))
const key = (e: [number, number]) => `${e[0]},${e[1]}`

const grid = (): Pt[] => {
  const out: Pt[] = []
  for (const y of [60, 140, 220, 300]) for (const x of [160, 320, 480, 640]) out.push({ x, y })
  return out
}
const circle8 = (): Pt[] =>
  Array.from({ length: 8 }, (_, k) => ({ x: 387 + 130 * Math.cos((k * Math.PI) / 4), y: 180 + 130 * Math.sin((k * Math.PI) / 4) }))
const collinearPlusOne = P([[150, 100], [300, 100], [450, 100], [600, 100], [380, 280]])

/** True when no input point lies on the circumcircle of a result triangle (the triangulation is then unique). */
function uniqueDelaunay(points: Pt[], triangles: [number, number, number][]): boolean {
  return triangles.every(([a, b, c]) =>
    points.every((p, i) => i === a || i === b || i === c || inCircle(points[a], points[b], points[c], p) !== 0),
  )
}

describe('delaunay', () => {
  it('unit square: 2 triangles, 5 edges', () => {
    const pts = P([[0, 0], [1, 0], [1, 1], [0, 1]])
    const r = delaunay(pts)
    expect(r.triangles).toHaveLength(2)
    expect(r.edges).toHaveLength(5)
    expect(isDelaunay(pts, r.triangles)).toEqual({ ok: true })
  })

  it('grid 4x4: 18 triangles', () => {
    const pts = grid()
    const r = delaunay(pts)
    expect(r.triangles).toHaveLength(18)
    expect(isDelaunay(pts, r.triangles)).toEqual({ ok: true })
  })

  it('8 points on a circle: 6 triangles', () => {
    const pts = circle8()
    for (const order of [undefined, [5, 0, 7, 3, 1, 6, 4]]) {
      const r = delaunay(pts, order)
      expect(r.triangles).toHaveLength(6)
      expect(isDelaunay(pts, r.triangles)).toEqual({ ok: true })
    }
  })

  it('random 200 sets x 3 orders: valid, and the same edges in general position', () => {
    const rng = mulberry32(20261107)
    const box = { x0: 40, y0: 30, x1: 740, y1: 330 }
    let compared = 0
    for (let s = 0; s < 200; s++) {
      const n = 3 + Math.floor(rng() * 38)
      const pts = randomPointSet(rng, n, box, 5)
      const p0 = highestIndex(pts)
      const results = [undefined, defaultOrder(n, p0, s + 1), defaultOrder(n, p0, 1000 + s)].map((o) => delaunay(pts, o))
      for (const r of results) expect(isDelaunay(pts, r.triangles), `set ${s}`).toEqual({ ok: true })
      if (uniqueDelaunay(pts, results[0].triangles)) {
        compared++
        const e0 = results[0].edges.map(key)
        for (const r of results.slice(1)) expect(r.edges.map(key), `set ${s}`).toEqual(e0)
      }
    }
    expect(compared).toBeGreaterThan(150)
  })

  it('hull equals convexHull (CCW)', () => {
    const rng = mulberry32(99)
    for (let s = 0; s < 50; s++) {
      const n = 3 + Math.floor(rng() * 30)
      const pts = randomPointSet(rng, n, { x0: 0, y0: 0, x1: 600, y1: 400 }, 5)
      const { hull } = delaunay(pts)
      const ch = convexHull(pts).map((q) => pts.findIndex((p) => p.x === q.x && p.y === q.y))
      expect([...hull].sort((a, b) => a - b)).toEqual([...ch].sort((a, b) => a - b))
      for (let i = 0; i < hull.length; i++) {
        const [a, b, c] = [0, 1, 2].map((d) => pts[hull[(i + d) % hull.length]])
        expect(orientation(a, b, c)).toBe(1)
      }
    }
  })

  it('collinear plus one: 3 triangles', () => {
    for (const order of [undefined, [0, 3, 1, 2]]) {
      const r = delaunay(collinearPlusOne, order)
      expect(r.triangles).toHaveLength(3)
      expect(isDelaunay(collinearPlusOne, r.triangles)).toEqual({ ok: true })
      expect(r.hull).toEqual([0, 3, 4])
    }
  })

  it('all collinear n=5: no triangles, 4 consecutive edges', () => {
    const pts = P([[300, 100], [100, 100], [500, 100], [200, 100], [400, 100]])
    const r = delaunay(pts)
    expect(r.triangles).toEqual([])
    expect(r.edges).toEqual([[0, 3], [0, 4], [1, 3], [2, 4]])
    expect(r.hull).toEqual([1, 3, 0, 4, 2])
    expect(isDelaunay(pts, r.triangles)).toEqual({ ok: true })
  })

  it('n=0, n=1, n=2', () => {
    expect(delaunay([])).toEqual({ triangles: [], edges: [], hull: [], flips: 0 })
    expect(delaunay(P([[5, 5]]))).toEqual({ triangles: [], edges: [], hull: [0], flips: 0 })
    const r = delaunay(P([[50, 10], [10, 10]]))
    expect(r.triangles).toEqual([])
    expect(r.edges).toEqual([[0, 1]])
    expect([...r.hull].sort()).toEqual([0, 1])
  })

  it('duplicate point throws', () => {
    expect(() => delaunay(P([[0, 0], [10, 0], [0, 0]]))).toThrow('points must be distinct')
  })

  it('order missing p0 / containing new p0 is normalized', () => {
    const pts = P([[120, 300], [300, 320], [520, 290], [680, 230], [600, 80], [380, 50]])
    // p0 = 1; the order contains p0, an invalid index, a duplicate, and misses 2 and 5.
    let order: number[] = []
    const r = delaunay(pts, [3, 1, 9, 0, 3, -1, 4], (_l, _d, _p, ctx) => (order = [...ctx.order]))
    expect(order).toEqual([3, 0, 4, 2, 5])
    expect(isDelaunay(pts, r.triangles)).toEqual({ ok: true })
    // after a drag the new p0 (index 4) is in the order and the old one (1) is missing
    const moved = pts.map((p, i) => (i === 4 ? { x: 600, y: 400 } : p))
    const r2 = delaunay(moved, [3, 4, 0, 2, 5], (_l, _d, _p, ctx) => (order = [...ctx.order]))
    expect(order).toEqual([3, 0, 2, 5, 1])
    expect(isDelaunay(moved, r2.triangles)).toEqual({ ok: true })
  })

  it('defaultOrder is a seeded permutation without p0', () => {
    const o = defaultOrder(10, 4)
    expect([...o].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 5, 6, 7, 8, 9])
    expect(defaultOrder(10, 4)).toEqual(o)
    expect(defaultOrder(10, 4, 10)).toEqual(o)
    expect(defaultOrder(10, 4, 11)).not.toEqual(o)
  })
})

describe('isIllegal', () => {
  const pts = P([[0, 0], [100, 0], [50, 80], [50, -10], [50, -200]])
  it('real quadruple: inside the circle is illegal, outside or on it is legal', () => {
    // edge 0-1, opposite 2; p_r = 3 is inside the circle through 0, 1, 2; 4 is outside
    expect(isIllegal(pts, 3, 0, 1, 2)).toBe(true)
    expect(isIllegal(pts, 4, 0, 1, 2)).toBe(false)
    const sq = P([[0, 0], [1, 0], [1, 1], [0, 1]])
    expect(isIllegal(sq, 3, 0, 1, 2)).toBe(false)
  })
  // symbolic.ts places p-1 far west and p-2 far east; sq: v1 (0,0), v2 (1,0), v3 (1,1), v4 (0,1)
  const sq = P([[0, 0], [1, 0], [1, 1], [0, 1]])
  it("the book's symbolic rule: legal iff min(k, p_r) < min(i, j)", () => {
    // edge v2–p-1 of (v1, v2, p-1), k = v3 (real k and p_r): illegal, the quadrilateral is convex
    expect(isIllegal(sq, 0, 1, P_MINUS_1, 2)).toBe(true)
    // real edge v2–v3 with a symbolic opposite vertex: legal
    expect(isIllegal(sq, 0, 1, 2, P_MINUS_2)).toBe(false)
    // edge p-1–v1 of (v3, p-1, v1), k = p-2: min(-2, 2) < min(-1, 0), legal
    expect(isIllegal(sq, 2, P_MINUS_1, 0, P_MINUS_2)).toBe(false)
  })
  it('convexity guard: no flip when the quadrilateral is not convex', () => {
    // edge p-2–v2 of (v1, p-2, v2), k = v3: the book's rule says illegal, but v1, p-2, v3, v2 is not convex
    expect(isIllegal(sq, 0, P_MINUS_2, 1, 2)).toBe(false)
    // edge v1–p-2 of (v3, v1, p-2), k = p-1: never convex with p-1 west and p-2 east
    expect(isIllegal(sq, 2, 0, P_MINUS_2, P_MINUS_1)).toBe(false)
  })
})

describe('delaunay recorder', () => {
  type Rec = { line: number; description: string; patch: DelPatch; ctx: DelRecorderContext }
  const run = (pts: Pt[], order?: number[]) => {
    const steps: Rec[] = []
    const r = delaunay(pts, order, (line, description, patch, ctx) =>
      steps.push({ line, description, patch, ctx: structuredClone(ctx) }),
    )
    return { r, steps }
  }

  it('records the book-style descriptions in order', () => {
    // p0 = v3 (index 2); v1 is inserted into the initial triangle
    const pts = P([[0, 0], [100, 0], [50, 80]])
    const { steps } = run(pts, [0, 1])
    expect(steps.slice(0, 6).map((s) => [s.line, s.description])).toEqual([
      [3, 'p₀ = v3 is the lexicographically highest point; start with the triangle p₀ p₋₁ p₋₂'],
      [4, 'Insertion order: v1, v2'],
      [5, 'Insert p_r = v1 (2 of 3)'],
      [6, 'v1 lies inside triangle (v3, p₋₁, p₋₂)'],
      [8, 'Split into three triangles'],
      [9, 'Push edges v3–p₋₁, p₋₁–p₋₂, p₋₂–v3 onto the stack'],
    ])
    expect(steps[3].patch.located).toEqual({ t: [2, P_MINUS_1, P_MINUS_2] })
    expect(steps.at(-2)!.description).toBe('Remove p₋₁ and p₋₂ with all their edges')
    expect(steps.at(-2)!.line).toBe(13)
    expect(steps.at(-1)!.line).toBe(14)
    expect(steps.at(-1)!.description).toMatch(/^Done: 1 triangles, \d+ flips$/)
    expect(steps.at(-1)!.ctx.triangles).toEqual([{ v: expect.any(Array), alive: true }])
  })

  it('pops the top of the stack, records flips and circles only for real quadruples', () => {
    const pts = grid()
    const { r, steps } = run(pts)
    let flips = 0
    for (let s = 0; s < steps.length; s++) {
      const { line, description, patch, ctx } = steps[s]
      if (line === 16) {
        const prev = steps[s - 1].ctx.stack
        const top = prev[prev.length - 1]
        expect(description).toContain(`Test edge `)
        if (patch.testing) {
          expect(patch.testing.edge).toEqual(top)
          expect(ctx.stack).toEqual(prev.slice(0, -1))
          const real = [...patch.testing.edge, patch.testing.opposite].every((i) => i >= 0)
          expect(patch.circle !== undefined).toBe(real)
          expect(/(→ |: )illegal/.test(description)).toBe(!patch.testing.legal)
        }
      }
      if (line === 18) {
        flips++
        expect(patch.flipped).toBeDefined()
        expect(description).toMatch(/^Flip \S+–\S+ to v\d+–\S+$/)
      } else expect(patch.flipped).toBeUndefined()
      expect(ctx.flips).toBe(flips)
    }
    expect(flips).toBe(r.flips)
    expect(steps.at(-1)!.description).toBe(`Done: 18 triangles, ${r.flips} flips`)
  })

  it('splits into four when a point lies on an edge', () => {
    const { steps } = run(collinearPlusOne, [0, 3, 1, 2])
    const onEdge = steps.find((s) => s.line === 6 && s.description.includes('on edge'))!
    expect(onEdge.description).toBe('v2 lies on edge v1–v4')
    expect(onEdge.patch.located?.edge).toEqual([0, 3])
    const i = steps.indexOf(onEdge)
    expect(steps[i + 1].description).toBe('Split into four triangles')
    expect(steps[i + 1].line).toBe(11)
    expect(steps[i + 2].line).toBe(12)
    expect(steps[i + 2].ctx.stack).toHaveLength(4)
  })
})
