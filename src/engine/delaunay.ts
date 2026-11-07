import paper from 'paper'
import { delaunay as delaunayOf } from '../geometry/algorithms/delaunay/delaunay'
import { circumcenter, distance } from '../geometry/primitives'
import type { Pt, Triangle } from '../geometry/types'
import { toPoint, toPt, type EngineContext, type PointInput } from './drawing'
import { isPointInput } from './segments'

/** What `delaunay` returns: every index refers to the input array. */
export type ApiDelaunayResult = {
  triangles: Triangle[]
  edges: [number, number][]
  /** Convex hull vertices, counter-clockwise. */
  hull: number[]
}

const describe = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)

/**
 * Validates user input (`fn` names the API function in the message) and converts it:
 * an array of TextPoints (e.g. from `Points.createRandom`), paper Points, `{x, y}` or `[x, y]`.
 */
export function toPoints(input: unknown, fn: string): Pt[] {
  const prefix = `${fn}: expected an array of points`
  if (!Array.isArray(input)) throw new Error(`${prefix} (got ${describe(input)})`)
  return input.map((p: unknown, i) => {
    if (!isPointInput(p)) throw new Error(`${prefix} (item ${i + 1} is not a point)`)
    return toPt(p)
  })
}

/** Delaunay triangulation of a point set (random incremental, de Berg et al. §9.3). */
export function delaunay(input: PointInput[]): ApiDelaunayResult {
  const points = toPoints(input, 'delaunay')
  try {
    const { triangles, edges, hull } = delaunayOf(points)
    return { triangles, edges, hull }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'points must be distinct') throw new Error('delaunay: points must be distinct')
    throw e
  }
}

/** The circle through a, b and c as `{ center, radius }` (centre a paper Point); null when they are collinear. */
export function circumcircle(a: PointInput, b: PointInput, c: PointInput): { center: paper.Point; radius: number } | null {
  const [p, q, r] = [a, b, c].map((x, i) => {
    if (!isPointInput(x)) throw new Error(`circumcircle: argument ${i + 1} is not a point`)
    return toPt(x)
  })
  const center = circumcenter(p, q, r)
  return center ? { center: new paper.Point(center.x, center.y), radius: distance(center, p) } : null
}

/** `drawTriangulation` for one run. */
export function createDelaunayDrawing(ctx: EngineContext) {
  const { scope } = ctx

  /** Lightly filled triangles (alpha 0.08) under 1.5px edges, from a `delaunay(points)` result. */
  function drawTriangulation(input: PointInput[], result: ApiDelaunayResult, color = 'black') {
    const pts = toPoints(input, 'drawTriangulation').map((p) => toPoint(p))
    const n = pts.length
    const valid = (t: unknown, size: number) =>
      Array.isArray(t) && t.length === size && t.every((v) => Number.isInteger(v) && v >= 0 && v < n)
    const { triangles, edges } = (result ?? {}) as Partial<ApiDelaunayResult>
    if (!Array.isArray(triangles) || !Array.isArray(edges) || !triangles.every((t) => valid(t, 3)) || !edges.every((e) => valid(e, 2)))
      throw new Error('drawTriangulation: expected the result of delaunay(points) for the same points')
    for (const t of triangles) {
      const fill = new scope.Color(color)
      fill.alpha = 0.08
      ctx.drawables.push(new scope.Path({ segments: t.map((i) => pts[i]), closed: true, fillColor: fill }))
    }
    for (const [a, b] of edges)
      ctx.drawables.push(new scope.Path.Line({ from: pts[a], to: pts[b], strokeColor: color, strokeWidth: 1.5, strokeCap: 'round' }))
  }

  return { drawTriangulation }
}
