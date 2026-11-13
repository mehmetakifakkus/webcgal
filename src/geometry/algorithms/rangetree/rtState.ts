import type { Pt } from '../../types'
import type { Box } from '../voronoi/clip'
import type { AssocQuery } from './search'

// Step state of the range-tree player (spec §3.2). Types only.

export type RTMode = 'full' | 'build' | 'query'

/** A main-tree node as the player draws it; `id` is the pre-order number (`nodes[id]`). */
export type RTNodeView = {
  id: number
  /** `v#` for a split node, `p#` for a leaf. */
  label: string
  kind: 'leaf' | 'split'
  parent: number | null
  depth: number
  /** The subtree's point indices in x-composite order. */
  points: number[]
  /** Split nodes only: the largest x of the left subtree. */
  value?: number
  /** Leaves only: the stored point index. */
  point?: number
}

/** The 1-D query on y in the associated tree of the canonical subtree `node` (ids in that tree). */
export type RTAssocPaths = AssocQuery

export type RTState = {
  phase: 'build' | 'query'
  mode: RTMode
  points: Pt[]
  /** The closed query rectangle. */
  query: Box
  /** All main-tree nodes in pre-order; in the build phase only the first `builtUpTo` exist yet. */
  nodes: RTNodeView[]
  /** The node this step is about, null on the done step. */
  current: number | null
  /** The main-tree node whose associated tree is drawn, or null. */
  assocShown: number | null
  /** The search paths and reported nodes in `assocShown`'s associated tree, once it has been queried. */
  assocPaths: RTAssocPaths | null
  /** Main-tree ids of the search path to x so far (from the root, through the split node). */
  pathLo: number[]
  /** Main-tree ids of the search path to x′ so far (from the root, through the split node). */
  pathHi: number[]
  split: number | null
  /** Canonical subtrees found so far, in the order they are found. */
  canonical: number[]
  /** Reported point indices so far, ascending. */
  reported: number[]
  /** Point indices tested one by one (the end leaves) so far. */
  checked: number[]
  /** Number of main-tree nodes built (all of them in the query phase). */
  builtUpTo: number
  /** Build phase: of the nodes built so far; query phase: of the whole tree, and the associated queries so far. */
  counts: { nodes: number; storage: number; depth: number; assocQueries: number }
}

/** Fields valid for a single recorded step only. */
export type RTPatch = Partial<Pick<RTState, 'current'>>

/** What the recorders know; `rtSteps` adds `mode`, `points` and `query`. All arrays are copies. */
export type RTRecorderContext = Omit<RTState, 'mode' | 'points' | 'query'>

/** `line` indexes `RT_PSEUDOCODE`. */
export type RTRecorder = (line: number, description: string, patch: RTPatch, ctx: RTRecorderContext) => void
