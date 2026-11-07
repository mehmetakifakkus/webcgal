import type { Pt } from '../../types'
import type { Step } from '../../steps'
import { voronoi } from './voronoi'
import type { VoronoiState } from './voronoiState'

/**
 * Turns the recorder calls of `voronoi` into snapshots. Each state is
 * `{ ...ctx, ...patch, showDelaunay }`, deep-cloned; patch fields hold only what the
 * current record call passed.
 */
export function voronoiSteps(points: Pt[], showDelaunay = true): Step<VoronoiState>[] {
  const steps: Step<VoronoiState>[] = []
  voronoi(points, (line, description, patch, ctx) => {
    steps.push({ description, line, state: structuredClone({ ...ctx, ...patch, showDelaunay }) })
  })
  return steps
}
