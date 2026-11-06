import type { Diagonal, Polygon, Pt } from '../../types'
import { onSegment, samePt, segmentIntersection } from '../../primitives'

/** Ray casting; points on the boundary count as inside. */
export function pointInPolygon(p: Pt, polygon: Polygon): boolean {
  const n = polygon.length
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[j]
    const b = polygon[i]
    if (onSegment(p, { a, b })) return true
    if (a.y > p.y !== b.y > p.y) {
      const x = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x)
      if (p.x < x) inside = !inside
    }
  }
  return inside
}

/**
 * True when the diagonal joins two non-adjacent vertices, its midpoint is strictly
 * inside, and it touches no edge except at its own endpoints.
 */
export function diagonalInside(polygon: Polygon, d: Diagonal): boolean {
  const n = polygon.length
  const [i, j] = d
  if (i === j || i < 0 || j < 0 || i >= n || j >= n) return false
  if ((i + 1) % n === j || (j + 1) % n === i) return false
  const a = polygon[i]
  const b = polygon[j]
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  if (!pointInPolygon(mid, polygon)) return false
  for (let k = 0; k < n; k++) {
    const e = { a: polygon[k], b: polygon[(k + 1) % n] }
    if (onSegment(mid, e)) return false
    const r = segmentIntersection({ a, b }, e)
    if (!r) continue
    if (r.kind === 'overlap') return false
    const endpoint = [i, j].find((v) => samePt(r.p, polygon[v]))
    if (endpoint === undefined) return false
    // Touching at a diagonal end is fine only for an edge incident to that vertex.
    if (k !== endpoint && (k + 1) % n !== endpoint) return false
  }
  return true
}

/** Two diagonals cross (or overlap); sharing just an endpoint index is not a crossing. */
export function diagonalsCross(polygon: Polygon, a: Diagonal, b: Diagonal): boolean {
  const r = segmentIntersection(
    { a: polygon[a[0]], b: polygon[a[1]] },
    { a: polygon[b[0]], b: polygon[b[1]] },
  )
  if (!r) return false
  if (r.kind === 'overlap') return true
  const shared = a.filter((v) => b.includes(v))
  if (shared.length === 2) return true
  if (shared.length === 1) return false
  return true
}

export function isValidTriangulation(
  polygon: Polygon,
  diagonals: Diagonal[],
): { ok: boolean; reason?: string } {
  const n = polygon.length
  if (diagonals.length !== n - 3) {
    return { ok: false, reason: `expected ${n - 3} diagonals, got ${diagonals.length}` }
  }
  for (let i = 0; i < diagonals.length; i++) {
    const d = diagonals[i]
    if (!diagonalInside(polygon, d)) {
      return { ok: false, reason: `diagonal [${d[0]}, ${d[1]}] is not inside the polygon` }
    }
    for (let j = 0; j < i; j++) {
      const e = diagonals[j]
      const same = Math.min(d[0], d[1]) === Math.min(e[0], e[1]) && Math.max(d[0], d[1]) === Math.max(e[0], e[1])
      if (same) return { ok: false, reason: `duplicate diagonal [${d[0]}, ${d[1]}]` }
      if (diagonalsCross(polygon, d, e)) {
        return { ok: false, reason: `diagonals [${d[0]}, ${d[1]}] and [${e[0]}, ${e[1]}] cross` }
      }
    }
  }
  return { ok: true }
}

/** Star-shaped simple CCW polygon around (cx, cy) with jittered angles and radii. */
export function randomStarPolygon(
  rng: () => number,
  n: number,
  cx: number,
  cy: number,
  rMin: number,
  rMax: number,
): Polygon {
  const step = (2 * Math.PI) / n
  const pts: Polygon = []
  for (let i = 0; i < n; i++) {
    const angle = i * step + (rng() - 0.5) * 0.6 * step
    const r = rMin + rng() * (rMax - rMin)
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  }
  return pts
}

