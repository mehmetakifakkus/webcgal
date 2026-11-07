import { describe, expect, it } from 'vitest'
import type { Pt, VoronoiResult } from '../../types'
import { orientation } from '../../primitives'
import { convexHull } from '../convexHull'
import { mulberry32 } from '../delaunay/delaunay'
import { DELAUNAY_PRESETS } from '../delaunay/presets'
import { randomPointSet } from '../delaunay/verify'
import { CANVAS_BOX } from './clip'
import { cellPolygon } from './cells'
import { isVoronoi } from './verify'
import { diagonal, voronoi } from './voronoi'
import type { VorPatch, VorRecorderContext } from './voronoiState'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))

const square = P([[0, 0], [100, 0], [100, 100], [0, 100]])
const grid = (): Pt[] => {
  const out: Pt[] = []
  for (const y of [60, 140, 220, 300]) for (const x of [160, 320, 480, 640]) out.push({ x, y })
  return out
}
const circle8 = (): Pt[] =>
  Array.from({ length: 8 }, (_, k) => ({ x: 387 + 130 * Math.cos((k * Math.PI) / 4), y: 180 + 130 * Math.sin((k * Math.PI) / 4) }))
const collinear = P([[150, 100], [300, 100], [450, 100], [600, 100], [700, 100]])
const collinearPlusOne = P([[150, 100], [300, 100], [450, 100], [600, 100], [380, 280]])
const BOX = { x0: 40, y0: 30, x1: 740, y1: 330 }

const rays = (r: VoronoiResult) => r.edges.filter((e) => e.b === null)
const bounded = (r: VoronoiResult) => r.edges.filter((e) => e.b !== null)

function area(poly: Pt[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length]
    s += p.x * q.y - q.x * p.y
  }
  return s / 2
}

/** Order-free description of the diagram: vertex coordinates and edges by sites and geometry. */
function signature(r: VoronoiResult) {
  const f = (p: Pt) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`
  const vertices = r.vertices.map(f).sort()
  const edges = r.edges
    .map((e) => {
      const s = [...e.sites].sort((a, b) => a - b).join('-')
      if (e.b === null) return `${s} ray ${f(r.vertices[e.a])} ${f(e.dir!)}`
      return `${s} seg ${[f(r.vertices[e.a]), f(r.vertices[e.b])].sort().join(' ')}`
    })
    .sort()
  const lines = r.lines.map((l) => `${[...l.sites].sort((a, b) => a - b).join('-')} ${f(l.p)}`).sort()
  return { vertices, edges, lines }
}

/** True when q lies strictly outside the convex hull of points (at least three hull vertices). */
function outsideHull(points: Pt[], q: Pt): boolean {
  const h = convexHull(points)
  // convexHull is clockwise
  return h.some((a, i) => orientation(a, h[(i + 1) % h.length], q) === 1)
}

describe('voronoi', () => {
  it('unit square: one vertex, four outward axis rays, four unbounded cells', () => {
    const r = voronoi(square)
    expect(r.vertices).toHaveLength(1)
    expect(r.vertices[0].x).toBeCloseTo(50, 9)
    expect(r.vertices[0].y).toBeCloseTo(50, 9)
    expect(bounded(r)).toHaveLength(0)
    expect(rays(r)).toHaveLength(4)
    const expectedDir: Record<string, Pt> = {
      '0,1': { x: 0, y: -1 },
      '1,2': { x: 1, y: 0 },
      '2,3': { x: 0, y: 1 },
      '0,3': { x: -1, y: 0 },
    }
    for (const e of rays(r)) {
      const d = expectedDir[[...e.sites].sort().join(',')]
      expect(d).toBeDefined()
      expect(e.dir!.x).toBeCloseTo(d.x, 12)
      expect(e.dir!.y).toBeCloseTo(d.y, 12)
    }
    expect(r.cells).toHaveLength(4)
    for (const c of r.cells) {
      expect(c.rays).toBeDefined()
      expect(c.vertices).toEqual([0])
    }
    expect(isVoronoi(square, r)).toEqual({ ok: true })
  })

  it('grid 4x4: 9 vertices (merged), 12 edges, 12 rays, inner 4 cells closed', () => {
    const pts = grid()
    const r = voronoi(pts)
    expect(r.vertices).toHaveLength(9)
    expect(bounded(r)).toHaveLength(12)
    expect(rays(r)).toHaveLength(12)
    const closed = r.cells.filter((c) => !c.rays).map((c) => c.site)
    expect(closed).toEqual([5, 6, 9, 10])
    for (const s of closed) expect(r.cells[s].vertices).toHaveLength(4)
    expect(isVoronoi(pts, r)).toEqual({ ok: true })
  })

  it('points on a circle: 1 vertex at the centre, 8 rays, no bounded edge', () => {
    const pts = circle8()
    const r = voronoi(pts)
    expect(r.vertices).toHaveLength(1)
    expect(Math.abs(r.vertices[0].x - 387)).toBeLessThan(1e-6)
    expect(Math.abs(r.vertices[0].y - 180)).toBeLessThan(1e-6)
    expect(rays(r)).toHaveLength(8)
    expect(bounded(r)).toHaveLength(0)
    expect(r.vertexOfTriangle).toEqual(r.triangles.map(() => 0))
    expect(isVoronoi(pts, r)).toEqual({ ok: true })
  })

  it('collinear 5: no vertices, 4 bisector lines perpendicular to the line, 5 open cells', () => {
    // shuffled input: the lines follow the order along the line
    const pts = P([[450, 100], [150, 100], [700, 100], [300, 100], [600, 100]])
    const r = voronoi(pts)
    expect(r.vertices).toEqual([])
    expect(r.edges).toEqual([])
    expect(r.lines).toHaveLength(4)
    expect(r.lines.map((l) => l.sites)).toEqual([[1, 3], [3, 0], [0, 4], [4, 2]])
    expect(r.lines.map((l) => l.p.x)).toEqual([225, 375, 525, 650])
    for (const l of r.lines) {
      expect(l.p.y).toBe(100)
      expect(Math.abs(l.dir.x)).toBeLessThan(1e-12)
      expect(Math.abs(l.dir.y)).toBeCloseTo(1, 12)
    }
    expect(r.cells).toEqual(pts.map((_, site) => ({ site, vertices: [] })))
    expect(isVoronoi(pts, r)).toEqual({ ok: true })
    expect(isVoronoi(collinear, voronoi(collinear))).toEqual({ ok: true })
  })

  it('collinear plus one: 3 vertices', () => {
    const r = voronoi(collinearPlusOne)
    expect(r.vertices).toHaveLength(3)
    expect(bounded(r)).toHaveLength(2)
    expect(rays(r)).toHaveLength(5)
    expect(r.cells.every((c) => c.rays)).toBe(true)
    expect(isVoronoi(collinearPlusOne, r)).toEqual({ ok: true })
  })

  it('n=0, n=1, n=2', () => {
    expect(voronoi([])).toEqual({ vertices: [], edges: [], lines: [], cells: [], triangles: [], vertexOfTriangle: [] })
    expect(voronoi(P([[5, 5]]))).toEqual({
      vertices: [],
      edges: [],
      lines: [],
      cells: [{ site: 0, vertices: [] }],
      triangles: [],
      vertexOfTriangle: [],
    })
    const pts = P([[50, 10], [10, 30]])
    const r = voronoi(pts)
    expect(r.vertices).toEqual([])
    expect(r.edges).toEqual([])
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].sites).toEqual([1, 0])
    expect(r.lines[0].p).toEqual({ x: 30, y: 20 })
    expect(r.cells).toHaveLength(2)
    for (const pt of [[], P([[5, 5]]), pts]) expect(isVoronoi(pt, voronoi(pt))).toEqual({ ok: true })
  })

  it('duplicate point throws', () => {
    expect(() => voronoi(P([[0, 0], [10, 0], [0, 0]]))).toThrow('points must be distinct')
  })

  it('random 200 sets: isVoronoi ok', () => {
    const rng = mulberry32(20261107)
    for (let s = 0; s < 200; s++) {
      const n = 3 + Math.floor(rng() * 28)
      const pts = randomPointSet(rng, n, BOX, 5)
      const r = voronoi(pts)
      expect(isVoronoi(pts, r), `set ${s}`).toEqual({ ok: true })
      expect(r.cells.map((c) => c.site)).toEqual(pts.map((_, i) => i))
    }
  })

  it('order independent: grid subsets give the same vertices and edges for three orders', () => {
    const rng = mulberry32(4242)
    const g = grid()
    let merged = 0
    for (let s = 0; s < 50; s++) {
      let pts = g.filter(() => rng() < 0.6)
      if (pts.length < 3) pts = g.slice(0, 5)
      const n = pts.length
      const perm = pts.map((_, i) => i)
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[perm[i], perm[j]] = [perm[j], perm[i]]
      }
      const orders = [undefined, pts.map((_, i) => i).reverse(), perm]
      const results = orders.map((o) => voronoi(pts, undefined, o))
      for (const r of results) expect(isVoronoi(pts, r), `subset ${s}`).toEqual({ ok: true })
      if (results[0].vertices.length < results[0].triangles.length) merged++
      const sig = signature(results[0])
      for (const r of results.slice(1)) expect(signature(r), `subset ${s}`).toEqual(sig)
    }
    expect(merged).toBeGreaterThan(25)
  })

  it('rays point away from the hull', () => {
    const rng = mulberry32(77)
    let checked = 0
    for (let s = 0; s < 50; s++) {
      const n = 3 + Math.floor(rng() * 28)
      const pts = randomPointSet(rng, n, BOX, 5)
      const r = voronoi(pts)
      const D = diagonal(pts)
      for (const e of rays(r)) {
        const a = r.vertices[e.a]
        expect(outsideHull(pts, { x: a.x + e.dir!.x * D, y: a.y + e.dir!.y * D }), `set ${s}`).toBe(true)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(200)
  })

  it('cell polygons tile the box (random sets and presets)', () => {
    const boxArea = 775 * 360
    const rng = mulberry32(31)
    const inputs: Pt[][] = []
    for (let s = 0; s < 30; s++) inputs.push(randomPointSet(rng, 3 + Math.floor(rng() * 28), BOX, 5))
    for (const pr of DELAUNAY_PRESETS) inputs.push(pr.points)
    inputs.push(collinear, square, P([[300, 200]]), P([[100, 100], [500, 300]]))
    for (const pts of inputs) {
      const r = voronoi(pts)
      let total = 0
      for (const c of r.cells) {
        const poly = cellPolygon(pts, r, c, CANVAS_BOX)
        const a = area(poly)
        expect(a).toBeGreaterThan(0)
        for (const q of poly) {
          expect(q.x).toBeGreaterThanOrEqual(-1e-9)
          expect(q.x).toBeLessThanOrEqual(775 + 1e-9)
          expect(q.y).toBeGreaterThanOrEqual(-1e-9)
          expect(q.y).toBeLessThanOrEqual(360 + 1e-9)
        }
        total += a
      }
      expect(Math.abs(total - boxArea)).toBeLessThanOrEqual(1e-6 * boxArea)
    }
  })

  it('records the steps with the spec descriptions', () => {
    const log: { line: number; d: string; patch: VorPatch; ctx: VorRecorderContext }[] = []
    voronoi(square, (line, d, patch, ctx) => log.push({ line, d, patch, ctx }))
    expect(log.slice(0, 3).map((s) => s.line)).toEqual([1, 3, 4])
    expect(log.slice(3, 8).map((s) => s.line).sort((a, b) => a - b)).toEqual([7, 9, 9, 9, 9])
    expect(log.slice(8).map((s) => s.line)).toEqual([11, 11, 11, 11, 12])
    expect(log[0].d).toBe('Delaunay triangulation: 2 triangles, 5 edges')
    expect(log[1].d).toMatch(/^Triangle v\d v\d v\d → Voronoi vertex u1 at \(50\.0, 50\.0\)$/)
    expect(log[1].patch.circle!.radius).toBeCloseTo(Math.hypot(50, 50), 9)
    expect(log[2].d).toMatch(/^Triangle v\d v\d v\d shares its circumcenter with u1 → merged$/)
    expect(log[2].patch.merged).toEqual([0, 1])
    const skipped = log.find((s) => s.line === 7)!
    expect(skipped.d).toMatch(/^Edge v(1–v3|2–v4): both triangles share the vertex u1 → no edge$/)
    expect(skipped.patch.skipped).toBe(true)
    const hull = log.filter((s) => s.line === 9).map((s) => s.d)
    expect(hull[0]).toMatch(/^Hull edge v1–v2 → ray from u1 away from v[34]$/)
    expect(log.filter((s) => s.line === 9).map((s) => s.patch.newEdge)).toEqual([0, 1, 2, 3])
    expect(log.filter((s) => s.line === 11).map((s) => s.d)).toEqual([
      'Cell of v1 is unbounded: ∞ u1 ∞',
      'Cell of v2 is unbounded: ∞ u1 ∞',
      'Cell of v3 is unbounded: ∞ u1 ∞',
      'Cell of v4 is unbounded: ∞ u1 ∞',
    ])
    expect(log[log.length - 1].d).toBe('Done: 1 vertices, 4 edges, 4 cells (4 unbounded)')
    expect(log[log.length - 1].ctx.phase).toBe('done')
    expect(log[log.length - 1].ctx.cells).toHaveLength(4)
    // ctx arrays are copies
    expect(log[1].ctx.vertices).toHaveLength(1)
    expect(log[1].ctx.vertexOfTriangle.filter((v) => v !== null)).toHaveLength(1)
    expect(log[1].ctx.edges).toHaveLength(0)

    const col: string[] = []
    voronoi(P([[300, 100], [100, 100], [200, 100]]), (_l, d) => col.push(d))
    expect(col).toEqual([
      'Delaunay triangulation: no triangles, the points are collinear',
      'Points are collinear: bisector of v2–v3',
      'Points are collinear: bisector of v3–v1',
      'Cell of v1 is unbounded: ∞ ∞',
      'Cell of v2 is unbounded: ∞ ∞',
      'Cell of v3 is unbounded: ∞ ∞',
      'Done: 2 bisectors, 3 unbounded cells',
    ])

    const tb: string[] = []
    voronoi(DELAUNAY_PRESETS[0].points, (_l, d) => tb.push(d))
    expect(tb[0]).toBe('Delaunay triangulation: 9 triangles, 17 edges')
    for (const d of tb.filter((x) => x.startsWith('Edge ')))
      expect(d).toMatch(/^Edge v\d+–v\d+ is shared by u\d+ and u\d+ → Voronoi edge u\d+–u\d+$/)
    expect(tb.some((d) => /^Cell of v8: (u\d+ ?)+$/.test(d))).toBe(true)
    expect(tb[tb.length - 1]).toBe('Done: 9 vertices, 17 edges, 9 cells (7 unbounded)')
  })
})
