import type { Pt } from '../../types'
import { compareOn } from '../kdtree/kdTree'

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
 */
export function rangeTree(points: Pt[]): RangeTree {
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
  return { root, nodes, depth: maxDepth, storage }
}
