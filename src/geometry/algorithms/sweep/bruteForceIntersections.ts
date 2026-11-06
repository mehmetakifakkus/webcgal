import type { IntersectionPoint, IntersectionResult, Overlap, Pt, Segment } from '../../types'
import { GEOM_TOL, onSegment, samePt, segmentIntersection } from '../../primitives'

/** Sweep order: y descending, ties (|Δy| ≤ GEOM_TOL) x ascending. */
export function sweepOrder(p: Pt, q: Pt): number {
  if (Math.abs(p.y - q.y) <= GEOM_TOL) return p.x - q.x
  return q.y - p.y
}

/**
 * O(n²) reference: every pair through `segmentIntersection`. Candidates are the
 * point results plus both ends of every overlap; at each merged candidate all
 * segments through it are listed.
 */
export function bruteForceIntersections(segments: Segment[]): IntersectionResult {
  const candidates: Pt[] = []
  const overlaps: Overlap[] = []
  const addCandidate = (p: Pt) => {
    if (!candidates.some((q) => samePt(p, q))) candidates.push({ x: p.x, y: p.y })
  }

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const r = segmentIntersection(segments[i], segments[j])
      if (!r) continue
      if (r.kind === 'point') addCandidate(r.p)
      else {
        overlaps.push({ a: { ...r.a }, b: { ...r.b }, segments: [i, j] })
        addCandidate(r.a)
        addCandidate(r.b)
      }
    }
  }

  const points: IntersectionPoint[] = []
  for (const p of candidates) {
    const through = segments.flatMap((s, i) => (onSegment(p, s) ? [i] : []))
    if (through.length >= 2) points.push({ p, segments: through })
  }
  points.sort((a, b) => sweepOrder(a.p, b.p))
  return { points, overlaps }
}
