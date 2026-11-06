import type { Diagonal, Polygon } from '../../types'

// Simple splitting instead of a DCEL; teaching scale (n <= ~30, O(n) search per
// diagonal).

/** Rotates a piece so that its smallest index comes first (cyclic order kept). */
function normalize(piece: number[]): number[] {
  let k = 0
  for (let i = 1; i < piece.length; i++) if (piece[i] < piece[k]) k = i
  return [...piece.slice(k), ...piece.slice(0, k)]
}

/** Cyclic slice of `piece` from position i to position j, both inclusive. */
function cyclic(piece: number[], i: number, j: number): number[] {
  const out: number[] = []
  for (let k = i; ; k = (k + 1) % piece.length) {
    out.push(piece[k])
    if (k === j) return out
  }
}

/**
 * Splits the polygon along non-crossing diagonals. Starts with the single piece
 * [0..n−1]; each diagonal (a, b) splits the piece holding both a and b (as
 * non-neighbours) into its cyclic slices [a..b] and [b..a]. Pieces keep the
 * polygon's (CCW) vertex order, start at their smallest index and are sorted;
 * the result does not depend on the order of the diagonals.
 */
export function splitByDiagonals(polygon: Polygon, diagonals: Diagonal[]): number[][] {
  let pieces: number[][] = [polygon.map((_, i) => i)]
  for (const [a, b] of diagonals) {
    const k = pieces.findIndex((piece) => {
      const ia = piece.indexOf(a)
      const ib = piece.indexOf(b)
      if (ia < 0 || ib < 0 || ia === ib) return false
      const m = piece.length
      return (ia + 1) % m !== ib && (ib + 1) % m !== ia
    })
    if (k < 0) continue
    const piece = pieces[k]
    const ia = piece.indexOf(a)
    const ib = piece.indexOf(b)
    pieces = [...pieces.slice(0, k), cyclic(piece, ia, ib), cyclic(piece, ib, ia), ...pieces.slice(k + 1)]
  }
  return pieces.map(normalize).sort((p, q) => {
    for (let i = 0; i < Math.min(p.length, q.length); i++) if (p[i] !== q[i]) return p[i] - q[i]
    return p.length - q.length
  })
}
