import type { Segment } from '../../types'
import type { Step } from '../../steps'
import { runSweep } from './findIntersections'
import type { SweepState } from './sweepState'

/**
 * Turns the recorder calls of `runSweep` into snapshots. Each state is
 * `{ phase, sweepY, queue, status, points, overlaps, ...patch }`, deep-cloned.
 * Patch fields (`U`, `L`, `C`, `testing`, `newEvent`, `reported`) hold only what
 * the current record call passed; nothing is carried over from the previous
 * step. The one exception is `current`: it stays set for every record of the
 * same event (lines 7–22) and is cleared at the next line-4 record (replaced)
 * and at the final 'done' step.
 */
export function findIntersectionsSteps(segments: Segment[]): Step<SweepState>[] {
  const steps: Step<SweepState>[] = []
  let current: SweepState['current']
  runSweep(segments, (line, description, patch, ctx) => {
    if (patch.current) current = patch.current
    else if (ctx.phase !== 'event') current = undefined
    const state: SweepState = {
      phase: ctx.phase,
      sweepY: ctx.sweepY,
      queue: ctx.queue.toArray(),
      status: ctx.status.toArray(),
      points: ctx.points,
      overlaps: ctx.overlaps,
      ...patch,
    }
    if (current) state.current = current
    steps.push({ description, line, state: structuredClone(state) })
  })
  return steps
}
