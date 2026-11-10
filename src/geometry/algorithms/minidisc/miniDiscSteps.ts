import type { Pt } from '../../types'
import type { Step } from '../../steps'
import { minidisc } from './minidisc'
import type { MiniDiscState } from './miniDiscState'

/**
 * Turns the recorder calls of `minidisc` into snapshots. Each state is `{ ...ctx, ...patch }`,
 * deep-cloned; the patch fields (`current`, `testing`, `newDisk`, `returned`) hold only what the
 * current record call passed.
 */
export function miniDiscSteps(points: Pt[], order?: number[]): Step<MiniDiscState>[] {
  const steps: Step<MiniDiscState>[] = []
  minidisc(points, order, (line, description, patch, ctx) => {
    steps.push({ description, line, state: structuredClone({ ...ctx, ...patch }) })
  })
  return steps
}
