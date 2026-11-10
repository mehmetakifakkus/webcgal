import type { Pt } from '../../types'
import type { Box } from '../voronoi/clip'
import type { KdNodeView, KdRecorder, KdRecorderContext } from './kdState'

export type KdLeaf = { kind: 'leaf'; id: number; depth: number; point: number; region: Box }
export type KdSplit = {
  kind: 'split'
  id: number
  depth: number
  axis: 'x' | 'y'
  value: number
  left: KdNode
  right: KdNode
  region: Box
  size: number
}
export type KdNode = KdLeaf | KdSplit
/** `nodes` = 2n − 1, `depth` = depth of the deepest leaf (0 for n ≤ 1). */
export type KdTree = { root: KdNode | null; nodes: number; depth: number; box: Box }

/** The player's plane box (spec §2.1). */
export const PLANE_BOX: Box = { x0: 15, y0: 15, x1: 455, y1: 345 }

export const label = (i: number) => `v${i + 1}`

export const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`

const fmt = (v: number) => v.toFixed(1)

export const copyBox = (b: Box): Box => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })
export const copyView = (v: KdNodeView): KdNodeView => ({ ...v, region: copyBox(v.region) })

/**
 * Composite-number order of the book (§5.2): by (x, y) on the x axis, by (y, x) on the
 * y axis, and by index for coincident points so that the order is total.
 */
export function compareOn(points: Pt[], axis: 'x' | 'y', a: number, b: number): number {
  const p = points[a]
  const q = points[b]
  const [p1, p2, q1, q2] = axis === 'x' ? [p.x, p.y, q.x, q.y] : [p.y, p.x, q.y, q.x]
  return p1 - q1 || p2 - q2 || a - b
}

/** The node views of a built tree in pre-order (= id order). */
export function kdNodeViews(tree: KdTree): KdNodeView[] {
  const out: KdNodeView[] = []
  const walk = (v: KdNode, parent: number | null, side: KdNodeView['side']) => {
    if (v.kind === 'leaf') {
      out.push({ id: v.id, parent, side, depth: v.depth, region: copyBox(v.region), point: v.point, size: 1 })
      return
    }
    out.push({ id: v.id, parent, side, depth: v.depth, region: copyBox(v.region), axis: v.axis, value: v.value, size: v.size })
    walk(v.left, v.id, 'left')
    walk(v.right, v.id, 'right')
  }
  if (tree.root) walk(tree.root, null, null)
  return out
}

/**
 * BuildKdTree of de Berg et al. §5.2. A single point gives a leaf; at even depth the points
 * are sorted by (x, y) and split into P₁ = the first ⌈n/2⌉ and P₂ = the rest, `value` being
 * the x of P₁'s last point; at odd depth the same with (y, x). The left child's region is the
 * part of the parent's region on or left of / below the line, the right child's the part on
 * or right of / above it. Ids are pre-order numbers. Regions only serve the range tests and
 * drawing; the points are assumed to lie in `box`.
 *
 * `record` receives one call per split (line 4 / 5), per leaf (line 2) and a final line 9.
 */
export function buildKdTree(points: Pt[], box: Box = PLANE_BOX, record?: KdRecorder): KdTree {
  const views: KdNodeView[] = []
  let nextId = 0
  let maxDepth = 0

  const emit = (line: number, description: string, current?: number) => {
    if (!record) return
    const ctx: KdRecorderContext = {
      phase: 'build',
      nodes: views.map(copyView),
      visited: [],
      reported: [],
      inside: [],
      pruned: [],
      counts: { visited: 0, inside: 0, pruned: 0 },
    }
    record(line, description, current === undefined ? {} : { current }, ctx)
  }

  const build = (P: number[], depth: number, region: Box, parent: number | null, side: KdNodeView['side']): KdNode => {
    const id = nextId++
    if (P.length === 1) {
      maxDepth = Math.max(maxDepth, depth)
      views.push({ id, parent, side, depth, region: copyBox(region), point: P[0], size: 1 })
      emit(2, `Leaf ${label(P[0])}`, id)
      return { kind: 'leaf', id, depth, point: P[0], region: copyBox(region) }
    }
    const axis = depth % 2 === 0 ? 'x' : 'y'
    const sorted = [...P].sort((a, b) => compareOn(points, axis, a, b))
    const half = Math.ceil(sorted.length / 2)
    const P1 = sorted.slice(0, half)
    const P2 = sorted.slice(half)
    const value = points[P1[P1.length - 1]][axis]
    views.push({ id, parent, side, depth, region: copyBox(region), axis, value, size: P.length })

    const names = P.length <= 10 ? [...P].sort((a, b) => a - b).map(label).join(', ') : `${P.length} points`
    // a tie across the line: by the other coordinate, or by number when the two points coincide
    const other = axis === 'x' ? 'y' : 'x'
    const [a, b] = [points[P1[P1.length - 1]], points[P2[0]]]
    const tie = b[axis] !== value ? '' : b[other] === a[other] ? ' — coincident points ordered by number' : ` — ties broken by ${other}`
    emit(
      axis === 'x' ? 4 : 5,
      `Split ${names} at ${axis} = ${fmt(value)} (median): ${P1.length} left, ${P2.length} right${tie}`,
      id,
    )

    const leftRegion = axis === 'x' ? { ...region, x1: value } : { ...region, y1: value }
    const rightRegion = axis === 'x' ? { ...region, x0: value } : { ...region, y0: value }
    const left = build(P1, depth + 1, leftRegion, id, 'left')
    const right = build(P2, depth + 1, rightRegion, id, 'right')
    return { kind: 'split', id, depth, axis, value, left, right, region: copyBox(region), size: P.length }
  }

  const n = points.length
  const root = n === 0 ? null : build(Array.from({ length: n }, (_, i) => i), 0, box, null, null)
  const tree: KdTree = { root, nodes: nextId, depth: maxDepth, box: copyBox(box) }
  emit(9, `kd-tree ready: ${plural(tree.nodes, 'node')}, depth ${tree.depth}`)
  return tree
}
