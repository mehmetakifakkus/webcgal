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

/**
 * The single absolute distance tolerance for all segment code (canvas coordinates
 * are 0-800). EPS stays for the existing hull/orientation code.
 *
 * Known asymmetry: segmentIntersection applies GEOM_TOL as a parameter slack along
 * each segment, while onSegment measures perpendicular distance. At shallow angles a
 * crossing accepted by the slack can lie ~5e-8 to 1e-6 off the other segment, so the
 * two tests can disagree in that band. It is unreachable with mouse input.
 */
export const GEOM_TOL = 1e-7

export function samePt(p: Pt, q: Pt): boolean {
  return Math.abs(p.x - q.x) <= GEOM_TOL && Math.abs(p.y - q.y) <= GEOM_TOL
}

/**
 * Upper end of a segment: larger y; on a tie (y within GEOM_TOL, as in the event
 * queue) the smaller x.
 */
export function upperEndpoint(s: Segment): Pt {
  const { a, b } = s
  if (Math.abs(a.y - b.y) <= GEOM_TOL) return a.x <= b.x ? a : b
  return a.y > b.y ? a : b
}

export function lowerEndpoint(s: Segment): Pt {
  return upperEndpoint(s) === s.a ? s.b : s.a
}

/** y of the ends equal within GEOM_TOL (the event queue's tie tolerance). */
export function isHorizontal(s: Segment): boolean {
  return Math.abs(s.a.y - s.b.y) <= GEOM_TOL
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
  if (len2 === 0) return distance(p, s.a) <= GEOM_TOL
  const u = Math.min(1, Math.max(0, dot(subtract(p, s.a), r) / len2))
  return distance(p, { x: s.a.x + u * r.x, y: s.a.y + u * r.y }) <= GEOM_TOL
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

  if (lr <= GEOM_TOL || ld <= GEOM_TOL) {
    if (lr <= GEOM_TOL && ld <= GEOM_TOL) {
      return distance(s.a, t.a) <= GEOM_TOL ? { kind: 'point', p: { ...s.a } } : null
    }
    if (lr <= GEOM_TOL) return onSegment(s.a, t) ? { kind: 'point', p: { ...s.a } } : null
    return onSegment(t.a, s) ? { kind: 'point', p: { ...t.a } } : null
  }

  const denom = crossVec(r, d)
  const ac = subtract(t.a, s.a)
  if (Math.abs(denom) > EPS * lr * ld) {
    const u = crossVec(ac, d) / denom // position along s
    const v = crossVec(ac, r) / denom // position along t
    const tu = GEOM_TOL / lr // GEOM_TOL as a parameter slack, per segment
    const tv = GEOM_TOL / ld
    if (u < -tu || u > 1 + tu || v < -tv || v > 1 + tv) return null
    return { kind: 'point', p: { x: s.a.x + u * r.x, y: s.a.y + u * r.y } }
  }

  // Parallel: must be collinear to touch.
  if (Math.abs(crossVec(r, ac)) / lr > GEOM_TOL) return null
  const proj = (p: Pt) => dot(subtract(p, s.a), r) / (lr * lr)
  const u1 = proj(t.a)
  const u2 = proj(t.b)
  const lo = Math.max(0, Math.min(u1, u2))
  const hi = Math.min(1, Math.max(u1, u2))
  const tol = GEOM_TOL / lr
  if (lo > hi + tol) return null
  const at = (u: number): Pt => ({ x: s.a.x + u * r.x, y: s.a.y + u * r.y })
  if ((hi - lo) * lr <= GEOM_TOL) return { kind: 'point', p: at((lo + hi) / 2) }
  const seg: Segment = { a: at(lo), b: at(hi) }
  const up = upperEndpoint(seg)
  return { kind: 'overlap', a: up, b: up === seg.a ? seg.b : seg.a }
}

/**
 * In-circle test. +1 when d is strictly inside the circle through a, b, c, 0 on it,
 * -1 outside. The sign is corrected for a clockwise (a, b, c), so the result does not
 * depend on the orientation. Points are translated by d first; the determinant is
 * compared with a tolerance relative to the scale s (largest distance of a, b, c from
 * d, at least 1): |det| <= 1e-7 * s^4 counts as 0.
 */
export function inCircle(a: Pt, b: Pt, c: Pt, d: Pt): -1 | 0 | 1 {
  const ax = a.x - d.x
  const ay = a.y - d.y
  const bx = b.x - d.x
  const by = b.y - d.y
  const cx = c.x - d.x
  const cy = c.y - d.y
  const det =
    (ax * ax + ay * ay) * (bx * cy - cx * by) -
    (bx * bx + by * by) * (ax * cy - cx * ay) +
    (cx * cx + cy * cy) * (ax * by - bx * ay)
  const s = Math.max(1, Math.hypot(ax, ay), Math.hypot(bx, by), Math.hypot(cx, cy))
  if (Math.abs(det) <= GEOM_TOL * s ** 4) return 0
  const ccw = cross(a, b, c) >= 0
  return (det > 0) === ccw ? 1 : -1
}

/** Centre of the circle through a, b, c; null when they are (nearly) collinear. */
export function circumcenter(a: Pt, b: Pt, c: Pt): Pt | null {
  const bx = b.x - a.x
  const by = b.y - a.y
  const cx = c.x - a.x
  const cy = c.y - a.y
  const d = 2 * (bx * cy - by * cx)
  if (Math.abs(d) <= EPS) return null
  const b2 = bx * bx + by * by
  const c2 = cx * cx + cy * cy
  return { x: a.x + (cy * b2 - by * c2) / d, y: a.y + (bx * c2 - cx * b2) / d }
}
