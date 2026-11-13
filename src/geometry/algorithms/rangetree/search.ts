import type { Pt } from '../../types'
import type { Box } from '../voronoi/clip'
import { inRect } from '../kdtree/search'
import type { RangeTree, RTNode, Tree1D, Tree1DNode } from './rangeTree'

/*
 * Composite bounds (§5.5). The trees are ordered by composite keys, which are all distinct, and
 * a split node stands for the largest key of its left subtree. A query bound lo is the composite
 * (lo, −∞) and hi is (hi, +∞), so neither ever equals a key and the closed interval [lo : hi]
 * contains every point whose coordinate lies in it, ties included. Against a node whose largest
 * left key has coordinate `value` this gives, in plain numbers:
 *   (lo, −∞) ≤ key  ⟺  lo ≤ value        (the path to lo goes left)
 *   (hi, +∞) ≤ key  ⟺  hi < value        (the path to hi goes left)
 * The helpers below are the only place where these comparisons are made.
 */
const loGoesLeft = (lo: number, value: number) => lo <= value
const hiGoesLeft = (hi: number, value: number) => hi < value

export type OneDResult = {
  /** Id of the split node, null for an empty tree or an empty interval. */
  split: number | null
  /** Node ids from the root to the leaf where the search for lo ends (through the split node). */
  pathLo: number[]
  /** Node ids from the root to the leaf where the search for hi ends (through the split node). */
  pathHi: number[]
  /** Ids of the subtrees reported whole: right children off the lo path, then left children off the hi path. */
  reported: number[]
  /** Point indices of the end leaves tested one by one (the split leaf alone if the split node is a leaf). */
  checkedLeaves: number[]
  /** Point indices in [lo : hi], ascending. */
  result: number[]
}

export type RangeQuery2DResult = {
  /** Main-tree id of the split node on x, null for an empty tree or an empty x-range. */
  split: number | null
  /** Main-tree ids from the root to the leaf where the search for x0 ends. */
  pathLo: number[]
  /** Main-tree ids from the root to the leaf where the search for x1 ends. */
  pathHi: number[]
  /** Main-tree ids of the canonical subtrees, in the order they are found. */
  canonical: number[]
  /** One 1DRangeQuery on y per canonical subtree, in the same order; `result` ascending. */
  assocQueries: { node: number; result: number[] }[]
  /** Point indices of the end leaves tested against the whole rectangle. */
  checkedLeaves: number[]
  /** Point indices in the closed rectangle, ascending. */
  reported: number[]
}

const ascending = (a: number, b: number) => a - b

function leaves(v: Tree1DNode, out: number[]): number[] {
  if (v.kind === 'leaf') out.push(v.point)
  else {
    leaves(v.left, out)
    leaves(v.right, out)
  }
  return out
}

/**
 * Walks from `root` while the searches for lo and hi agree (FindSplitNode, §5.1) and returns
 * the path, ending at the split node. Shared by the 1-D and the main-tree search.
 */
function findSplit<N>(root: N, inner: (v: N) => { value: number; left: N; right: N } | null, lo: number, hi: number): N[] {
  const path = [root]
  for (let s = inner(root); s; s = inner(path[path.length - 1])) {
    if (hiGoesLeft(hi, s.value)) path.push(s.left)
    else if (!loGoesLeft(lo, s.value)) path.push(s.right)
    else break
  }
  return path
}

/**
 * 1DRangeQuery of de Berg et al. §5.1 on the leaf-based tree `tree`, comparing with the
 * composite key on `tree.axis` (see the note above). Below the split node the path to lo
 * reports the right child wherever it goes left, the path to hi the left child wherever it
 * goes right, and the two end leaves are checked directly.
 */
export function oneDRangeQuery(points: Pt[], tree: Tree1D, lo: number, hi: number): OneDResult {
  const empty: OneDResult = { split: null, pathLo: [], pathHi: [], reported: [], checkedLeaves: [], result: [] }
  if (!tree.root || lo > hi) return empty
  const axis = tree.axis
  const toSplit = findSplit(tree.root, (v) => (v.kind === 'split' ? v : null), lo, hi)
  const split = toSplit[toSplit.length - 1]

  const reported: Tree1DNode[] = []
  const checked: number[] = []
  const pathLo = toSplit.map((v) => v.id)
  const pathHi = [...pathLo]
  if (split.kind === 'leaf') checked.push(split.point)
  else {
    // the path to lo
    let v: Tree1DNode = split.left
    pathLo.push(v.id)
    while (v.kind === 'split') {
      if (loGoesLeft(lo, v.value)) {
        reported.push(v.right)
        v = v.left
      } else v = v.right
      pathLo.push(v.id)
    }
    checked.push(v.point)
    // the path to hi
    v = split.right
    pathHi.push(v.id)
    while (v.kind === 'split') {
      if (!hiGoesLeft(hi, v.value)) {
        reported.push(v.left)
        v = v.right
      } else v = v.left
      pathHi.push(v.id)
    }
    checked.push(v.point)
  }

  const result = reported.flatMap((v) => leaves(v, []))
  for (const i of checked) if (points[i][axis] >= lo && points[i][axis] <= hi) result.push(i)
  return { split: split.id, pathLo, pathHi, reported: reported.map((v) => v.id), checkedLeaves: checked, result: result.sort(ascending) }
}

/**
 * 2DRangeQuery of de Berg et al. §5.3 on a tree from `rangeTree(points)` and the closed
 * rectangle R: find the split node on x; on the path to x0 run a 1-D query on y in the
 * associated tree of the right child wherever the path goes left (a canonical subtree), on the
 * path to x1 likewise for the left child wherever it goes right; check the two end leaves
 * against R. All decisions on x use the composite bounds of `oneDRangeQuery`.
 */
export function rangeQuery2D(points: Pt[], tree: RangeTree, R: Box): RangeQuery2DResult {
  const out: RangeQuery2DResult = {
    split: null, pathLo: [], pathHi: [], canonical: [], assocQueries: [], checkedLeaves: [], reported: [],
  }
  if (!tree.root || R.x0 > R.x1) return out
  const inner = (v: RTNode) => (v.kind === 'split' ? { value: v.value!, left: v.left!, right: v.right! } : null)
  const toSplit = findSplit(tree.root, inner, R.x0, R.x1)
  const split = toSplit[toSplit.length - 1]
  out.split = split.id
  out.pathLo = toSplit.map((v) => v.id)
  out.pathHi = [...out.pathLo]

  const canonical = (c: RTNode) => {
    out.canonical.push(c.id)
    out.assocQueries.push({ node: c.id, result: oneDRangeQuery(points, c.assoc, R.y0, R.y1).result })
  }
  const check = (v: RTNode) => out.checkedLeaves.push(v.point!)

  if (split.kind === 'leaf') check(split)
  else {
    let v = split.left!
    out.pathLo.push(v.id)
    while (v.kind === 'split') {
      if (loGoesLeft(R.x0, v.value!)) {
        canonical(v.right!)
        v = v.left!
      } else v = v.right!
      out.pathLo.push(v.id)
    }
    check(v)
    v = split.right!
    out.pathHi.push(v.id)
    while (v.kind === 'split') {
      if (!hiGoesLeft(R.x1, v.value!)) {
        canonical(v.left!)
        v = v.right!
      } else v = v.left!
      out.pathHi.push(v.id)
    }
    check(v)
  }

  const reported = out.assocQueries.flatMap((q) => q.result)
  for (const i of out.checkedLeaves) if (inRect(points[i], R)) reported.push(i)
  out.reported = reported.sort(ascending)
  return out
}
