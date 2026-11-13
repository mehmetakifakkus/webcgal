import {
  pointLabel,
  rangeTree as buildRangeTree,
  type RangeTree,
  type RTNode,
  type Tree1D,
  type Tree1DNode,
} from '../geometry/algorithms/rangetree/rangeTree'
import { rangeQuery2D } from '../geometry/algorithms/rangetree/search'
import { checkRangeTree } from '../geometry/algorithms/rangetree/verify'
import type { Box } from '../geometry/algorithms/voronoi/clip'
import type { Pt } from '../geometry/types'
import { toPoint, type EngineContext, type PointInput } from './drawing'
import { boundingBox, toRect, type RectInput } from './kdTree'
import { toPoints } from './toPoints'

/**
 * A node of an associated tree (on y): a split node whose `value` is the largest y in its left
 * subtree, or a leaf with the index of its point in the input array.
 */
export type ApiRangeTree1DNode =
  | { readonly value: number; readonly left: ApiRangeTree1DNode; readonly right: ApiRangeTree1DNode }
  | { readonly point: number }

/**
 * A node of the main tree (on x) of `rangeTree(points)`: a split node whose `value` is the largest
 * x in its left subtree, or a leaf with the index of its point. `assoc` is the root of the node's
 * associated tree on y over the points below it.
 */
export type ApiRangeTreeNode =
  | {
      readonly value: number
      readonly left: ApiRangeTreeNode
      readonly right: ApiRangeTreeNode
      readonly assoc: ApiRangeTree1DNode
    }
  | { readonly point: number; readonly assoc: ApiRangeTree1DNode }

/**
 * What `rangeTree` returns (deeply frozen). `size` is the number of points, `depth` the depth of
 * the deepest main-tree leaf (0 for one point; `root` is null for none), `storage` the number of
 * leaves of all associated trees together.
 */
export type ApiRangeTree = {
  readonly root: ApiRangeTreeNode | null
  readonly depth: number
  readonly size: number
  readonly storage: number
}

function assocToApi(v: Tree1DNode): ApiRangeTree1DNode {
  return Object.freeze(v.kind === 'leaf' ? { point: v.point } : { value: v.value, left: assocToApi(v.left), right: assocToApi(v.right) })
}

function toApi(v: RTNode): ApiRangeTreeNode {
  const assoc = assocToApi(v.assoc.root!)
  return Object.freeze(
    v.kind === 'leaf' ? { point: v.point!, assoc } : { value: v.value!, left: toApi(v.left!), right: toApi(v.right!), assoc },
  )
}

/** 2-D range tree of a point set: a balanced tree on x with an associated tree on y at every node (de Berg et al. §5.3). */
export function rangeTree(input: PointInput[]): ApiRangeTree {
  const points = toPoints(input, 'rangeTree')
  const tree = buildRangeTree(points)
  return Object.freeze({ root: tree.root && toApi(tree.root), depth: tree.depth, size: points.length, storage: tree.storage })
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Checks a `rangeTree(points)` result against `points` and converts it back to a geometry tree.
 * Every node is type-checked first (objects, finite numbers, point indices, an `assoc` at every
 * main-tree node, at most 2m − 1 nodes and depth at most ⌈log2 m⌉ in a tree of m points, as in a
 * balanced tree, so a hand-made, cyclic or deep object fails cleanly instead of overflowing the
 * stack); then `checkRangeTree` verifies, without rebuilding the tree, that every point
 * is in exactly one leaf and in each associated tree on its root path, and the order, balance,
 * split values, `depth` and `storage`.
 */
function toTree(tree: unknown, points: Pt[], fn: string): RangeTree {
  const fail = (): never => {
    throw new Error(`${fn}: expected the result of rangeTree(points) for the same points`)
  }
  const n = points.length
  if (!isObject(tree) || tree.size !== n || !Number.isInteger(tree.depth) || !Number.isInteger(tree.storage)) fail()
  const t = tree as Record<string, unknown>
  const isIndex = (i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < n
  /** The depth of a balanced tree of `m` leaves, ⌈log2 m⌉ (0 for m ≤ 1). */
  const maxDepth = (m: number) => {
    let d = 0
    while (2 ** d < m) d++
    return d
  }

  /** An associated tree over `m` points: at most 2m − 1 nodes and depth ⌈log2 m⌉, ids in pre-order. */
  const assoc = (root: unknown, m: number): Tree1D => {
    let nextId = 0
    let size = 0
    const deepest = maxDepth(m)
    const convert = (v: unknown, depth: number): Tree1DNode => {
      if (!isObject(v) || nextId >= 2 * m - 1 || depth > deepest) return fail()
      const id = nextId++
      if ('point' in v) {
        if (!isIndex(v.point)) fail()
        size++
        return { kind: 'leaf', id, point: v.point as number }
      }
      if (!isNum(v.value)) fail()
      const left = convert(v.left, depth + 1)
      const right = convert(v.right, depth + 1)
      return { kind: 'split', id, value: v.value as number, left, right }
    }
    const r = convert(root, 0)
    return { axis: 'y', root: r, size }
  }

  const nodes: RTNode[] = []
  let splits = 0
  const deepest = maxDepth(n)
  const convert = (v: unknown, depth: number): RTNode => {
    if (!isObject(v) || nodes.length >= 2 * n - 1 || depth > deepest) return fail()
    const node = { id: nodes.length, depth } as RTNode
    nodes.push(node)
    if ('point' in v) {
      if (!isIndex(v.point)) fail()
      Object.assign(node, { label: pointLabel(v.point as number), kind: 'leaf', point: v.point, points: [v.point] })
    } else {
      if (!isNum(v.value)) fail()
      Object.assign(node, { label: `v${++splits}`, kind: 'split', value: v.value })
      node.left = convert(v.left, depth + 1)
      node.right = convert(v.right, depth + 1)
      node.points = [...node.left.points, ...node.right.points]
    }
    node.assoc = assoc(v.assoc, node.points.length)
    return node
  }
  if (t.root !== null && n === 0) fail()
  const root = t.root === null ? null : convert(t.root, 0)
  const result: RangeTree = { root, nodes, depth: t.depth as number, storage: t.storage as number }
  if (!checkRangeTree(points, result).ok) fail()
  return result
}

/** `toRect` of the kd-tree API, which also rejects non-finite corners (e.g. a paper Point with NaN). */
function toFiniteRect(rect: unknown, fn: string): Box {
  const r = toRect(rect, fn)
  if (![r.x0, r.y0, r.x1, r.y1].every(Number.isFinite)) throw new Error(`${fn}: expected a rectangle {x0, y0, x1, y1} or two points`)
  return r
}

/** Indices (ascending) of the points in the closed rectangle, found with 2DRangeQuery (§5.3). */
export function rangeTreeQuery(input: PointInput[], tree: ApiRangeTree, rect: RectInput): number[] {
  const points = toPoints(input, 'rangeTreeQuery')
  const t = toTree(tree, points, 'rangeTreeQuery')
  return rangeQuery2D(points, t, toFiniteRect(rect, 'rangeTreeQuery')).reported
}

/** `drawRangeTree` for one run. */
export function createRangeTreeDrawing(ctx: EngineContext) {
  const { scope } = ctx

  /**
   * The split lines of the main tree of a `rangeTree(points)` result, 1px, in pre-order: one
   * vertical line x = value per split node. A range tree splits on x only, so each line crosses
   * the whole slab of its node; in y it is clipped to the points' bounding box with a 10-unit
   * margin, as the root region of `drawKdTree`.
   */
  function drawRangeTree(input: PointInput[], tree: ApiRangeTree, color = 'black') {
    const points = toPoints(input, 'drawRangeTree')
    const t = toTree(tree, points, 'drawRangeTree')
    if (!t.root) return
    const { y0, y1 } = boundingBox(points)
    for (const v of t.nodes)
      if (v.kind === 'split')
        ctx.drawables.push(
          new scope.Path.Line({
            from: toPoint({ x: v.value!, y: y0 }),
            to: toPoint({ x: v.value!, y: y1 }),
            strokeColor: color,
            strokeWidth: 1,
          }),
        )
  }

  return { drawRangeTree }
}
