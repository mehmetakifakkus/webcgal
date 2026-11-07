import type { Pt } from '../../types'
import { GEOM_TOL, orientation } from '../../primitives'

/**
 * Symbolic vertices of the initial triangle (de Berg et al., section 9.3, pp. 204-205).
 * p-1 is treated as lexicographically larger than every real point, p-2 as smaller
 * than every real point (and than p-1). "Higher" means larger y, then larger x.
 *
 * Derived orientation rule (a, b real, x real; orient > 0 means a -> b -> c turns left):
 *   orient(a, b, p-1) = +1 if b is lexicographically higher than a, else -1
 *   orient(a, b, p-2) = -1 if b is lexicographically higher than a, else +1
 *   orient(p-1, p-2, x) = +1
 * Equal real points (within GEOM_TOL) and repeated indices give 0.
 *
 * Justification: p-1 is "infinitely far" in the lexicographically higher direction,
 * so it lies to the left of the line a -> b exactly when that line points towards the
 * higher end; p-2 is infinitely far in the opposite direction, hence the opposite
 * sign. The constant orient(p-1, p-2, x) = +1 makes [p0, p-1, p-2] counter-clockwise
 * (p0 is the highest point). Every other argument order follows by cyclic rotation
 * (orient is invariant) and swapping two arguments (orient changes sign).
 * Checked invariants: (i) orient(p0, p-1, p-2) = 1; (ii) every real point lies inside
 * [p0, p-1, p-2] (orient(p0, p-1, p) = 1 for p != p0, orient(p-1, p-2, p) = 1,
 * orient(p-2, p0, p) = 1); (iii) antisymmetry and cyclic consistency.
 */
export const P_MINUS_1 = -1
export const P_MINUS_2 = -2

export function isSymbolic(i: number): boolean {
  return i < 0
}

/** True when p is lexicographically higher than q: larger y, on a y tie larger x. */
export function lexHigher(p: Pt, q: Pt): boolean {
  const dy = p.y - q.y
  if (Math.abs(dy) > GEOM_TOL) return dy > 0
  return p.x - q.x > GEOM_TOL
}

/** Index of p0, the lexicographically highest point. */
export function highestIndex(points: Pt[]): number {
  let best = 0
  for (let i = 1; i < points.length; i++) if (lexHigher(points[i], points[best])) best = i
  return best
}

export function orient(points: Pt[], i: number, j: number, k: number): -1 | 0 | 1 {
  const idx = [i, j, k]
  const sym = idx.filter(isSymbolic).length
  if (sym === 0) return orientation(points[i], points[j], points[k])
  if (new Set(idx).size < 3) return 0
  // Rotate (orient is invariant): one symbolic -> last; two symbolic -> the real one last.
  const wantSymbolicLast = sym === 1
  let r = idx
  for (let t = 0; t < 3; t++) {
    if (isSymbolic(r[2]) === wantSymbolicLast) break
    r = [r[1], r[2], r[0]]
  }
  const [a, b, c] = r
  if (sym === 2) return a === P_MINUS_1 ? 1 : -1 // (p-1, p-2, x) or its rotation order
  const pa = points[a]
  const pb = points[b]
  if (!lexHigher(pa, pb) && !lexHigher(pb, pa)) return 0
  const up = lexHigher(pb, pa)
  return c === P_MINUS_1 ? (up ? 1 : -1) : up ? -1 : 1
}

/**
 * Locates point p (real index) in the CCW triangle `tri`, which may contain symbolic
 * vertices. `edge: e` is the edge tri[e]-tri[(e+1)%3] that p lies on; a point is never
 * on a symbolic edge, and no edge is reported when p coincides with a vertex.
 */
export function pointInTriangle(
  points: Pt[],
  tri: [number, number, number],
  p: number,
): { inside: boolean; edge?: 0 | 1 | 2 } {
  const o = [0, 1, 2].map((e) => orient(points, tri[e], tri[(e + 1) % 3], p))
  if (o.some((v) => v < 0)) return { inside: false }
  const zeros = [0, 1, 2].filter((e) => o[e] === 0)
  if (zeros.length === 1) {
    const e = zeros[0] as 0 | 1 | 2
    if (!isSymbolic(tri[e]) && !isSymbolic(tri[(e + 1) % 3])) return { inside: true, edge: e }
  }
  return { inside: true }
}
