import type { Step } from '../../steps'
import type { RangeTreeInput } from '../../types'
import { rangeTree } from './rangeTree'
import type { RTMode, RTRecorder, RTState } from './rtState'
import { rangeQuery2D } from './search'

/**
 * Turns the recorder calls of `rangeTree` and `rangeQuery2D` into snapshots. Each state is
 * `{ mode, points, query, ...ctx, ...patch }`, deep-cloned, so no two steps share data.
 *
 * `build` = one step per main node in pre-order (2n − 1); `query` = the query steps on the
 * complete tree, from the split node to "Done"; `full` = the build steps followed by the query
 * steps, exactly. With no points there are no build steps and a single "Done" query step.
 */
export function rtSteps(input: RangeTreeInput, mode: RTMode = 'full'): Step<RTState>[] {
  const { points, query } = input
  const build: Step<RTState>[] = []
  const search: Step<RTState>[] = []
  const rec = (into: Step<RTState>[]): RTRecorder => (line, description, patch, ctx) => {
    into.push({ description, line, state: structuredClone({ mode, points, query, ...ctx, ...patch }) })
  }
  const tree = rangeTree(points, mode === 'query' ? undefined : rec(build))
  if (mode === 'build') return build
  rangeQuery2D(points, tree, query, rec(search))
  return mode === 'query' ? search : [...build, ...search]
}
