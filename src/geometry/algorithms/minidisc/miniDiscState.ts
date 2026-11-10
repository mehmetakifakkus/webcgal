import type { Circle } from '../../types'

// Step state of the MiniDisc player (spec §3.2). Types only.

/** One active call of MiniDisc, MiniDiscWithPoint or MiniDiscWith2Points. */
export type Frame = {
  proc: 'MiniDisc' | 'WithPoint' | 'With2Points'
  /** [] | [q] | [q1, q2] (q2 = new point, q1 = the outer call's q). */
  fixed: number[]
  /** This call's P: order[0..prefix). */
  prefix: number
  /**
   * Position in `order` the loop is at. Before the loop starts it is the last position the
   * initial disc covers: 1 for MiniDisc (D₂), 0 for WithPoint (D₁), −1 for With2Points (D₀),
   * so index + 1 is always the subscript of the frame's current disc.
   */
  index: number
  disk: Circle
}

export type MiniDiscState = {
  phase: 'init' | 'run' | 'done'
  order: number[]
  /** Outer → inner. */
  stack: Frame[]
  /** Disc of the innermost call. */
  disk: Circle | null
  current?: number
  testing?: { point: number; inside: boolean }
  newDisk?: Circle
  returned?: Circle
  tests: number
  updates: number
}

/** Fields valid for a single recorded step only. */
export type MdPatch = Partial<Pick<MiniDiscState, 'current' | 'testing' | 'newDisk' | 'returned'>>

/** Everything except the patch fields; `stack` and `disk` are copies, `order` is shared. */
export type MdRecorderContext = Pick<MiniDiscState, 'phase' | 'order' | 'stack' | 'disk' | 'tests' | 'updates'>

/** `line` indexes the MiniDisc pseudocode of spec §3.1. */
export type MdRecorder = (line: number, description: string, patch: MdPatch, ctx: MdRecorderContext) => void
