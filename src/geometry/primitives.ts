import type { Pt, Segment } from './types'

export const EPS = 1e-9

export function subtract(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function dot(u: Pt, v: Pt): number {
  return u.x * v.x + u.y * v.y
}

export function crossVec(u: Pt, v: Pt): number {
  return u.x * v.y - u.y * v.x
}

export function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** (a - o) x (b - o). Positive when o -> a -> b turns left (y axis points up). */
export function cross(o: Pt, a: Pt, b: Pt): number {
  return crossVec(subtract(a, o), subtract(b, o))
}

export function orientation(o: Pt, a: Pt, b: Pt): -1 | 0 | 1 {
  const c = cross(o, a, b)
  if (c > EPS) return 1
  if (c < -EPS) return -1
  return 0
}

/** Distance tolerance for point-on-segment tests (canvas coordinates are 0-800). */
const DIST_TOL = 1e-7

export function samePt(p: Pt, q: Pt): boolean {
  return Math.abs(p.x - q.x) <= EPS && Math.abs(p.y - q.y) <= EPS
}

/** Upper end of a segment: larger y; on a tie the smaller x. */
export function upperEndpoint(s: Segment): Pt {
  const { a, b } = s
  if (Math.abs(a.y - b.y) <= EPS) return a.x <= b.x ? a : b
  return a.y > b.y ? a : b
}

export function lowerEndpoint(s: Segment): Pt {
  return upperEndpoint(s) === s.a ? s.b : s.a
}

export function isHorizontal(s: Segment): boolean {
  return Math.abs(s.a.y - s.b.y) <= EPS
}

/** x where the segment's line meets height y. For a horizontal segment returns `s.a.x`. */
export function xAtY(s: Segment, y: number): number {
  if (isHorizontal(s)) return s.a.x
  return s.a.x + ((y - s.a.y) / (s.b.y - s.a.y)) * (s.b.x - s.a.x)
}

/**
 * True when p lies on the segment (ends included). Uses the true point-to-segment
 * distance with an absolute tolerance of 1e-7 (coordinates are canvas-scale), so a
 * zero-length segment is treated as a point.
 */
export function onSegment(p: Pt, s: Segment): boolean {
  const r = subtract(s.b, s.a)
  const len2 = dot(r, r)
  if (len2 === 0) return distance(p, s.a) <= DIST_TOL
  const u = Math.min(1, Math.max(0, dot(subtract(p, s.a), r) / len2))
  return distance(p, { x: s.a.x + u * r.x, y: s.a.y + u * r.y }) <= DIST_TOL
}

export type SegmentIntersection =
  | { kind: 'point'; p: Pt }
  | { kind: 'overlap'; a: Pt; b: Pt }
  | null

/**
 * Intersection of two closed segments. Symmetric in its arguments; a zero-length
 * segment is a point. `overlap` ends are ordered with `a` the upper endpoint.
 */
export function segmentIntersection(s: Segment, t: Segment): SegmentIntersection {
  const r = subtract(s.b, s.a)
  const d = subtract(t.b, t.a)
  const lr = Math.hypot(r.x, r.y)
  const ld = Math.hypot(d.x, d.y)

  if (lr <= DIST_TOL || ld <= DIST_TOL) {
    if (lr <= DIST_TOL && ld <= DIST_TOL) {
      return distance(s.a, t.a) <= DIST_TOL ? { kind: 'point', p: { ...s.a } } : null
    }
    if (lr <= DIST_TOL) return onSegment(s.a, t) ? { kind: 'point', p: { ...s.a } } : null
    return onSegment(t.a, s) ? { kind: 'point', p: { ...t.a } } : null
  }

  const denom = crossVec(r, d)
  const ac = subtract(t.a, s.a)
  if (Math.abs(denom) > EPS * lr * ld) {
    const u = crossVec(ac, d) / denom // position along s
    const v = crossVec(ac, r) / denom // position along t
    if (u < -EPS || u > 1 + EPS || v < -EPS || v > 1 + EPS) return null
    return { kind: 'point', p: { x: s.a.x + u * r.x, y: s.a.y + u * r.y } }
  }

  // Parallel: must be collinear to touch.
  if (Math.abs(crossVec(r, ac)) / lr > DIST_TOL) return null
  const proj = (p: Pt) => dot(subtract(p, s.a), r) / (lr * lr)
  const u1 = proj(t.a)
  const u2 = proj(t.b)
  const lo = Math.max(0, Math.min(u1, u2))
  const hi = Math.min(1, Math.max(u1, u2))
  const tol = DIST_TOL / lr
  if (lo > hi + tol) return null
  const at = (u: number): Pt => ({ x: s.a.x + u * r.x, y: s.a.y + u * r.y })
  if ((hi - lo) * lr <= DIST_TOL) return { kind: 'point', p: at((lo + hi) / 2) }
  const seg: Segment = { a: at(lo), b: at(hi) }
  const up = upperEndpoint(seg)
  return { kind: 'overlap', a: up, b: up === seg.a ? seg.b : seg.a }
}
