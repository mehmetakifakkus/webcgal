import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { distance, dot, subtract } from '../../primitives'
import { mulberry32 } from '../delaunay/delaunay'
import { isSimple, signedArea } from '../triangulation/polygon'
import { TRIANGULATION_PRESETS } from '../triangulation/presets'
import { pointInPolygon, randomStarPolygon } from '../triangulation/verify'
import { coverage, sees, visibilityPolygon } from './visibility'

const P = (...c: [number, number][]): Pt[] => c.map(([x, y]) => ({ x, y }))

// CCW L: the bottom arm [0,200]×[0,100] and the left arm [0,100]×[100,200]; v4 = (100,100) is reflex.
const L_SHAPE = P([0, 0], [200, 0], [200, 100], [100, 100], [100, 200], [0, 200])

const hexagon = (cx: number, cy: number, r: number): Pt[] =>
  Array.from({ length: 6 }, (_, i) => ({ x: cx + r * Math.cos((i * Math.PI) / 3), y: cy + r * Math.sin((i * Math.PI) / 3) }))

/** Polygons with collinear consecutive vertices and rays through several vertices. */
const COLLINEAR = [
  P([0, 0], [100, 0], [200, 0], [200, 100], [200, 200], [100, 200], [0, 200], [0, 100]),
  P([0, 0], [100, 0], [200, 0], [200, 100], [150, 100], [100, 100], [100, 200], [0, 200], [0, 100]),
  P([0, 0], [100, 0], [200, 0], [300, 0], [300, 200], [250, 50], [200, 200], [150, 50], [100, 200], [50, 50], [0, 200], [0, 100]),
  // the ray from v1 through the reflex vertex (100,100) continues to (200,200)
  P([0, 0], [300, 0], [300, 200], [200, 200], [150, 150], [100, 100], [100, 300], [0, 300]),
  // a staircase: the reflex vertices lie on the line from (300,0) to (0,300)
  P([0, 0], [150, 0], [300, 0], [300, 100], [200, 100], [200, 200], [100, 200], [100, 300], [0, 300], [0, 150]),
]

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const r = subtract(b, a)
  const len2 = dot(r, r)
  const u = len2 === 0 ? 0 : Math.min(1, Math.max(0, dot(subtract(p, a), r) / len2))
  return distance(p, { x: a.x + u * r.x, y: a.y + u * r.y })
}

function distToBoundary(p: Pt, poly: Pt[]): number {
  let d = Infinity
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(p, poly[i], poly[(i + 1) % poly.length]))
  return d
}

describe('sees', () => {
  it('convex polygon: every pair of points, boundary included', () => {
    const h = hexagon(300, 200, 100)
    for (const a of h) for (const b of h) expect(sees(h, a, b)).toBe(true)
    expect(sees(h, h[0], { x: 300, y: 200 })).toBe(true)
    expect(sees(h, h[0], { x: 500, y: 200 })).toBe(false)
  })

  it('L shape: blocked by the reflex corner, along edges and through vertices', () => {
    expect(sees(L_SHAPE, L_SHAPE[1], { x: 50, y: 190 })).toBe(false)
    expect(sees(L_SHAPE, L_SHAPE[1], { x: 20, y: 120 })).toBe(true)
    // ends at the reflex vertex v4, and grazes it on the way to v6
    expect(sees(L_SHAPE, L_SHAPE[1], L_SHAPE[3])).toBe(true)
    expect(sees(L_SHAPE, L_SHAPE[1], L_SHAPE[5])).toBe(true)
    // runs along the edge v3–v4, and along it past v4 into the interior
    expect(sees(L_SHAPE, L_SHAPE[2], L_SHAPE[3])).toBe(true)
    expect(sees(L_SHAPE, { x: 150, y: 100 }, { x: 0, y: 100 })).toBe(true)
    // runs along the whole edge v2–v3
    expect(sees(L_SHAPE, L_SHAPE[1], L_SHAPE[2])).toBe(true)
    // leaves the polygon through the reflex vertex
    expect(sees(L_SHAPE, { x: 50, y: 50 }, { x: 150, y: 150 })).toBe(false)
    // crosses the outside between two boundary points
    expect(sees(L_SHAPE, L_SHAPE[2], L_SHAPE[4])).toBe(false)
    expect(sees(L_SHAPE, L_SHAPE[2], { x: 50, y: 150 })).toBe(false)
    // touches the reflex vertex from inside; the second one crosses two edges properly
    expect(sees(L_SHAPE, { x: 150, y: 50 }, { x: 50, y: 150 })).toBe(true)
    expect(sees(L_SHAPE, { x: 190, y: 50 }, { x: 50, y: 190 })).toBe(false)
    // points outside
    expect(sees(L_SHAPE, { x: 150, y: 150 }, { x: 150, y: 150 })).toBe(false)
    expect(sees(L_SHAPE, { x: 150, y: 150 }, L_SHAPE[3])).toBe(false)
  })
})

describe('visibilityPolygon', () => {
  it('visibility of a convex polygon is the polygon', () => {
    const h = hexagon(300, 200, 100)
    const area = signedArea(h)
    for (let v = 0; v < h.length; v++) {
      const vis = visibilityPolygon(h, v)
      expect(vis[0]).toEqual(h[v])
      expect(signedArea(vis)).toBeCloseTo(area, 3)
      for (const q of h) expect(vis.some((p) => distance(p, q) < 1e-6)).toBe(true)
    }
  })

  it('L shape: v2 cannot see the end of the upper arm, the reflex vertex sees everything', () => {
    const vis = visibilityPolygon(L_SHAPE, 1)
    expect(vis[0]).toEqual(L_SHAPE[1])
    expect(signedArea(vis)).toBeCloseTo(25000, 1)
    for (const q of P([200, 100], [100, 100], [0, 200], [0, 0])) expect(vis.some((p) => distance(p, q) < 1e-3)).toBe(true)
    expect(pointInPolygon({ x: 50, y: 190 }, vis)).toBe(false)
    expect(pointInPolygon({ x: 20, y: 120 }, vis)).toBe(true)
    const all = visibilityPolygon(L_SHAPE, 3)
    expect(all[0]).toEqual(L_SHAPE[3])
    expect(signedArea(all)).toBeCloseTo(signedArea(L_SHAPE), 3)
  })

  it('CW input: the same region, starting at the vertex', () => {
    const cw = [...L_SHAPE].reverse()
    const vis = visibilityPolygon(cw, 4) // = L_SHAPE[1]
    expect(vis[0]).toEqual(L_SHAPE[1])
    expect(signedArea(vis)).toBeCloseTo(25000, 1)
  })

  it('throws on an index out of range', () => {
    expect(() => visibilityPolygon(L_SHAPE, 6)).toThrow(/out of range/)
    expect(() => visibilityPolygon(L_SHAPE, -1)).toThrow(/out of range/)
  })

  it('visibility matches sampling', () => {
    const rng = mulberry32(31)
    const polys: Pt[][] = [...COLLINEAR]
    while (polys.length < COLLINEAR.length + 50) {
      const n = 3 + Math.floor(rng() * 28)
      const p = randomStarPolygon(rng, n, 387, 180, 20 + rng() * 60, 160)
      if (isSimple(p)) polys.push(p)
    }
    let checked = 0
    const mismatches: string[] = []
    for (const poly of polys) {
      expect(isSimple(poly)).toBe(true)
      const xs = poly.map((p) => p.x)
      const ys = poly.map((p) => p.y)
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
      for (let v = 0; v < poly.length; v++) {
        const vis = visibilityPolygon(poly, v)
        expect(vis[0]).toEqual(poly[v])
        expect(signedArea(vis)).toBeGreaterThan(0)
        let k = 0
        for (let attempt = 0; k < 200 && attempt < 5000; attempt++) {
          const s = { x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0) }
          if (!pointInPolygon(s, poly)) continue
          k++
          if (distToBoundary(s, poly) < 1e-6 || distToBoundary(s, vis) < 1e-6) continue
          if (sees(poly, poly[v], s) !== pointInPolygon(s, vis)) {
            mismatches.push(`polygon ${polys.indexOf(poly)}, v${v + 1}, (${s.x}, ${s.y})`)
          }
          checked++
        }
      }
    }
    expect(mismatches).toEqual([])
    expect(checked).toBeGreaterThan(100000)
  })
})

describe('coverage', () => {
  it('convex polygon and one camera → 100%', () => {
    const h = hexagon(300, 200, 100)
    expect(coverage(h, [2])).toEqual({ percent: 100, covered: true, perCamera: [100] })
  })

  it('no cameras → 0%', () => {
    expect(coverage(L_SHAPE, [])).toEqual({ percent: 0, covered: false, perCamera: [] })
  })

  it('L shape: a camera at v2 misses the end of the upper arm', () => {
    const c = coverage(L_SHAPE, [1])
    expect(c.covered).toBe(false)
    expect(c.percent).toBeGreaterThanOrEqual(80)
    expect(c.percent).toBeLessThanOrEqual(87)
    expect(c.perCamera).toEqual([c.percent])
    expect(coverage(L_SHAPE, [3])).toEqual({ percent: 100, covered: true, perCamera: [100] })
    const two = coverage(L_SHAPE, [3, 1])
    expect(two).toEqual({ percent: 100, covered: true, perCamera: [100, c.percent] })
  })

  it('step changes the sample grid', () => {
    const c = coverage(L_SHAPE, [1], 1)
    expect(c.percent).toBe(Math.round((100 * 25000) / 30000))
  })

  it('no interior sample → 100% covered (not reachable for the presets)', () => {
    expect(coverage(P([1, 1], [4, 1], [1, 4]), [])).toEqual({ percent: 100, covered: true, perCamera: [] })
    for (const p of TRIANGULATION_PRESETS) expect(coverage(p.polygon, []).percent).toBe(0)
  })
})
