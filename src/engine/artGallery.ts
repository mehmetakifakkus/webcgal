import paper from 'paper'
import { fisk } from '../geometry/algorithms/artGallery/fisk'
import type { Colour } from '../geometry/algorithms/artGallery/galleryState'
import { visibilityPolygon as visibilityOf } from '../geometry/algorithms/artGallery/visibility'
import type { Pt } from '../geometry/types'
import { toPoint, type EngineContext } from './drawing'
import { checkedTriangulation, type PolygonInput } from './triangulation'

/**
 * What `artGallery` returns (frozen, all the way down). Every index refers to the input
 * polygon: `cameras` are the vertices of the smallest colour class, ascending; `colors[i]` is
 * the colour (0, 1 or 2) of vertex i; `triangles` is the triangulation the colouring follows.
 */
export type ApiArtGallery = {
  readonly cameras: readonly number[]
  readonly colors: readonly Colour[]
  readonly triangles: readonly (readonly [number, number, number])[]
}

/** Side of a camera square, in scene units (as in the player). */
const CAMERA_SIZE = 10
/** Fill alpha of the visibility regions. */
const VIEW_ALPHA = 0.2

/**
 * The polygon checked like the triangulation API's input (`toPolygon`, at least 3 vertices,
 * simple, not too degenerate to triangulate): the visibility polygons rely on it.
 */
const checkedPolygon = (input: unknown, fn: string): Pt[] => checkedTriangulation(input, fn).polygon

/**
 * Fisk's guard set (de Berg et al. §3.1): triangulate, 3-colour the vertices along the dual
 * tree, keep the smallest colour class; at most ⌊n/3⌋ cameras that see the whole polygon.
 * Either orientation; every index refers to the input.
 */
export function artGallery(input: PolygonInput): ApiArtGallery {
  // the validation triangulates once and fisk triangulates again, deliberately: the second run
  // costs next to nothing, and passing the first one in would change fisk's signature
  const polygon = checkedPolygon(input, 'artGallery')
  let r: ReturnType<typeof fisk>
  try {
    r = fisk(polygon)
  } catch {
    throw new Error('artGallery: the polygon is too degenerate to triangulate (vertices closer than about 0.001 apart)')
  }
  return Object.freeze({
    cameras: Object.freeze([...r.cameras]),
    colors: Object.freeze([...r.colors]),
    triangles: Object.freeze(r.triangles.map((t) => Object.freeze([t[0], t[1], t[2]] as [number, number, number]))),
  })
}

/** Vertex index `v` (0-based) of a polygon of `n` vertices, or the API's error. */
function vertexIndex(v: unknown, n: number, fn: string): number {
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) >= n) throw new Error(`${fn}: vertex index out of range`)
  return v as number
}

/**
 * The region a camera at vertex `v` (0-based, input order) sees: a counter-clockwise polygon
 * starting at that vertex, as a frozen array of new paper Points.
 */
export function visibilityPolygon(input: PolygonInput, v: number): readonly paper.Point[] {
  const polygon = checkedPolygon(input, 'visibilityPolygon')
  const k = vertexIndex(v, polygon.length, 'visibilityPolygon')
  return Object.freeze(visibilityOf(polygon, k).map((p) => new paper.Point(p.x, p.y)))
}

/**
 * The cameras of an `artGallery(polygon)` result, or of any `{ cameras }` with distinct vertex
 * indices of the polygon (a result's `colors`, when present, must have one entry per vertex).
 */
function camerasOf(result: unknown, n: number, fn: string): number[] {
  const fail = (): never => {
    throw new Error(`${fn}: expected the result of artGallery(polygon) for the same polygon`)
  }
  const r = result as { cameras?: unknown; colors?: unknown } | null
  if (typeof r !== 'object' || r === null || !Array.isArray(r.cameras)) fail()
  const cameras = r!.cameras as unknown[]
  if (!cameras.every((c) => Number.isInteger(c) && (c as number) >= 0 && (c as number) < n)) fail()
  if (new Set(cameras).size !== cameras.length) fail()
  if (r!.colors !== undefined && (!Array.isArray(r!.colors) || r!.colors.length !== n)) fail()
  return cameras as number[]
}

/** `drawArtGallery` for one run. */
export function createArtGalleryDrawing(ctx: EngineContext) {
  const { scope } = ctx

  /**
   * What the cameras see: per camera its visibility region, filled in `color` at alpha 0.2,
   * then per camera a 10×10 square in `color` on its vertex. Adds 2 drawables per camera
   * (all the regions first, then all the squares, in the order of `result.cameras`).
   */
  function drawArtGallery(input: PolygonInput, result: ApiArtGallery | { cameras: number[] }, color = 'black') {
    const polygon = checkedPolygon(input, 'drawArtGallery')
    const cameras = camerasOf(result, polygon.length, 'drawArtGallery')
    for (const c of cameras) {
      const fill = new scope.Color(color)
      fill.alpha = VIEW_ALPHA
      const segments = visibilityOf(polygon, c).map((p) => toPoint(p))
      ctx.drawables.push(new scope.Path({ segments, closed: true, fillColor: fill }))
    }
    for (const c of cameras)
      ctx.drawables.push(
        new scope.Path.Rectangle({ center: toPoint(polygon[c]), size: [CAMERA_SIZE, CAMERA_SIZE], fillColor: color }),
      )
  }

  return { drawArtGallery }
}
