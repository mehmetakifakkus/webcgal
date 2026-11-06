import type { Polygon, Pt, VertexType } from '../../types'
import { GEOM_TOL, orientation, samePt, segmentIntersection } from '../../primitives'

/** Shoelace area; positive for counter-clockwise polygons (y axis up). */
export function signedArea(polygon: Polygon): number {
  let s = 0
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]
    const q = polygon[(i + 1) % polygon.length]
    s += p.x * q.y - q.x * p.y
  }
  return s / 2
}

/** Returns the polygon in CCW order; `reversed` tells whether the vertex order was flipped. */
export function ensureCCW(polygon: Polygon): { polygon: Polygon; reversed: boolean } {
  if (signedArea(polygon) >= 0) return { polygon, reversed: false }
  return { polygon: [...polygon].reverse(), reversed: true }
}

/**
 * True when the polygon is a simple closed polygon: at least 3 vertices, no
 * repeated consecutive vertex, and no two edges touch except neighbours at their
 * shared vertex.
 */
export function isSimple(polygon: Polygon): boolean {
  const n = polygon.length
  if (n < 3) return false
  for (let i = 0; i < n; i++) if (samePt(polygon[i], polygon[(i + 1) % n])) return false
  const edge = (i: number) => ({ a: polygon[i], b: polygon[(i + 1) % n] })
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = segmentIntersection(edge(i), edge(j))
      if (!r) continue
      if (r.kind === 'overlap') return false
      if (j === i + 1) {
        if (!samePt(r.p, polygon[j])) return false
      } else if (i === 0 && j === n - 1) {
        if (!samePt(r.p, polygon[0])) return false
      } else {
        return false
      }
    }
  }
  return true
}

/** Lexicographic order of the book: higher y first, ties broken by smaller x. */
export function above(p: Pt, q: Pt): boolean {
  if (p.y > q.y + GEOM_TOL) return true
  return Math.abs(p.y - q.y) <= GEOM_TOL && p.x < q.x - GEOM_TOL
}

/** Vertex indices sorted from highest to lowest by `above`. */
export function lexicographicOrder(polygon: Polygon): number[] {
  return polygon
    .map((_, i) => i)
    .sort((i, j) => {
      if (above(polygon[i], polygon[j])) return -1
      if (above(polygon[j], polygon[i])) return 1
      return i - j
    })
}

const prevOf = (polygon: Polygon, i: number) => polygon[(i - 1 + polygon.length) % polygon.length]
const nextOf = (polygon: Polygon, i: number) => polygon[(i + 1) % polygon.length]

/** Interior angle > 180 degrees. Assumes a CCW polygon; collinear is not reflex. */
export function isReflex(polygon: Polygon, i: number): boolean {
  return orientation(prevOf(polygon, i), polygon[i], nextOf(polygon, i)) === -1
}

/** Vertex type of de Berg section 3.2. Assumes a CCW polygon. */
export function vertexType(polygon: Polygon, i: number): VertexType {
  const v = polygon[i]
  const prev = prevOf(polygon, i)
  const next = nextOf(polygon, i)
  if (above(v, prev) && above(v, next)) return isReflex(polygon, i) ? 'split' : 'start'
  if (above(prev, v) && above(next, v)) return isReflex(polygon, i) ? 'merge' : 'end'
  return 'regular'
}

export function vertexTypes(polygon: Polygon): VertexType[] {
  return polygon.map((_, i) => vertexType(polygon, i))
}

/**
 * True when the polygon interior lies to the right of vertex i: the chain runs
 * downward through it (prev above v above next) on a CCW polygon, i.e. v is on
 * the left chain.
 */
export function interiorToRight(polygon: Polygon, i: number): boolean {
  return above(prevOf(polygon, i), polygon[i]) && above(polygon[i], nextOf(polygon, i))
}
