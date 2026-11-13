import type { Pt } from '../../types'
import type { Box } from '../voronoi/clip'
import { compareOn, plural } from '../kdtree/kdTree'
import { RT_LINE } from './pseudocode'
import type { RTNodeView, RTRecorder } from './rtState'

/**
 * A node of the leaf-based balanced binary search tree of de Berg et al. §5.1. A split node's
 * `value` is the largest key (the coordinate on the tree's axis) in its left subtree; `id` is
 * the pre-order number within its tree.
 */
export type Tree1DNode =
  | { kind: 'leaf'; id: number; point: number }
  | { kind: 'split'; id: number; value: number; left: Tree1DNode; right: Tree1DNode }

/** A 1-D tree on `axis`; `size` is its number of leaves. */
export type Tree1D = { axis: 'x' | 'y'; root: Tree1DNode | null; size: number }

/**
 * A main-tree node (on x) of the 2-D range tree of §5.3. Leaves have `point`, split nodes
 * `value`, `left` and `right`. `assoc` is the associated tree on y over the subtree's points,
 * `points` those points in x-composite order, `depth` the depth in the main tree. `label` is
 * `v#` (pre-order among split nodes, 1-based) for a split node and `p#` (1-based) for a leaf.
 */
export type RTNode = {
  id: number
  label: string
  kind: 'leaf' | 'split'
  point?: number
  value?: number
  left?: RTNode
  right?: RTNode
  assoc: Tree1D
  depth: number
  points: number[]
}

/**
 * `nodes` are the main-tree nodes in pre-order (`nodes[i].id === i`), `depth` the depth of the
 * deepest leaf (0 for n ≤ 1), `storage` the total number of leaves of all associated trees.
 */
export type RangeTree = { root: RTNode | null; nodes: RTNode[]; depth: number; storage: number }

export const pointLabel = (i: number) => `p${i + 1}`

/** The plane area of the player's canvas (spec §4.1), y-up. */
export const RT_PLANE: Box = { x0: 15, y0: 15, x1: 355, y1: 465 }

/** A coordinate for step texts: at most two decimals, none for integers. */
export const fmt = (v: number) => String(Math.round(v * 100) / 100)

/** `plural` of the kd-tree page, with an irregular plural if given: `count(2, 'leaf', 'leaves')` = "2 leaves". */
export const count = (k: number, one: string, many?: string) => (many === undefined || k === 1 ? plural(k, one) : `${k} ${many}`)

/** The main-tree nodes of `tree` as the player draws them, in pre-order; arrays are copies. */
export function rtNodeViews(tree: RangeTree): RTNodeView[] {
  const parent = new Array<number | null>(tree.nodes.length).fill(null)
  for (const v of tree.nodes) if (v.kind === 'split') parent[v.left!.id] = parent[v.right!.id] = v.id
  return tree.nodes.map((v) => {
    const view: RTNodeView = { id: v.id, label: v.label, kind: v.kind, parent: parent[v.id], depth: v.depth, points: [...v.points] }
    if (v.kind === 'split') view.value = v.value
    else view.point = v.point
    return view
  })
}

const copyViews = (views: RTNodeView[]) => views.map((v) => ({ ...v, points: [...v.points] }))

/**
 * Builds the balanced tree on `points[indices]`, sorted by the composite order on `axis`
 * (`compareOn`), so the input order is irrelevant. Of m points the left subtree gets ⌈m/2⌉.
 */
export function buildTree1D(points: Pt[], indices: number[], axis: 'x' | 'y'): Tree1D {
  const sorted = [...indices].sort((a, b) => compareOn(points, axis, a, b))
  let nextId = 0
  const build = (lo: number, hi: number): Tree1DNode => {
    const id = nextId++
    if (hi - lo === 1) return { kind: 'leaf', id, point: sorted[lo] }
    const mid = lo + Math.ceil((hi - lo) / 2)
    const value = points[sorted[mid - 1]][axis]
    const left = build(lo, mid)
    const right = build(mid, hi)
    return { kind: 'split', id, value, left, right }
  }
  return { axis, root: sorted.length ? build(0, sorted.length) : null, size: sorted.length }
}

/**
 * Build2DRangeTree of de Berg et al. §5.3: the main tree is the balanced tree of §5.1 on the
 * x-composite order, and every node (leaves included) gets an associated tree on y over the
 * points of its subtree. Ids are pre-order numbers.
 *
 * `record` gets one call per main node in pre-order once the tree is complete (so every state
 * carries the whole shape, `builtUpTo` saying how much of it exists): line 3 for a split node,
 * line 2 for a leaf; the last call's description ends with the totals. It does not change the result.
 */
export function rangeTree(points: Pt[], record?: RTRecorder): RangeTree {
  const nodes: RTNode[] = []
  let splits = 0
  let maxDepth = 0
  let storage = 0

  const build = (P: number[], depth: number): RTNode => {
    const id = nodes.length
    const assoc = buildTree1D(points, P, 'y')
    storage += assoc.size
    if (P.length === 1) {
      maxDepth = Math.max(maxDepth, depth)
      const leaf: RTNode = { id, label: pointLabel(P[0]), kind: 'leaf', point: P[0], assoc, depth, points: [...P] }
      nodes.push(leaf)
      return leaf
    }
    const half = Math.ceil(P.length / 2)
    const v: RTNode = {
      id,
      label: `v${++splits}`,
      kind: 'split',
      value: points[P[half - 1]].x,
      assoc,
      depth,
      points: [...P],
    }
    nodes.push(v)
    v.left = build(P.slice(0, half), depth + 1)
    v.right = build(P.slice(half), depth + 1)
    return v
  }

  const sorted = points.map((_, i) => i).sort((a, b) => compareOn(points, 'x', a, b))
  const root = sorted.length ? build(sorted, 0) : null
  const tree: RangeTree = { root, nodes, depth: maxDepth, storage }
  if (record) recordBuild(points, tree, record)
  return tree
}

function buildText(points: Pt[], v: RTNode): string {
  if (v.kind === 'leaf') return `Leaf ${v.label}: associated tree with ${count(v.assoc.size, 'leaf', 'leaves')}`
  const l = v.left!.points
  const r = v.right!.points
  const [a, b] = [points[l[l.length - 1]], points[r[0]]]
  // a tie across the split: by y, or by number when the two points coincide (composite order)
  const tie = b.x !== v.value ? '' : b.y === a.y ? ' — coincident points ordered by number' : ' — ties broken by y'
  return (
    `Node ${v.label}: ${count(v.points.length, 'point')}, associated tree on y with ${count(v.assoc.size, 'leaf', 'leaves')}; ` +
    `split at x = ${fmt(v.value!)} (${l.length} left, ${r.length} right)${tie}`
  )
}

/** The build steps of `rangeTree`, one per main node in pre-order. */
function recordBuild(points: Pt[], tree: RangeTree, record: RTRecorder) {
  const views = rtNodeViews(tree)
  let storage = 0
  let depth = 0
  tree.nodes.forEach((v, k) => {
    storage += v.assoc.size
    depth = Math.max(depth, v.depth)
    const last = k === tree.nodes.length - 1
    const totals = last ? ` · main tree ${count(tree.nodes.length, 'node')}, associated trees ${count(tree.storage, 'leaf', 'leaves')}` : ''
    record(v.kind === 'leaf' ? RT_LINE.leaf : RT_LINE.split, buildText(points, v) + totals, { current: v.id }, {
      phase: 'build',
      nodes: copyViews(views),
      current: null,
      assocShown: v.id,
      assocPaths: null,
      pathLo: [],
      pathHi: [],
      split: null,
      canonical: [],
      reported: [],
      checked: [],
      builtUpTo: k + 1,
      counts: { nodes: k + 1, storage, depth, assocQueries: 0 },
    })
  })
}
