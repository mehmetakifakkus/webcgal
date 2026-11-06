import { orientation } from '../primitives'
import type { Pt } from '../types'

/**
 * Andrew's monotone chain. Starts at the leftmost point and goes clockwise
 * (upper hull left to right, then lower hull right to left). Collinear points
 * on edges and duplicates are dropped; the first point is not repeated.
 */
export function convexHull(points: Pt[]): Pt[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const pts = sorted.filter((p, i) => i === 0 || p.x !== sorted[i - 1].x || p.y !== sorted[i - 1].y)
  if (pts.length < 3) return pts

  const chain = (seq: Pt[]): Pt[] => {
    const out: Pt[] = []
    for (const p of seq) {
      while (out.length >= 2 && orientation(out[out.length - 2], out[out.length - 1], p) >= 0) out.pop()
      out.push(p)
    }
    return out
  }

  const upper = chain(pts)
  const lower = chain([...pts].reverse())
  upper.pop()
  lower.pop()
  return [...upper, ...lower]
}
