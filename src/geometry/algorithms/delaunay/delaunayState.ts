import type { Pt } from '../../types'

// Step state of the Delaunay player (spec §3.2). Types only.

export type DelaunayState = {
  phase: 'init' | 'insert' | 'legalize' | 'cleanup' | 'done'
  p0: number
  /** Insertion order without p0. */
  order: number[]
  /** Inserted points, p0 included. */
  inserted: number[]
  /** Symbolic triangles included; after cleanup only the real ones. */
  triangles: { v: [number, number, number]; alive: boolean }[]
  current?: number
  located?: { t: [number, number, number]; edge?: [number, number] }
  testing?: { edge: [number, number]; opposite: number; legal: boolean }
  /** Only when all four vertices are real. */
  circle?: { center: Pt; radius: number }
  flipped?: { from: [number, number]; to: [number, number] }
  /** LegalizeEdge stack, top at the end. */
  stack: [number, number][]
  flips: number
}

/** Fields valid for a single recorded step only. */
export type DelPatch = Partial<Pick<DelaunayState, 'located' | 'testing' | 'circle' | 'flipped'>>

/** Everything except the patch fields; arrays may be live, copy before storing. */
export type DelRecorderContext = Pick<
  DelaunayState,
  'phase' | 'p0' | 'order' | 'inserted' | 'triangles' | 'stack' | 'flips' | 'current'
>

/** `line` indexes DELAUNAY_PSEUDOCODE (Task 4). */
export type DelRecorder = (line: number, description: string, patch: DelPatch, ctx: DelRecorderContext) => void
