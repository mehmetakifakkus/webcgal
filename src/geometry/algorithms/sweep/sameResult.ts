import type { IntersectionResult, Pt } from '../../types'

const near = (p: Pt, q: Pt, eps: number) =>
  Math.abs(p.x - q.x) <= eps && Math.abs(p.y - q.y) <= eps

const key = (s: number[]) => [...s].sort((a, b) => a - b).join(',')

/**
 * True when both results report the same points (matched by position within eps,
 * same segment sets) and the same overlaps (same pair, ends matched unordered).
 * Order of the lists does not matter.
 */
export function sameResult(a: IntersectionResult, b: IntersectionResult, eps = 1e-6): boolean {
  if (a.points.length !== b.points.length || a.overlaps.length !== b.overlaps.length) return false

  const usedP = new Array<boolean>(b.points.length).fill(false)
  for (const pa of a.points) {
    const k = key(pa.segments)
    const j = b.points.findIndex((pb, n) => !usedP[n] && near(pa.p, pb.p, eps) && key(pb.segments) === k)
    if (j < 0) return false
    usedP[j] = true
  }

  const usedO = new Array<boolean>(b.overlaps.length).fill(false)
  for (const oa of a.overlaps) {
    const k = key(oa.segments)
    const j = b.overlaps.findIndex(
      (ob, n) =>
        !usedO[n] &&
        key(ob.segments) === k &&
        ((near(oa.a, ob.a, eps) && near(oa.b, ob.b, eps)) ||
          (near(oa.a, ob.b, eps) && near(oa.b, ob.a, eps))),
    )
    if (j < 0) return false
    usedO[j] = true
  }
  return true
}
