import type { Pt, Triangle } from '../../types'
import { cross, distance, inCircle, onSegment, orientation } from '../../primitives'
import { convexHull } from '../convexHull'

/** Number of input points on the hull boundary: hull vertices plus collinear points on hull edges. */
export function hullBoundaryCount(points: Pt[]): number {
  const hull = convexHull(points)
  if (hull.length === 0) return 0
  const segs = hull.map((a, i) => ({ a, b: hull[(i + 1) % hull.length] }))
  return points.filter((p) => segs.some((s) => onSegment(p, s))).length
}

const label = (t: Triangle) => `(v${t[0] + 1}, v${t[1] + 1}, v${t[2] + 1})`

/**
 * Checks a Delaunay triangulation (spec §2.5, h counted as in de Berg Theorem 9.1): every
 * triangle CCW; no point strictly inside any circumcircle; 2n − 2 − h triangles (none when the
 * hull is degenerate); areas sum to the hull area; every edge in one or two triangles, exactly
 * the hull boundary edges in one.
 */
export function isDelaunay(points: Pt[], triangles: Triangle[]): { ok: boolean; reason?: string } {
  const n = points.length
  for (const t of triangles) {
    if (t.some((i) => !Number.isInteger(i) || i < 0 || i >= n))
      return { ok: false, reason: `triangle ${t} has an invalid index` }
    if (orientation(points[t[0]], points[t[1]], points[t[2]]) !== 1)
      return { ok: false, reason: `triangle ${label(t)} is not counter-clockwise` }
  }
  for (const t of triangles) {
    const [a, b, c] = t.map((i) => points[i])
    for (let i = 0; i < n; i++) {
      if (t.includes(i)) continue
      if (inCircle(a, b, c, points[i]) > 0)
        return { ok: false, reason: `v${i + 1} lies inside the circumcircle of ${label(t)}` }
    }
  }

  const hull = convexHull(points)
  const expected = hull.length < 3 ? 0 : 2 * n - 2 - hullBoundaryCount(points)
  if (triangles.length !== expected)
    return { ok: false, reason: `expected ${expected} triangles, got ${triangles.length}` }
  if (expected === 0) return { ok: true }

  let area = 0
  for (const t of triangles) area += cross(points[t[0]], points[t[1]], points[t[2]]) / 2
  let hullArea = 0
  for (let i = 0; i < hull.length; i++) hullArea += cross({ x: 0, y: 0 }, hull[i], hull[(i + 1) % hull.length]) / 2
  hullArea = Math.abs(hullArea)
  if (Math.abs(area - hullArea) > 1e-6 * Math.max(1, hullArea))
    return { ok: false, reason: `triangle areas sum to ${area}, hull area is ${hullArea}` }

  const directed = new Set<string>()
  const count = new Map<string, [number, number, number]>()
  for (const t of triangles)
    for (let e = 0; e < 3; e++) {
      const a = t[e], b = t[(e + 1) % 3]
      const d = `${a},${b}`
      if (directed.has(d))
        return { ok: false, reason: `edge v${a + 1}–v${b + 1} is used twice in the same direction` }
      directed.add(d)
      const u = a < b ? `${a},${b}` : `${b},${a}`
      const c = count.get(u)
      if (c) c[2]++
      else count.set(u, [a, b, 1])
    }
  const hullSegs = hull.map((a, i) => ({ a, b: hull[(i + 1) % hull.length] }))
  for (const [a, b, c] of count.values()) {
    const onHull = hullSegs.some((s) => onSegment(points[a], s) && onSegment(points[b], s))
    if (onHull !== (c === 1))
      return {
        ok: false,
        reason: `edge v${a + 1}–v${b + 1} is in ${c} triangle${c === 1 ? '' : 's'} but ${onHull ? 'lies' : 'does not lie'} on the hull`,
      }
  }
  return { ok: true }
}

/** n points uniformly in `box`, each at least `minDist` from the others (rejection sampling). */
export function randomPointSet(
  rng: () => number,
  n: number,
  box: { x0: number; y0: number; x1: number; y1: number },
  minDist: number,
): Pt[] {
  const out: Pt[] = []
  for (let attempts = 0; out.length < n; attempts++) {
    if (attempts > 1000 * n) throw new Error('randomPointSet: cannot place the points')
    const p = { x: box.x0 + rng() * (box.x1 - box.x0), y: box.y0 + rng() * (box.y1 - box.y0) }
    if (out.every((q) => distance(p, q) >= minDist)) out.push(p)
  }
  return out
}
