import type { Diagonal, Polygon } from '../../types'
import type { Step } from '../../steps'
import { lexicographicOrder, vertexTypes } from './polygon'
import { runTriangulation } from './triangulate'
import type { TriangulationMode, TriangulationState } from './triangulationState'

/**
 * Turns the recorder calls of `runTriangulation` into snapshots. Vertex
 * indices in the steps refer to the CCW polygon (`ensureCCW` is applied here;
 * the player keeps its inputs CCW, so they equal the input indices).
 *
 * Each state is `{ ...ctx, phase, sweepY, ...patch }`, deep-cloned. Patch
 * fields (`edgeLeft`, `reported`) hold only what the current record call
 * passed. Exceptions: `current` stays set for all records of the same vertex
 * (cleared outside the partition phase), `cursor` for the records of the same
 * u_j (cleared by the piece/merge/stack-init steps and at 'done'), and
 * `activePiece` for its whole piece (comes from the recorder context).
 */
export function triangulationSteps(input: Polygon, mode: TriangulationMode = 'full'): Step<TriangulationState>[] {
  // Throws on invalid input (via runTriangulation). Work on the CCW polygon so
  // the result below is in the same indices as the recorded steps.
  const polygon = runTriangulation(input, undefined, mode).polygon
  const steps: Step<TriangulationState>[] = []
  const n = polygon.length
  const types = vertexTypes(polygon)
  const count = (t: string) => types.filter((x) => x === t).length
  let current: number | undefined
  let cursor: number | undefined

  // The first step needs the partition, which is only known after the run:
  // run once to get the result, then once more to record.
  const { result } = runTriangulation(polygon, undefined, mode)
  const nPart = result.partitionDiagonals.length
  const nTri = result.triangulationDiagonals.length
  const partDiags = result.partitionDiagonals.map((d) => [...d] as Diagonal)
  const pieces = result.pieces.map((p) => [...p])

  const base = (): TriangulationState => ({
    phase: 'init',
    types: [...types],
    sweepY: null,
    queue: [],
    status: [],
    partitionDiagonals: [],
    pieces: [],
    stack: [],
    triangulationDiagonals: [],
  })
  const push = (line: number, description: string, state: TriangulationState) =>
    steps.push({ description, line, state: structuredClone(state) })

  if (mode === 'triangulate') {
    push(
      30,
      `Partition into monotone pieces (not shown in this mode): ${nPart} diagonals, ${pieces.length} pieces`,
      { ...base(), partitionDiagonals: partDiags, pieces },
    )
  } else {
    push(
      1,
      `Classify the vertices: ${count('start')} start, ${count('end')} end, ${count('split')} split, ${count('merge')} merge, ${count('regular')} regular`,
      { ...base(), queue: lexicographicOrder(polygon) },
    )
  }

  runTriangulation(
    polygon,
    (line, description, patch, ctx) => {
      if (patch.current !== undefined) current = patch.current
      else if (ctx.phase !== 'partition') current = undefined
      if (patch.cursor !== undefined) cursor = patch.cursor
      else if (line <= 31) cursor = undefined
      const state: TriangulationState = { ...ctx, ...patch }
      if (current !== undefined) state.current = current
      else delete state.current
      if (cursor !== undefined) state.cursor = cursor
      else delete state.cursor
      for (const k of ['activePiece', 'merged', 'chain', 'edgeLeft', 'reported'] as const) {
        if (state[k] === undefined) delete state[k]
      }
      push(line, description, state)
    },
    mode,
  )

  const done: TriangulationState = {
    ...base(),
    phase: 'done',
    partitionDiagonals: partDiags,
    pieces,
    triangulationDiagonals: mode === 'partition' ? [] : result.triangulationDiagonals.map((d) => [...d] as Diagonal),
  }
  if (mode === 'partition') push(3, `Done: ${nPart} diagonals, ${pieces.length} monotone pieces`, done)
  else push(40, `Done: ${nPart + nTri} diagonals, ${n - 2} triangles`, done)
  return steps
}
