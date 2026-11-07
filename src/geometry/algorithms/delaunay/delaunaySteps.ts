import type { Pt } from '../../types'
import type { Step } from '../../steps'
import { delaunay } from './delaunay'
import type { DelaunayState } from './delaunayState'

/**
 * Turns the recorder calls of `delaunay` into snapshots. Each state is
 * `{ ...ctx, ...patch }`, deep-cloned. Patch fields (`located`, `testing`,
 * `circle`, `flipped`) hold only what the current record call passed;
 * `current` comes from the recorder context and stays set for all steps of the
 * same inserted point (cleared at cleanup).
 */
export function delaunaySteps(points: Pt[], order?: number[]): Step<DelaunayState>[] {
  const steps: Step<DelaunayState>[] = []
  delaunay(points, order, (line, description, patch, ctx) => {
    steps.push({ description, line, state: structuredClone({ ...ctx, ...patch }) })
  })
  return steps
}
