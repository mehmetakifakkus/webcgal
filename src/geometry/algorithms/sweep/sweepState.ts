import type { IntersectionPoint, Overlap, Pt } from '../../types'
import type { EventQueue } from './eventQueue'
import type { StatusStructure } from './status'

/** One snapshot of the sweep (spec §3.2). */
export type SweepState = {
  phase: 'init' | 'event' | 'done'
  sweepY: number | null
  queue: { p: Pt; upper: number[] }[]
  status: number[]
  current?: Pt
  U?: number[]
  L?: number[]
  C?: number[]
  testing?: [number, number]
  newEvent?: Pt
  reported?: IntersectionPoint | Overlap
  points: IntersectionPoint[]
  overlaps: Overlap[]
}

/** Fields valid for a single recorded step only. */
export type SweepPatch = Partial<
  Pick<SweepState, 'current' | 'U' | 'L' | 'C' | 'testing' | 'newEvent' | 'reported'>
>

export type RecorderContext = {
  queue: EventQueue
  status: StatusStructure
  sweepY: number | null
  phase: SweepState['phase']
  /** Found so far (live arrays; copy before storing). */
  points: IntersectionPoint[]
  overlaps: Overlap[]
}

/** `line` indexes SEGMENT_INTERSECTION_PSEUDOCODE (Task 4). */
export type Recorder = (
  line: number,
  description: string,
  patch: SweepPatch,
  ctx: RecorderContext,
) => void
