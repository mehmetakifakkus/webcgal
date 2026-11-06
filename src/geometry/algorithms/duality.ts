import { EPS } from '../primitives'
import type { Line, Pt } from '../types'

/** Point (a, b) maps to the line y = a·x − b. */
export function dualLine(p: Pt): Line {
  return { slope: p.x, intercept: -p.y }
}

/** Line y = a·x + c maps to the point (a, −c). Inverse of `dualLine`. */
export function dualPoint(l: Line): Pt {
  return { x: l.slope, y: -l.intercept }
}

function stabs(l: Line, [a, b]: [Pt, Pt]): boolean {
  const ra = a.y - (l.slope * a.x + l.intercept)
  const rb = b.y - (l.slope * b.x + l.intercept)
  return Math.abs(ra) <= EPS || Math.abs(rb) <= EPS || (ra < 0) !== (rb < 0)
}

/**
 * Finds a non-vertical line meeting every segment (endpoints count), or null.
 * Tries the line through every pair of endpoints with distinct x and returns
 * the first that stabs all segments. With 0 or 1 segments a line always exists.
 */
export function findStabber(segments: [Pt, Pt][]): Line | null {
  if (segments.length === 0) return { slope: 0, intercept: 0 }
  if (segments.length === 1) {
    const [a, b] = segments[0]
    if (Math.abs(a.x - b.x) > EPS) {
      const slope = (b.y - a.y) / (b.x - a.x)
      return { slope, intercept: a.y - slope * a.x }
    }
    return { slope: 0, intercept: a.y }
  }
  const pts = segments.flat()
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i]
      const b = pts[j]
      if (Math.abs(a.x - b.x) <= EPS) continue
      const slope = (b.y - a.y) / (b.x - a.x)
      const line = { slope, intercept: a.y - slope * a.x }
      if (segments.every((s) => stabs(line, s))) return line
    }
  }
  return null
}
