import paper from 'paper'
import { cellPolygon } from '../geometry/algorithms/voronoi/cells'
import { CANVAS_BOX, clipLine, clipRay, clipSegment, type Box } from '../geometry/algorithms/voronoi/clip'
import { voronoi as voronoiOf } from '../geometry/algorithms/voronoi/voronoi'
import type { Pt, VoronoiResult } from '../geometry/types'
import { toPoint, toPt, type EngineContext, type PointInput } from './drawing'
import { toPoints } from './toPoints'
import { isPointInput } from './segments'

/**
 * What `voronoi` returns, unclipped. Site indices (`sites`, `site`) refer to the input array,
 * vertex indices (`a`, `b`, cell `vertices`) to `vertices`. An edge with `b === null` is a ray
 * from vertex `a` along the unit vector `dir`; `lines` (collinear input only) are the bisectors
 * through `p` along `dir`.
 */
export type ApiVoronoiResult = {
  vertices: paper.Point[]
  edges: { sites: [number, number]; a: number; b: number | null; dir?: paper.Point }[]
  cells: { site: number; vertices: number[]; rays?: [number, number] }[]
  lines: { sites: [number, number]; p: paper.Point; dir: paper.Point }[]
}

const P = (p: Pt) => new paper.Point(p.x, p.y)

/** Voronoi diagram of a point set, derived from its Delaunay triangulation (de Berg et al. §9.2). */
export function voronoi(input: PointInput[]): ApiVoronoiResult {
  const points = toPoints(input, 'voronoi')
  let r: VoronoiResult
  try {
    r = voronoiOf(points)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'points must be distinct') throw new Error('voronoi: points must be distinct')
    throw e
  }
  return {
    vertices: r.vertices.map(P),
    edges: r.edges.map((e) => ({ sites: [...e.sites], a: e.a, b: e.b, ...(e.dir ? { dir: P(e.dir) } : {}) })),
    cells: r.cells.map((c) => ({ site: c.site, vertices: [...c.vertices], ...(c.rays ? { rays: [...c.rays] } : {}) })),
    lines: r.lines.map((l) => ({ sites: [...l.sites], p: P(l.p), dir: P(l.dir) })),
  }
}

const isIndex = (v: unknown, size: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < size

/** Checks a `voronoi(points)` result against `n` points and converts it back to geometry types. */
function toResult(result: unknown, n: number, fn: string): VoronoiResult {
  const fail = (): never => {
    throw new Error(`${fn}: expected the result of voronoi(points) for the same points`)
  }
  const { vertices, edges, cells, lines } = (result ?? {}) as Partial<Record<keyof ApiVoronoiResult, unknown[]>>
  if (![vertices, edges, cells, lines].every(Array.isArray)) fail()
  const vs = vertices as unknown[]
  if (!vs.every(isPointInput)) fail()
  const m = vs.length
  const pair = (s: unknown) => Array.isArray(s) && s.length === 2 && s.every((i) => isIndex(i, n))
  const out: VoronoiResult = {
    vertices: (vs as PointInput[]).map(toPt),
    edges: (edges as ApiVoronoiResult['edges']).map((e) => {
      if (!e || !pair(e.sites) || !isIndex(e.a, m)) fail()
      if (e.b === null ? !isPointInput(e.dir) : !isIndex(e.b, m)) fail()
      return { sites: e.sites, a: e.a, b: e.b, ...(e.b === null ? { dir: toPt(e.dir!) } : {}) }
    }),
    lines: (lines as ApiVoronoiResult['lines']).map((l) => {
      if (!l || !pair(l.sites) || !isPointInput(l.p) || !isPointInput(l.dir)) fail()
      return { sites: l.sites, p: toPt(l.p), dir: toPt(l.dir) }
    }),
    cells: (cells as ApiVoronoiResult['cells']).map((c) => {
      if (!c || !isIndex(c.site, n) || !Array.isArray(c.vertices) || !c.vertices.every((k) => isIndex(k, m))) fail()
      return { site: c.site, vertices: c.vertices, ...(c.rays ? { rays: c.rays } : {}) }
    }),
    triangles: [],
    vertexOfTriangle: [],
  }
  if (out.cells.length !== n) fail()
  return out
}

function toBox(box: unknown, fn: string): Box {
  const b = box as Partial<Box> | null
  const ok =
    typeof b === 'object' && b !== null && [b.x0, b.y0, b.x1, b.y1].every((v) => typeof v === 'number' && Number.isFinite(v))
  if (!ok || !(b.x0! < b.x1! && b.y0! < b.y1!)) throw new Error(`${fn}: expected a box { x0, y0, x1, y1 } with x0 < x1 and y0 < y1`)
  return { x0: b.x0!, y0: b.y0!, x1: b.x1!, y1: b.y1! }
}

/** The clipped cell polygon of every site, in site order (paper Points, counter-clockwise). */
export function voronoiCells(input: PointInput[], result: ApiVoronoiResult, box: Box = CANVAS_BOX): paper.Point[][] {
  const points = toPoints(input, 'voronoiCells')
  const r = toResult(result, points.length, 'voronoiCells')
  const b = toBox(box, 'voronoiCells')
  return points.map((_, site) => {
    const cell = r.cells.find((c) => c.site === site)
    return cell ? cellPolygon(points, r, cell, b).map(P) : []
  })
}

/** `drawVoronoi` for one run. */
export function createVoronoiDrawing(ctx: EngineContext) {
  const { scope } = ctx

  /** 1.5px edges of a `voronoi(points)` result; rays and bisector lines are clipped to `box`. No fill. */
  function drawVoronoi(input: PointInput[], result: ApiVoronoiResult, color = 'black', box: Box = CANVAS_BOX) {
    const points = toPoints(input, 'drawVoronoi')
    const r = toResult(result, points.length, 'drawVoronoi')
    const b = toBox(box, 'drawVoronoi')
    const pieces = [
      ...r.edges.map((e) =>
        e.b !== null ? clipSegment(r.vertices[e.a], r.vertices[e.b], b) : clipRay(r.vertices[e.a], e.dir!, b),
      ),
      ...r.lines.map((l) => clipLine(l.p, l.dir, b)),
    ]
    for (const piece of pieces) {
      if (!piece) continue
      ctx.drawables.push(
        new scope.Path.Line({ from: toPoint(piece[0]), to: toPoint(piece[1]), strokeColor: color, strokeWidth: 1.5, strokeCap: 'round' }),
      )
    }
  }

  return { drawVoronoi }
}
