import type { Diagonal, Polygon } from '../../types'
import { orientation } from '../../primitives'
import { above } from './polygon'
import type { TriPatch, TriRecorder, TriRecorderContext } from './triangulationState'

// de Berg et al., Computational Geometry, §3.3: TriangulateMonotonePolygon.
// `record` lines 30–40 index TRIANGULATION_PSEUDOCODE (Task 4). In the
// descriptions vertices are 1-based (`v3`) and u_j is the j-th merged vertex.

const v = (i: number) => `v${i + 1}`
const u = (j: number) => `u${j + 1}`

/**
 * Triangulates a y-monotone piece (CCW vertex indices into `polygon`). Returns
 * the diagonals as [min, max] in insertion order; a 3-vertex piece gives [].
 */
export function triangulateMonotone(polygon: Polygon, piece: number[], record?: TriRecorder): Diagonal[] {
  const m = piece.length
  const cmp = (a: number, b: number) => (above(polygon[a], polygon[b]) ? -1 : above(polygon[b], polygon[a]) ? 1 : a - b)
  let top = 0
  let bottom = 0
  for (let k = 1; k < m; k++) {
    if (cmp(piece[k], piece[top]) < 0) top = k
    if (cmp(piece[k], piece[bottom]) > 0) bottom = k
  }

  // In a CCW polygon (y up) the interior is on the left of the walking
  // direction. Walking forward (CCW) from the top vertex therefore goes DOWN
  // the left chain (interior to the east of it) until the bottom vertex; the
  // remaining vertices (bottom → top, still CCW, going up) form the right
  // chain. Top and bottom are labelled 'left'; their label is never compared
  // (u_1 is never the top of S at line 33 and u_n is handled by line 40).
  const side = new Map<number, 'left' | 'right'>()
  for (let k = top; ; k = (k + 1) % m) {
    side.set(piece[k], 'left')
    if (k === bottom) break
  }
  for (const p of piece) if (!side.has(p)) side.set(p, 'right')

  const merged = [...piece].sort(cmp)
  const chain = merged.map((p) => side.get(p)!)
  const stack: number[] = []
  const diagonals: Diagonal[] = []

  const ctx = (): TriRecorderContext => ({
    phase: 'triangulate',
    sweepY: null,
    queue: [],
    status: [],
    partitionDiagonals: [],
    pieces: [],
    merged: [...merged],
    chain: [...chain],
    stack: [...stack],
    triangulationDiagonals: diagonals.map((d) => [...d] as Diagonal),
    types: [],
  })
  const rec = (line: number, description: string, patch: TriPatch = {}) => record?.(line, description, patch, ctx())
  const name = (j: number) => `${u(j)} = ${v(merged[j])}`

  const addDiagonal = (line: number, j: number, w: number, popped: boolean) => {
    const a = merged[j]
    const d: Diagonal = a < w ? [a, w] : [w, a]
    diagonals.push(d)
    rec(line, `${popped ? `Pop ${v(w)}; add` : 'Add'} diagonal ${u(j)}–${v(w)}`, { cursor: a, reported: [...d] as Diagonal })
  }

  /**
   * Line 38 test: is the diagonal from u_j to `next` (the vertex below `last`
   * on the stack) inside P? `last` was just popped and lies on u_j's chain, so
   * the triangle u_j, last, next must turn the polygon's way:
   *   u_j on the left chain:  orientation(next, last, u_j) === +1
   *     (walking next → last → u_j downward along the left chain turns left,
   *      i.e. `last` is not reflex and next–u_j stays inside)
   *   u_j on the right chain: orientation(u_j, last, next) === +1
   *     (the right chain runs upward in CCW order: u_j → last → next).
   * Collinear (0) means the diagonal runs along the boundary: not inside.
   */
  const inside = (j: number, last: number, next: number): boolean => {
    const uj = polygon[merged[j]]
    return chain[j] === 'left'
      ? orientation(polygon[next], polygon[last], uj) === 1
      : orientation(uj, polygon[last], polygon[next]) === 1
  }

  rec(30, `Merge the chains: ${merged.map((_, j) => name(j)).join(', ')}`)
  stack.push(merged[0], merged[1])
  rec(31, `Push ${name(0)} and ${name(1)} onto S`)

  const sideOf = (p: number) => chain[merged.indexOf(p)]

  for (let j = 2; j < m - 1; j++) {
    const uj = merged[j]
    const cursor = { cursor: uj }
    const topV = stack[stack.length - 1]
    if (chain[j] !== sideOf(topV)) {
      rec(33, `${name(j)} and the top of the stack are on different chains`, cursor)
      while (stack.length > 0) {
        const w = stack.pop()!
        if (stack.length > 0) addDiagonal(34, j, w, true)
        else rec(34, `Pop ${v(w)} (the last one, no diagonal)`, cursor)
      }
      stack.push(merged[j - 1], uj)
      rec(35, `Push ${name(j - 1)} and ${name(j)} onto S`, cursor)
    } else {
      rec(33, `${name(j)} and the top of the stack are on the same chain`, cursor)
      let last = stack.pop()!
      rec(37, `Pop ${v(last)}`, cursor)
      while (stack.length > 0) {
        const next = stack[stack.length - 1]
        if (!inside(j, last, next)) {
          rec(38, `Diagonal ${u(j)}–${v(next)} is not inside P; push ${v(last)} back onto S`, cursor)
          break
        }
        stack.pop()
        addDiagonal(38, j, next, true)
        last = next
        if (stack.length === 0) rec(38, `Stack is empty; push ${v(last)} back onto S`, cursor)
      }
      stack.push(last)
      stack.push(uj)
      rec(39, `Push ${name(j)} onto S`, cursor)
    }
  }

  const j = m - 1
  const inner = stack.slice(1, -1).reverse()
  if (inner.length === 0) rec(40, `No diagonals to add from ${name(j)}`, { cursor: merged[j] })
  for (const w of inner) addDiagonal(40, j, w, false)
  return diagonals
}
