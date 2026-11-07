import type { Diagonal, VertexType } from '../../types'

// Step state of the polygon triangulation player (spec §3.2). Types only.

export type TriangulationMode = 'full' | 'partition' | 'triangulate'

export type TriangulationState = {
  phase: 'init' | 'partition' | 'triangulate' | 'done'
  types: VertexType[]
  sweepY: number | null
  /** Vertices still to be processed (lexicographic order). */
  queue: number[]
  /** Edges in T, left to right, with their helpers. */
  status: { edge: number; helper: number }[]
  current?: number
  edgeLeft?: number
  partitionDiagonals: Diagonal[]
  pieces: number[][]
  activePiece?: number
  merged?: number[]
  chain?: ('left' | 'right')[]
  /** u_j (vertex index). */
  cursor?: number
  stack: number[]
  triangulationDiagonals: Diagonal[]
  reported?: Diagonal
}

/** Fields valid for a single recorded step only. */
export type TriPatch = Partial<Pick<TriangulationState, 'current' | 'edgeLeft' | 'cursor' | 'reported'>>

/** Everything except the patch fields; arrays may be live, copy before storing. */
export type TriRecorderContext = Pick<
  TriangulationState,
  | 'phase'
  | 'sweepY'
  | 'queue'
  | 'status'
  | 'partitionDiagonals'
  | 'pieces'
  | 'activePiece'
  | 'merged'
  | 'chain'
  | 'stack'
  | 'triangulationDiagonals'
  | 'types'
>

/** `line` indexes TRIANGULATION_PSEUDOCODE (Task 4). */
export type TriRecorder = (
  line: number,
  description: string,
  patch: TriPatch,
  ctx: TriRecorderContext,
) => void
