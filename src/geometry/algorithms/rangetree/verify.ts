import type { Pt } from '../../types'
import { compareOn } from '../kdtree/kdTree'
import { pointLabel, type RangeTree, type RTNode, type Tree1D, type Tree1DNode } from './rangeTree'

type Check = { ok: true } | { ok: false; reason: string }

const OK: Check = { ok: true }
const fail = (reason: string): Check => ({ ok: false, reason })

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Checks a 1-D tree against the points `indices` it should hold: `size` and the leaves (in
 * composite order on `tree.axis`, each index once), pre-order ids, balance (the left subtree
 * gets ⌈m/2⌉ of m leaves) and every `value` being the key of the left subtree's last leaf.
 */
export function checkTree1D(points: Pt[], tree: Tree1D, indices: number[]): Check {
  const { axis } = tree
  const expected = [...indices].sort((a, b) => compareOn(points, axis, a, b))
  if (tree.size !== expected.length) return fail(`size ${tree.size}, expected ${expected.length}`)
  if (!tree.root) return expected.length ? fail(`no root for ${expected.length} points`) : OK
  let pre = 0
  const found: number[] = []
  const walk = (v: Tree1DNode): Check & { size?: number } => {
    if (v.id !== pre++) return fail(`node ${v.id} is not numbered in pre-order (expected ${pre - 1})`)
    if (v.kind === 'leaf') {
      found.push(v.point)
      return { ok: true, size: 1 }
    }
    const l = walk(v.left)
    if (!l.ok) return l
    const last = found[found.length - 1]
    const r = walk(v.right)
    if (!r.ok) return r
    const m = l.size! + r.size!
    if (l.size !== Math.ceil(m / 2)) return fail(`node ${v.id}: left subtree has ${l.size} of ${m} leaves, expected ${Math.ceil(m / 2)}`)
    if (points[last]?.[axis] !== v.value) return fail(`node ${v.id}: value ${v.value} is not the largest ${axis} of its left subtree`)
    return { ok: true, size: m }
  }
  const w = walk(tree.root)
  if (!w.ok) return w
  if (!sameList(found, expected))
    return fail(`the leaves [${found.map(pointLabel)}] differ from the ${axis}-composite order [${expected.map(pointLabel)}]`)
  return OK
}

/**
 * Checks a tree from `rangeTree(points)` (spec §2.3): every point in exactly one main leaf and
 * the leaves in x-composite order; pre-order ids and `nodes`; labels; depths and `depth`; balance
 * and `value` (as in `checkTree1D`); `points` of every node; every `assoc` a valid y-tree over
 * exactly its subtree's points; and `storage` = the total number of associated leaves.
 */
export function checkRangeTree(points: Pt[], tree: RangeTree): Check {
  const n = points.length
  if (!tree.root) {
    if (n) return fail(`no root for ${n} points`)
    if (tree.nodes.length || tree.depth || tree.storage) return fail('an empty tree must have no nodes, depth 0 and storage 0')
    return OK
  }
  const order: RTNode[] = []
  let splits = 0
  let maxDepth = 0
  let storage = 0
  const walk = (v: RTNode, depth: number): Check & { leaves?: number[] } => {
    if (v.id !== order.length) return fail(`node ${v.id} is not numbered in pre-order (expected ${order.length})`)
    order.push(v)
    if (v.depth !== depth) return fail(`node ${v.id} has depth ${v.depth}, expected ${depth}`)
    let leaves: number[]
    if (v.kind === 'leaf') {
      if (!Number.isInteger(v.point) || v.point! < 0 || v.point! >= n) return fail(`leaf ${v.id} stores an invalid point index ${v.point}`)
      if (v.label !== pointLabel(v.point!)) return fail(`leaf ${v.id} is labelled ${v.label}, expected ${pointLabel(v.point!)}`)
      if (v.left || v.right) return fail(`leaf ${v.id} has children`)
      maxDepth = Math.max(maxDepth, depth)
      leaves = [v.point!]
    } else {
      if (!v.left || !v.right) return fail(`split node ${v.id} lacks a child`)
      if (v.label !== `v${++splits}`) return fail(`split node ${v.id} is labelled ${v.label}, expected v${splits}`)
      const l = walk(v.left, depth + 1)
      if (!l.ok) return l
      const r = walk(v.right, depth + 1)
      if (!r.ok) return r
      const m = l.leaves!.length + r.leaves!.length
      if (l.leaves!.length !== Math.ceil(m / 2))
        return fail(`node ${v.id}: left subtree has ${l.leaves!.length} of ${m} leaves, expected ${Math.ceil(m / 2)}`)
      const last = l.leaves![l.leaves!.length - 1]
      if (points[last].x !== v.value) return fail(`node ${v.id}: value ${v.value} is not the largest x of its left subtree`)
      leaves = [...l.leaves!, ...r.leaves!]
    }
    if (!sameList(v.points, leaves)) return fail(`node ${v.id}: points [${v.points}] differ from its leaves [${leaves}]`)
    if (v.assoc.axis !== 'y') return fail(`the associated tree of node ${v.id} is on ${v.assoc.axis}, expected y`)
    const a = checkTree1D(points, v.assoc, leaves)
    if (!a.ok) return fail(`associated tree of node ${v.id}: ${a.reason}`)
    storage += v.assoc.size
    return { ok: true, leaves }
  }
  const w = walk(tree.root, 0)
  if (!w.ok) return w

  const count = new Array<number>(n).fill(0)
  for (const i of w.leaves!) count[i]++
  for (let i = 0; i < n; i++) if (count[i] !== 1) return fail(`${pointLabel(i)} is stored in ${count[i]} leaves, expected exactly one`)
  const sorted = w.leaves!.slice().sort((a, b) => compareOn(points, 'x', a, b))
  if (!sameList(w.leaves!, sorted)) return fail('the main-tree leaves are not in x-composite order')

  if (tree.nodes.length !== order.length || tree.nodes.some((v, i) => v !== order[i]))
    return fail('nodes does not list the main-tree nodes in pre-order')
  if (tree.depth !== maxDepth) return fail(`depth ${tree.depth}, expected ${maxDepth}`)
  if (tree.storage !== storage) return fail(`storage ${tree.storage}, expected ${storage} associated leaves`)
  return OK
}
