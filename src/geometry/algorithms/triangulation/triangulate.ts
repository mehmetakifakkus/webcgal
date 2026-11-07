import type { Diagonal, Polygon, Triangle, TriangulationResult } from '../../types'
import { makeMonotone } from './makeMonotone'
import { ensureCCW, isSimple } from './polygon'
import { splitByDiagonals } from './split'
import { triangulateMonotone } from './triangulateMonotone'
import type { TriangulationMode, TriRecorder } from './triangulationState'

// Polygon triangulation (de Berg §3.2–3.3): MakeMonotone, split into
// y-monotone pieces, TriangulateMonotonePolygon on each piece.

const v = (i: number) => `v${i + 1}`
const sortDiagonal = (a: number, b: number): Diagonal => (a < b ? [a, b] : [b, a])

/**
 * Shared path of `triangulate` and the step generator (Task 4). Throws on
 * invalid input. Records in the indices of `polygon` (the CCW polygon used);
 * `result` is in the indices of the input. `mode` only selects what is
 * recorded: 'partition' → MakeMonotone lines (1–28), 'triangulate' →
 * TriangulateMonotonePolygon lines (30–40), 'full' → both. Before each piece
 * a line-30 step "Triangulate piece k of m: …" is recorded.
 */
export function runTriangulation(
  input: Polygon,
  record?: TriRecorder,
  mode: TriangulationMode = 'full',
): { result: TriangulationResult; polygon: Polygon; reversed: boolean } {
  if (input.length < 3) throw new Error('polygon needs at least 3 vertices')
  if (!isSimple(input)) throw new Error('polygon must be simple')
  const { polygon, reversed } = ensureCCW(input)
  const n = polygon.length

  const { diagonals: partitionDiagonals, types } = makeMonotone(polygon, mode === 'triangulate' ? undefined : record)
  const pieces = splitByDiagonals(polygon, partitionDiagonals)

  const triangulationDiagonals: Diagonal[] = []
  const triRecord = mode === 'partition' ? undefined : record
  pieces.forEach((piece, k) => {
    const wrap: TriRecorder | undefined = triRecord
      ? (line, description, patch, ctx) =>
          triRecord(line, description, patch, {
            ...ctx,
            pieces: pieces.map((p) => [...p]),
            activePiece: k,
            partitionDiagonals: partitionDiagonals.map((d) => [...d] as Diagonal),
            types: [...types],
            triangulationDiagonals: [...triangulationDiagonals.map((d) => [...d] as Diagonal), ...ctx.triangulationDiagonals],
          })
      : undefined
    wrap?.(30, `Triangulate piece ${k + 1} of ${pieces.length}: ${piece.map(v).join(' ')}`, {}, {
      phase: 'triangulate',
      sweepY: null,
      queue: [],
      status: [],
      partitionDiagonals: [],
      pieces: [],
      stack: [],
      triangulationDiagonals: [],
      types: [],
    })
    triangulationDiagonals.push(...triangulateMonotone(polygon, piece, wrap))
  })

  const triangles = splitByDiagonals(polygon, [...partitionDiagonals, ...triangulationDiagonals]).map((t) => {
    if (t.length !== 3) throw new Error(`internal error: piece with ${t.length} vertices after triangulation`)
    return t as Triangle
  })

  const result: TriangulationResult = { types, partitionDiagonals, pieces, triangulationDiagonals, triangles }
  return { result: reversed ? mapBack(result, n) : result, polygon, reversed }
}

/** Maps a result on the reversed (CCW) polygon back to the input indices (i → n−1−i). */
function mapBack(r: TriangulationResult, n: number): TriangulationResult {
  const f = (i: number) => n - 1 - i
  const diag = (d: Diagonal) => sortDiagonal(f(d[0]), f(d[1]))
  // Mapping keeps the geometric (CCW) order; rotate so the smallest index is first.
  const cyc = (p: number[]) => {
    const q = p.map(f)
    const k = q.indexOf(Math.min(...q))
    return [...q.slice(k), ...q.slice(0, k)]
  }
  const byFirst = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
    return a.length - b.length
  }
  return {
    types: r.types.map((_, i) => r.types[f(i)]),
    partitionDiagonals: r.partitionDiagonals.map(diag),
    pieces: r.pieces.map(cyc).sort(byFirst),
    triangulationDiagonals: r.triangulationDiagonals.map(diag),
    triangles: r.triangles.map((t) => cyc(t) as Triangle).sort(byFirst),
  }
}

/** Triangulates a simple polygon (either orientation); indices refer to the input. */
export function triangulate(polygon: Polygon): TriangulationResult {
  return runTriangulation(polygon).result
}
