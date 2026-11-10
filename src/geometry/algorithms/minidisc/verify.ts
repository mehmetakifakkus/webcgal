import type { Circle, Pt } from '../../types'
import { distance } from '../../primitives'
import { circleFrom2, circumcircle } from './minidisc'

/**
 * Checks that `disk` is the smallest disc enclosing `points` (spec §2.2): every point inside
 * (up to the boundary tolerance 1e-7 · max(1, r)), and the boundary points either contain a
 * diametral pair or three points whose closed triangle contains the centre. A disc of radius
 * within the tolerance is minimal as soon as it encloses the points.
 */
export function isMinimalDisk(points: Pt[], disk: Circle | null): { ok: boolean; reason?: string } {
  if (!disk) return points.length === 0 ? { ok: true } : { ok: false, reason: 'no disc for a non-empty point set' }
  const { center: c, radius: r } = disk
  const tol = 1e-7 * Math.max(1, r)
  for (let i = 0; i < points.length; i++) {
    const d = distance(c, points[i])
    if (d > r + tol) return { ok: false, reason: `v${i + 1} lies outside the disc (distance ${d}, radius ${r})` }
  }
  if (r <= tol) return { ok: true }

  const on = points.filter((p) => Math.abs(distance(c, p) - r) <= tol)
  for (let a = 0; a < on.length; a++)
    for (let b = a + 1; b < on.length; b++) {
      const mid = { x: (on[a].x + on[b].x) / 2, y: (on[a].y + on[b].y) / 2 }
      if (distance(mid, c) <= tol) return { ok: true }
    }
  for (let a = 0; a < on.length; a++)
    for (let b = a + 1; b < on.length; b++)
      for (let e = b + 1; e < on.length; e++) if (triangleContains(on[a], on[b], on[e], c, tol)) return { ok: true }
  return {
    ok: false,
    reason: `not minimal: the ${on.length} boundary point${on.length === 1 ? '' : 's'} neither contain a diameter nor surround the centre`,
  }
}

/** True when q lies in the closed triangle abc, allowing a distance `tol` outside each edge. */
function triangleContains(a: Pt, b: Pt, c: Pt, q: Pt, tol: number): boolean {
  const side = (u: Pt, v: Pt) => ((v.x - u.x) * (q.y - u.y) - (v.y - u.y) * (q.x - u.x)) / Math.max(distance(u, v), 1e-300)
  const s = [side(a, b), side(b, c), side(c, a)]
  return s.every((x) => x >= -tol) || s.every((x) => x <= tol)
}

/** Smallest disc over all pair and triple discs that encloses every point; O(n⁴), tests only (n ≤ 12). */
export function bruteForceDisk(points: Pt[]): Circle {
  const n = points.length
  if (n === 0) return { center: { x: 0, y: 0 }, radius: 0 }
  if (n === 1) return { center: { ...points[0] }, radius: 0 }
  const encloses = (c: Circle) => points.every((p) => distance(c.center, p) <= c.radius * (1 + 1e-9) + 1e-9)
  let best: Circle | null = null
  const consider = (c: Circle | null) => {
    if (c && (!best || c.radius < best.radius) && encloses(c)) best = c
  }
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      consider(circleFrom2(points[i], points[j]))
      for (let k = j + 1; k < n; k++) consider(circumcircle(points[i], points[j], points[k]))
    }
  return best!
}
