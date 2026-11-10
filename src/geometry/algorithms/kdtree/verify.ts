import type { Pt } from '../../types'
import type { Box } from '../voronoi/clip'
import { compareOn, label, type KdNode, type KdTree } from './kdTree'
import { inRect } from './search'

type Check = { ok: boolean; reason?: string }

const within = (a: Box, b: Box) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1
const fmtBox = (b: Box) => `[${b.x0}, ${b.x1}] × [${b.y0}, ${b.y1}]`

function* walk(v: KdNode | null): Generator<KdNode> {
  if (!v) return
  yield v
  if (v.kind === 'split') {
    yield* walk(v.left)
    yield* walk(v.right)
  }
}

function leafPoints(v: KdNode, out: number[] = []): number[] {
  if (v.kind === 'leaf') out.push(v.point)
  else {
    leafPoints(v.left, out)
    leafPoints(v.right, out)
  }
  return out
}

/**
 * Checks a tree from `buildKdTree(points)` (spec §2.3), in this order: every point is stored
 * in exactly one leaf ("leaf"); at every split node the left side lies on or before the line,
 * the right side after it in composite order, and `value` is the largest coordinate of the
 * left side ("side"); every region lies in its parent's and every leaf's point in its region
 * ("region"); depths, sizes and the node count match; the height is ⌈log₂ n⌉ ("height").
 */
export function checkKdTree(points: Pt[], tree: KdTree): Check {
  const n = points.length
  if (n === 0) return tree.root ? { ok: false, reason: 'a tree without points must have no root (no leaf)' } : { ok: true }
  if (!tree.root) return { ok: false, reason: `no root: ${n} point${n === 1 ? '' : 's'} but no leaf` }

  const count = new Array<number>(n).fill(0)
  let leaves = 0
  for (const v of walk(tree.root)) {
    if (v.kind !== 'leaf') continue
    leaves++
    if (!Number.isInteger(v.point) || v.point < 0 || v.point >= n)
      return { ok: false, reason: `leaf ${v.id} stores an invalid point index ${v.point}` }
    count[v.point]++
  }
  for (let i = 0; i < n; i++)
    if (count[i] !== 1) return { ok: false, reason: `${label(i)} is stored in ${count[i]} leaves, expected exactly one leaf` }
  if (leaves !== n) return { ok: false, reason: `${leaves} leaves for ${n} points` }

  for (const v of walk(tree.root)) {
    if (v.kind !== 'split') continue
    const { axis, value } = v
    const L = leafPoints(v.left)
    const Rt = leafPoints(v.right)
    if (L.length === 0 || Rt.length === 0) return { ok: false, reason: `node ${v.id} has an empty side` }
    const wrong =
      L.find((i) => points[i][axis] > value) ?? Rt.find((i) => points[i][axis] < value)
    if (wrong !== undefined)
      return { ok: false, reason: `node ${v.id}: ${label(wrong)} lies on the wrong side of ${axis} = ${value}` }
    const maxL = L.reduce((a, b) => (compareOn(points, axis, a, b) >= 0 ? a : b))
    const minR = Rt.reduce((a, b) => (compareOn(points, axis, a, b) <= 0 ? a : b))
    if (compareOn(points, axis, maxL, minR) >= 0)
      return { ok: false, reason: `node ${v.id}: ${label(minR)} lies on the wrong side of ${label(maxL)} in composite order` }
    if (points[maxL][axis] !== value)
      return { ok: false, reason: `node ${v.id}: split value ${value} is not the largest ${axis} of its left side` }
  }

  for (const v of walk(tree.root)) {
    if (v.kind === 'leaf') {
      if (!inRect(points[v.point], v.region))
        return { ok: false, reason: `${label(v.point)} lies outside the region ${fmtBox(v.region)} of its leaf` }
      continue
    }
    for (const c of [v.left, v.right])
      if (!within(c.region, v.region))
        return { ok: false, reason: `the region of node ${c.id} is not inside the region of node ${v.id}` }
  }

  let maxDepth = 0
  const depths = (v: KdNode, depth: number): Check => {
    if (v.depth !== depth) return { ok: false, reason: `node ${v.id} has depth ${v.depth}, expected ${depth} (height)` }
    if (v.kind === 'leaf') {
      maxDepth = Math.max(maxDepth, depth)
      return { ok: true }
    }
    const size = leafPoints(v).length
    if (v.size !== size) return { ok: false, reason: `node ${v.id} has size ${v.size}, expected ${size}` }
    const l = depths(v.left, depth + 1)
    return l.ok ? depths(v.right, depth + 1) : l
  }
  const d = depths(tree.root, 0)
  if (!d.ok) return d
  const expected = Math.ceil(Math.log2(n))
  if (maxDepth !== expected) return { ok: false, reason: `height ${maxDepth}, expected ⌈log₂ ${n}⌉ = ${expected}` }
  if (tree.depth !== maxDepth) return { ok: false, reason: `tree.depth ${tree.depth} differs from the height ${maxDepth}` }
  if (tree.nodes !== 2 * n - 1) return { ok: false, reason: `${tree.nodes} nodes, expected ${2 * n - 1}` }
  return { ok: true }
}

/** Indices of the points in the closed rectangle R, ascending. */
export function bruteForceRange(points: Pt[], R: Box): number[] {
  const out: number[] = []
  for (let i = 0; i < points.length; i++) if (inRect(points[i], R)) out.push(i)
  return out
}
