import type { Box } from '../voronoi/clip'

// Step state of the kd-tree player (spec §3.2). Types only.

/** A node of the kd-tree as the player draws it; ids are pre-order numbers. */
export type KdNodeView = {
  id: number
  parent: number | null
  side: 'left' | 'right' | null
  depth: number
  region: Box
  /** Split nodes only. */
  axis?: 'x' | 'y'
  value?: number
  /** Leaves only: index of the stored point. */
  point?: number
  /** Number of points in the subtree (1 for a leaf). */
  size: number
}

export type KdState = {
  phase: 'build' | 'query' | 'done'
  /** The nodes created so far, in id (pre-order) order. */
  nodes: KdNodeView[]
  /** Active node id. */
  current?: number
  test?: { child: number; relation: 'inside' | 'intersects' | 'disjoint' }
  /** Node ids SearchKdTree was called on. */
  visited: number[]
  /** Reported point indices, ascending. */
  reported: number[]
  /** Node ids of subtrees reported whole (ReportSubtree). */
  inside: number[]
  /** Node ids of skipped subtrees. */
  pruned: number[]
  newlyReported?: number[]
  counts: { visited: number; inside: number; pruned: number }
}

/** Fields valid for a single recorded step only. */
export type KdPatch = Partial<Pick<KdState, 'current' | 'test' | 'newlyReported'>>

/** Everything except the patch fields; all arrays and node views are copies. */
export type KdRecorderContext = Omit<KdState, 'current' | 'test' | 'newlyReported'>

/** `line` indexes the kd-tree pseudocode of spec §3.1. */
export type KdRecorder = (line: number, description: string, patch: KdPatch, ctx: KdRecorderContext) => void
