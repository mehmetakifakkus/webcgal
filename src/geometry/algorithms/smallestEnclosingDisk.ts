import { EPS, distance } from '../primitives'
import type { Circle, Pt } from '../types'

/** Smallest circle having a and b as diameter endpoints. */
export function circleFrom2(a: Pt, b: Pt): Circle {
  return {
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    radius: distance(a, b) / 2,
  }
}

/** Circle through three points (closed form); null when they are collinear. */
export function circumcircle(a: Pt, b: Pt, c: Pt): Circle | null {
  const bx = b.x - a.x
  const by = b.y - a.y
  const cx = c.x - a.x
  const cy = c.y - a.y
  const d = 2 * (bx * cy - by * cx)
  const scale = Math.hypot(bx, by) * Math.hypot(cx, cy)
  if (Math.abs(d) <= 2 * EPS * scale) return null
  const b2 = bx * bx + by * by
  const c2 = cx * cx + cy * cy
  const ux = (cy * b2 - by * c2) / d
  const uy = (bx * c2 - cx * b2) / d
  return { center: { x: a.x + ux, y: a.y + uy }, radius: Math.hypot(ux, uy) }
}

const inside = (c: Circle, q: Pt) => distance(c.center, q) <= c.radius + EPS

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Circle through three points, or the diameter circle of the farthest pair if collinear. */
function circleFrom3(a: Pt, b: Pt, c: Pt): Circle {
  const cc = circumcircle(a, b, c)
  if (cc) return cc
  const pairs: [Pt, Pt][] = [[a, b], [a, c], [b, c]]
  let best = pairs[0]
  for (const pr of pairs) if (distance(pr[0], pr[1]) > distance(best[0], best[1])) best = pr
  return circleFrom2(best[0], best[1])
}

/**
 * Randomized incremental smallest enclosing disk (de Berg et al., MiniDisc,
 * section 4.7). `random` drives the shuffles; the input is not mutated.
 */
export function smallestEnclosingDisk(points: Pt[], random: () => number = Math.random): Circle {
  if (points.length === 0) return { center: { x: 0, y: 0 }, radius: 0 }
  if (points.length === 1) return { center: { ...points[0] }, radius: 0 }
  const P = shuffle(points, random)
  let D = circleFrom2(P[0], P[1])
  for (let i = 2; i < P.length; i++) {
    if (!inside(D, P[i])) D = withPoint(P.slice(0, i), P[i], random)
  }
  return D
}

/** Smallest disk of `P` with `q` on its boundary. */
function withPoint(P: Pt[], q: Pt, random: () => number): Circle {
  const S = shuffle(P, random)
  let D = circleFrom2(q, S[0])
  for (let j = 1; j < S.length; j++) {
    if (!inside(D, S[j])) D = withTwoPoints(S.slice(0, j), q, S[j])
  }
  return D
}

/** Smallest disk of `P` with `q1` and `q2` on its boundary. */
function withTwoPoints(P: Pt[], q1: Pt, q2: Pt): Circle {
  let D = circleFrom2(q1, q2)
  for (const r of P) {
    if (!inside(D, r)) D = circleFrom3(q1, q2, r)
  }
  return D
}
