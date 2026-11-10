import { triangulate as triangulateOf } from '../geometry/algorithms/triangulation/triangulate'
import type { Diagonal, Pt, Triangle, TriangulationResult, VertexType } from '../geometry/types'
import { toPoint, toPt, type EngineContext, type PointInput } from './drawing'
import { isPointInput } from './segments'

/** A polygon as user code passes it: an engine `Polygon` (its `points`) or an array of points. */
export type PolygonInput = { points: PointInput[] } | PointInput[]

/** Consecutive vertices must be at least this far apart (closer ones make the sweep's comparisons unreliable). */
export const MIN_VERTEX_DISTANCE = 1e-3

const describe = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)

/**
 * Validates user input (`fn` names the API function in the message) and converts it:
 * an engine Polygon (`points[i].pos`) or an array of TextPoints, paper Points, `{x, y}` or `[x, y]`.
 */
export function toPolygon(input: unknown, fn: string): Pt[] {
  const prefix = `${fn}: expected a Polygon or an array of points`
  const list =
    typeof input === 'object' && input !== null && !Array.isArray(input) && Array.isArray((input as { points?: unknown }).points)
      ? (input as { points: unknown[] }).points
      : input
  if (!Array.isArray(list)) throw new Error(`${prefix} (got ${describe(input)})`)
  const pts = list.map((p: unknown, i) => {
    if (!isPointInput(p)) throw new Error(`${prefix} (item ${i + 1} is not a point)`)
    return toPt(p)
  })
  const n = pts.length
  if (n >= 2)
    for (let i = 0; i < n; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % n]
      if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_VERTEX_DISTANCE) throw new Error(`${fn}: vertices must be at least 0.001 apart`)
    }
  return pts
}

/**
 * The geometry's triangulation with the API's messages (`fn` names the API function), and the
 * validated polygon. Rejects what `toPolygon` rejects, fewer than 3 vertices, a polygon that is
 * not simple and one too degenerate to triangulate.
 */
export function checkedTriangulation(input: unknown, fn: string): { polygon: Pt[]; result: TriangulationResult } {
  const polygon = toPolygon(input, fn)
  try {
    return { polygon, result: triangulateOf(polygon) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'polygon must be simple') throw new Error(`${fn}: the polygon must be simple (no crossing edges)`)
    if (msg === 'polygon needs at least 3 vertices') throw new Error(`${fn}: the polygon needs at least 3 vertices`)
    // anything else is the algorithm failing on near-coincident vertices
    throw new Error(`${fn}: the polygon is too degenerate to triangulate (vertices closer than about 0.001 apart)`)
  }
}

const run = (input: unknown, fn: string): TriangulationResult => checkedTriangulation(input, fn).result

/** Triangulates a simple polygon (either orientation); every index refers to the input order. */
export const triangulate = (input: PolygonInput): TriangulationResult => run(input, 'triangulate')

/**
 * MakeMonotone only: vertex types, the partition diagonals and the y-monotone pieces (input indices).
 * The first phase of the full run, which also maps a clockwise input back to its own indices.
 */
export function makeMonotone(input: PolygonInput): { types: VertexType[]; diagonals: Diagonal[]; pieces: number[][] } {
  const r = run(input, 'makeMonotone')
  return { types: r.types, diagonals: r.partitionDiagonals, pieces: r.pieces }
}

/** Index pairs / triples into the polygon, validated like the polygon itself. */
function indexTuples(list: unknown, size: number, n: number, fn: string, what: string): number[][] {
  const fail = (why: string): never => {
    throw new Error(`${fn}: ${what} must be an array of ${size === 2 ? '[i, j] pairs' : '[i, j, k] triples'} of vertex indices (${why})`)
  }
  if (!Array.isArray(list)) return fail(`got ${describe(list)}`)
  return list.map((t: unknown, i) => {
    if (!Array.isArray(t) || t.length !== size) fail(`item ${i + 1} is not a ${size === 2 ? 'pair' : 'triple'}`)
    const ok = (t as unknown[]).every((v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n)
    if (!ok) fail(`item ${i + 1} has an index outside 0…${n - 1}`)
    return t as number[]
  })
}

/** `drawDiagonals` and `drawTriangles` for one run. */
export function createTriangulationDrawing(ctx: EngineContext) {
  const { scope } = ctx
  const corners = (input: unknown, fn: string) => toPolygon(input, fn).map((p) => toPoint(p))

  /** Each diagonal [i, j] as a 2px line between vertices i and j. */
  function drawDiagonals(input: PolygonInput, diagonals: Diagonal[], color = 'red') {
    const pts = corners(input, 'drawDiagonals')
    for (const [a, b] of indexTuples(diagonals, 2, pts.length, 'drawDiagonals', 'diagonals'))
      ctx.drawables.push(new scope.Path.Line({ from: pts[a], to: pts[b], strokeColor: color, strokeWidth: 2, strokeCap: 'round' }))
  }

  /** Each triangle [i, j, k] lightly filled (alpha 0.12) with a 1px outline. */
  function drawTriangles(input: PolygonInput, triangles: Triangle[], color = 'blue') {
    const pts = corners(input, 'drawTriangles')
    for (const t of indexTuples(triangles, 3, pts.length, 'drawTriangles', 'triangles')) {
      const fill = new scope.Color(color)
      fill.alpha = 0.12
      const path = new scope.Path({ segments: t.map((i) => pts[i]), closed: true, fillColor: fill, strokeColor: color, strokeWidth: 1 })
      ctx.drawables.push(path)
    }
  }

  return { drawDiagonals, drawTriangles }
}
