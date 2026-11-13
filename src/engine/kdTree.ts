import { buildKdTree, type KdNode, type KdTree } from '../geometry/algorithms/kdtree/kdTree'
import { searchKdTree } from '../geometry/algorithms/kdtree/search'
import type { Box } from '../geometry/algorithms/voronoi/clip'
import type { Pt } from '../geometry/types'
import { toPoint, toPt, type EngineContext, type PointInput } from './drawing'
import { toPoints } from './toPoints'
import { isPointInput } from './segments'

/** A node of `kdTree(points)`: a split node on a vertical (`x`) or horizontal (`y`) line, or a leaf. */
export type ApiKdNode =
  | { readonly axis: 'x' | 'y'; readonly value: number; readonly left: ApiKdNode; readonly right: ApiKdNode }
  | { readonly point: number }

/**
 * What `kdTree` returns (frozen). `point` is an index into the input array; `size` is the number
 * of points, `depth` the depth of the deepest leaf (0 for one point; `root` is null for none).
 */
export type ApiKdTree = { readonly root: ApiKdNode | null; readonly depth: number; readonly size: number }

/** A rectangle as user code passes it: `{x0, y0, x1, y1}` or two opposite corners `[p, q]`. */
export type RectInput = { x0: number; y0: number; x1: number; y1: number } | [PointInput, PointInput]

/** Margin around the points' bounding box, the root region of `rangeQuery` and `drawKdTree`. */
const MARGIN = 10

function toApi(v: KdNode): ApiKdNode {
  return Object.freeze(
    v.kind === 'leaf' ? { point: v.point } : { axis: v.axis, value: v.value, left: toApi(v.left), right: toApi(v.right) },
  )
}

/** kd-tree of a point set by alternating median splits, x first (de Berg et al. §5.2). */
export function kdTree(input: PointInput[]): ApiKdTree {
  const points = toPoints(input, 'kdTree')
  const tree = buildKdTree(points)
  return Object.freeze({ root: tree.root && toApi(tree.root), depth: tree.depth, size: points.length })
}

/** The points' bounding box with a 10-unit margin (the root region of `rangeQuery`, `drawKdTree` and `drawRangeTree`). */
export function boundingBox(points: Pt[]): Box {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    x0: Math.min(...xs) - MARGIN,
    y0: Math.min(...ys) - MARGIN,
    x1: Math.max(...xs) + MARGIN,
    y1: Math.max(...ys) + MARGIN,
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Checks a `kdTree(points)` result against `points` and converts it back to a geometry tree
 * with regions (the root region is the points' bounding box with a 10-unit margin). Every point
 * must be in exactly one leaf and lie on the side of each split line its leaf is on (on the line
 * counts for both sides), so the regions contain their points.
 */
function toTree(tree: unknown, points: Pt[], fn: string): KdTree {
  const fail = (): never => {
    throw new Error(`${fn}: expected the result of kdTree(points) for the same points`)
  }
  const t = tree as Partial<ApiKdTree> | null
  if (typeof t !== 'object' || t === null || t.size !== points.length || !isNum(t.depth)) fail()
  const n = points.length
  if (n === 0) {
    if (t!.root !== null) fail()
    return { root: null, nodes: 0, depth: 0, box: { x0: 0, y0: 0, x1: 0, y1: 0 } }
  }
  const seen = new Array<boolean>(n).fill(false)
  let nextId = 0
  let maxDepth = 0
  const convert = (v: unknown, depth: number, region: Box): { node: KdNode; min: Pt; max: Pt } => {
    if (typeof v !== 'object' || v === null || depth > n) fail()
    const id = nextId++
    const o = v as Record<string, unknown>
    if ('point' in o) {
      const i = o.point
      if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= n || seen[i as number]) fail()
      seen[i as number] = true
      maxDepth = Math.max(maxDepth, depth)
      const p = points[i as number]
      return { node: { kind: 'leaf', id, depth, point: i as number, region }, min: p, max: p }
    }
    const { axis, value } = o
    if ((axis !== 'x' && axis !== 'y') || !isNum(value)) fail()
    const a = axis as 'x' | 'y'
    const leftRegion = a === 'x' ? { ...region, x1: value as number } : { ...region, y1: value as number }
    const rightRegion = a === 'x' ? { ...region, x0: value as number } : { ...region, y0: value as number }
    const l = convert(o.left, depth + 1, leftRegion)
    const r = convert(o.right, depth + 1, rightRegion)
    if (l.max[a] > (value as number) || r.min[a] < (value as number)) fail()
    const size = (l.node.kind === 'leaf' ? 1 : l.node.size) + (r.node.kind === 'leaf' ? 1 : r.node.size)
    return {
      node: { kind: 'split', id, depth, axis: a, value: value as number, left: l.node, right: r.node, region, size },
      min: { x: Math.min(l.min.x, r.min.x), y: Math.min(l.min.y, r.min.y) },
      max: { x: Math.max(l.max.x, r.max.x), y: Math.max(l.max.y, r.max.y) },
    }
  }
  const box = boundingBox(points)
  const { node } = convert(t!.root, 0, box)
  if (!seen.every(Boolean) || t!.depth !== maxDepth) fail()
  return { root: node, nodes: nextId, depth: maxDepth, box }
}

/** `{x0, y0, x1, y1}` or `[p, q]`, normalized so that x0 ≤ x1 and y0 ≤ y1. */
export function toRect(rect: unknown, fn: string): Box {
  let a: Pt
  let b: Pt
  const r = rect as Record<string, unknown> | null
  if (Array.isArray(rect) && rect.length === 2 && rect.every(isPointInput)) [a, b] = rect.map(toPt)
  else if (typeof r === 'object' && r !== null && [r.x0, r.y0, r.x1, r.y1].every(isNum)) {
    a = { x: r.x0 as number, y: r.y0 as number }
    b = { x: r.x1 as number, y: r.y1 as number }
  } else throw new Error(`${fn}: expected a rectangle {x0, y0, x1, y1} or two points`)
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }
}

/** Indices (ascending) of the points in the closed rectangle, found with SearchKdTree. */
export function rangeQuery(input: PointInput[], tree: ApiKdTree, rect: RectInput): number[] {
  const points = toPoints(input, 'rangeQuery')
  const t = toTree(tree, points, 'rangeQuery')
  return searchKdTree(points, t, toRect(rect, 'rangeQuery')).reported
}

/** `drawKdTree` for one run. */
export function createKdTreeDrawing(ctx: EngineContext) {
  const { scope } = ctx

  /**
   * The split lines of a `kdTree(points)` result, 1px, each clipped to its node's region; the
   * root region is the points' bounding box with a 10-unit margin. One line per split node.
   */
  function drawKdTree(input: PointInput[], tree: ApiKdTree, color = 'black') {
    const points = toPoints(input, 'drawKdTree')
    const t = toTree(tree, points, 'drawKdTree')
    const draw = (v: KdNode) => {
      if (v.kind === 'leaf') return
      const r = v.region
      const [from, to] =
        v.axis === 'x' ? [{ x: v.value, y: r.y0 }, { x: v.value, y: r.y1 }] : [{ x: r.x0, y: v.value }, { x: r.x1, y: v.value }]
      ctx.drawables.push(new scope.Path.Line({ from: toPoint(from), to: toPoint(to), strokeColor: color, strokeWidth: 1 }))
      draw(v.left)
      draw(v.right)
    }
    if (t.root) draw(t.root)
  }

  return { drawKdTree }
}
