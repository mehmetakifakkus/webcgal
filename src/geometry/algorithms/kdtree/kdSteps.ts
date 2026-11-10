import type { Step } from '../../steps'
import type { KdInput } from '../../types'
import type { KdRecorder, KdState } from './kdState'
import { PLANE_BOX, buildKdTree } from './kdTree'
import { searchKdTree } from './search'

export type KdMode = 'full' | 'build' | 'query'

/**
 * Turns the recorder calls of `buildKdTree` and `searchKdTree` into snapshots. Each state is
 * `{ ...ctx, ...patch }`, deep-cloned; the patch fields (`current`, `test`, `newlyReported`)
 * hold only what the current record call passed.
 *
 * `full` = all build steps (ending with the line-9 "kd-tree ready" step) followed by the query
 * steps; `build` = build steps only; `query` = one first step on line 9 showing the complete
 * tree, followed by the query steps. With no points there is a single "done" step.
 */
export function kdSteps(input: KdInput, mode: KdMode = 'full'): Step<KdState>[] {
  const { points, query } = input
  const build: Step<KdState>[] = []
  const search: Step<KdState>[] = []
  const rec = (into: Step<KdState>[]): KdRecorder => (line, description, patch, ctx) => {
    into.push({ description, line, state: structuredClone({ ...ctx, ...patch }) })
  }

  if (points.length === 0) {
    return [
      {
        description: 'No points: nothing to build or search',
        line: 20,
        state: { phase: 'done', nodes: [], visited: [], reported: [], inside: [], pruned: [], counts: { visited: 0, inside: 0, pruned: 0 } },
      },
    ]
  }

  const tree = buildKdTree(points, PLANE_BOX, rec(build))
  searchKdTree(points, tree, query, rec(search))

  if (mode === 'build') return build
  if (mode === 'query') {
    return [build[build.length - 1], ...search]
  }
  return [...build, ...search]
}
