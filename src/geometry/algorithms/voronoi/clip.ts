import { GEOM_TOL } from '../../primitives'
import type { Pt } from '../../types'

export type Box = { x0: number; y0: number; x1: number; y1: number }

/** The drawing canvas in y-up coordinates. */
export const CANVAS_BOX: Box = { x0: 0, y0: 0, x1: 775, y1: 360 }

/**
 * Liang–Barsky core: the sub-interval of [tMin, tMax] for which p + t·d lies in
 * the box, or null when empty. A zero `d` gives null.
 */
function clipParam(p: Pt, d: Pt, box: Box, tMin: number, tMax: number): [number, number] | null {
  if (d.x === 0 && d.y === 0) return null
  let lo = tMin
  let hi = tMax
  // Each constraint is q + t·r >= 0.
  const constraints: [number, number][] = [
    [p.x - box.x0, d.x],
    [box.x1 - p.x, -d.x],
    [p.y - box.y0, d.y],
    [box.y1 - p.y, -d.y],
  ]
  for (const [q, r] of constraints) {
    if (r === 0) {
      if (q < 0) return null
      continue
    }
    const t = -q / r
    if (r > 0) lo = Math.max(lo, t)
    else hi = Math.min(hi, t)
    if (lo > hi) return null
  }
  return [lo, hi]
}

function at(p: Pt, d: Pt, t: number): Pt {
  return { x: p.x + t * d.x, y: p.y + t * d.y }
}

function clipWith(p: Pt, d: Pt, box: Box, tMin: number, tMax: number): [Pt, Pt] | null {
  const r = clipParam(p, d, box, tMin, tMax)
  return r && [at(p, d, r[0]), at(p, d, r[1])]
}

export function clipSegment(a: Pt, b: Pt, box: Box): [Pt, Pt] | null {
  return clipWith(a, { x: b.x - a.x, y: b.y - a.y }, box, 0, 1)
}

export function clipRay(a: Pt, dir: Pt, box: Box): [Pt, Pt] | null {
  return clipWith(a, dir, box, 0, Infinity)
}

export function clipLine(p: Pt, dir: Pt, box: Box): [Pt, Pt] | null {
  return clipWith(p, dir, box, -Infinity, Infinity)
}

/** Sutherland–Hodgman against the four box edges; CCW in gives CCW out. */
export function clipPolygonToBox(poly: Pt[], box: Box): Pt[] {
  // value(p) >= 0 means inside the half-plane.
  const edges: ((p: Pt) => number)[] = [
    (p) => p.x - box.x0,
    (p) => box.x1 - p.x,
    (p) => p.y - box.y0,
    (p) => box.y1 - p.y,
  ]
  let out = poly
  for (const value of edges) {
    const input = out
    out = []
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]
      const prev = input[(i + input.length - 1) % input.length]
      const vc = value(cur)
      const vp = value(prev)
      if ((vc >= 0) !== (vp >= 0)) {
        const t = vp / (vp - vc)
        out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) })
      }
      if (vc >= 0) out.push(cur)
    }
    if (out.length === 0) return []
  }
  const dedup: Pt[] = []
  for (const p of out) {
    const last = dedup[dedup.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > GEOM_TOL) dedup.push(p)
  }
  while (dedup.length > 1) {
    const f = dedup[0]
    const l = dedup[dedup.length - 1]
    if (Math.hypot(f.x - l.x, f.y - l.y) > GEOM_TOL) break
    dedup.pop()
  }
  return dedup.length < 3 ? [] : dedup
}
