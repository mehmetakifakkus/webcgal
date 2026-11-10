import type { Polygon, Pt } from '../../types'
import { GEOM_TOL, crossVec, distance, dot, segmentIntersection, subtract } from '../../primitives'
import { ensureCCW } from '../triangulation/polygon'
import { pointInPolygon } from '../triangulation/verify'
import type { GalleryCoverage } from './galleryState'

// Visibility inside a simple polygon (spec §2.3): the closed segment test `sees`, the
// visibility polygon of a vertex camera and the sampled coverage of a camera set.

/** Angular offset of the side rays cast next to every vertex (radians). */
const SIDE_RAY = 1e-7
/** Slack for angle comparisons with the interior wedge (radians). */
const ANGLE_TOL = 1e-10
/** Relative slack along an edge for ray hits (parameter units). */
const EDGE_TOL = 1e-9
/** Minimal distance of a ray hit from the camera. */
const MIN_HIT = 1e-9

const TWO_PI = 2 * Math.PI
const normAngle = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI

/**
 * True when the closed segment ab lies in the closed polygon: the boundary counts as
 * inside, so ab may touch the boundary at vertices or run along edges, but it must not
 * pass through the exterior anywhere. Rejects any proper crossing of an edge (a common
 * point that is neither a polygon vertex nor an end of ab); otherwise splits ab at all its
 * boundary contacts and requires every piece's midpoint to be inside — a piece between
 * consecutive contacts meets no edge, so it lies wholly inside or wholly outside.
 * Either orientation.
 */
export function sees(polygon: Polygon, a: Pt, b: Pt): boolean {
  const n = polygon.length
  if (!pointInPolygon(a, polygon) || !pointInPolygon(b, polygon)) return false
  const r = subtract(b, a)
  const len2 = dot(r, r)
  if (Math.sqrt(len2) <= GEOM_TOL) return true
  const param = (p: Pt) => dot(subtract(p, a), r) / len2
  const ts = [0, 1]
  const ab = { a, b }
  for (let i = 0; i < n; i++) {
    const p = polygon[i]
    const q = polygon[(i + 1) % n]
    const x = segmentIntersection(ab, { a: p, b: q })
    if (!x) continue
    if (x.kind === 'overlap') {
      ts.push(param(x.a), param(x.b))
      continue
    }
    const atVertex = distance(x.p, p) <= GEOM_TOL || distance(x.p, q) <= GEOM_TOL
    const atEnd = distance(x.p, a) <= GEOM_TOL || distance(x.p, b) <= GEOM_TOL
    if (!atVertex && !atEnd) return false
    ts.push(param(x.p))
  }
  const sorted = ts.map((t) => Math.min(1, Math.max(0, t))).sort((s, t) => s - t)
  const minGap = GEOM_TOL / Math.sqrt(len2)
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k] - sorted[k - 1] <= minGap) continue
    const t = (sorted[k] + sorted[k - 1]) / 2
    if (!pointInPolygon({ x: a.x + t * r.x, y: a.y + t * r.y }, polygon)) return false
  }
  return true
}

/**
 * The region seen by a camera at vertex `v` (spec §2.3), as a CCW polygon starting at the
 * vertex. Casts a ray towards every other vertex and two side rays rotated by ±1e-7 rad;
 * keeps the rays inside the interior angle at v and takes each ray's nearest boundary hit
 * (edges collinear with the ray and hits at the camera itself are ignored, so the two
 * edges at v never stop a ray); the hits sorted by angle form the boundary. O(n²).
 * Either orientation; `v` indexes the input.
 */
export function visibilityPolygon(input: Polygon, v: number): Pt[] {
  const n = input.length
  if (!Number.isInteger(v) || v < 0 || v >= n) throw new RangeError(`vertex index ${v} out of range`)
  const { polygon, reversed } = ensureCCW(input)
  const k = reversed ? n - 1 - v : v
  const o = polygon[k]
  const next = polygon[(k + 1) % n]
  const prev = polygon[(k - 1 + n) % n]
  const angleOf = (p: Pt) => Math.atan2(p.y - o.y, p.x - o.x)
  // CCW polygon: the interior at v is swept turning CCW from the edge to next to the edge to prev.
  const base = angleOf(next)
  const wedge = normAngle(angleOf(prev) - base)

  const hits: { rel: number; p: Pt }[] = []
  for (let j = 0; j < n; j++) {
    if (j === k) continue
    const w = polygon[j]
    if (distance(w, o) <= GEOM_TOL) continue
    const theta = angleOf(w)
    for (const delta of [-SIDE_RAY, 0, SIDE_RAY]) {
      let rel = normAngle(theta + delta - base)
      if (rel > TWO_PI - ANGLE_TOL) rel = 0
      if (rel > wedge + ANGLE_TOL) continue
      rel = Math.min(rel, wedge)
      const len = distance(w, o)
      const d =
        delta === 0
          ? { x: (w.x - o.x) / len, y: (w.y - o.y) / len }
          : { x: Math.cos(theta + delta), y: Math.sin(theta + delta) }
      const p = castRay(polygon, o, d)
      if (p) hits.push({ rel, p })
    }
  }
  hits.sort((s, t) => s.rel - t.rel)

  const out: Pt[] = [{ ...o }]
  for (const { p } of hits) {
    const last = out[out.length - 1]
    if (distance(last, p) > MIN_HIT) out.push(p)
  }
  return out
}

/** Nearest hit of the ray o + t·d (d a unit vector, t > 0) with the polygon boundary. */
function castRay(polygon: Polygon, o: Pt, d: Pt): Pt | null {
  const n = polygon.length
  let best = Infinity
  for (let i = 0; i < n; i++) {
    const p = polygon[i]
    const e = subtract(polygon[(i + 1) % n], p)
    const le = Math.hypot(e.x, e.y)
    const denom = crossVec(d, e)
    if (Math.abs(denom) <= 1e-12 * le) continue // parallel: runs along the ray or misses it
    const w0 = subtract(p, o)
    const t = crossVec(w0, e) / denom
    const s = crossVec(w0, d) / denom
    if (s < -EDGE_TOL || s > 1 + EDGE_TOL || t <= MIN_HIT) continue
    best = Math.min(best, t)
  }
  if (best === Infinity) return null
  const hit = { x: o.x + best * d.x, y: o.y + best * d.y }
  // snap onto a vertex the ray passes through
  for (const q of polygon) if (distance(q, hit) <= 1e-9 * Math.max(1, best)) return { ...q }
  return hit
}

/**
 * Sampled coverage (spec §3.3): the points of the grid of multiples of `step` inside the
 * closed polygon; a sample is seen when some camera (vertex index) `sees` it. `percent`
 * is the rounded share of seen samples, `covered` means no sample is unseen and
 * `perCamera` gives each camera's own rounded share, in the order of `cameras`. A polygon
 * with no sample counts as 100% covered.
 */
export function coverage(polygon: Polygon, cameras: number[], step = 5): GalleryCoverage {
  const xs = polygon.map((p) => p.x)
  const ys = polygon.map((p) => p.y)
  const samples: Pt[] = []
  for (let i = Math.ceil(Math.min(...xs) / step); i * step <= Math.max(...xs); i++) {
    for (let j = Math.ceil(Math.min(...ys) / step); j * step <= Math.max(...ys); j++) {
      const s = { x: i * step, y: j * step }
      if (pointInPolygon(s, polygon)) samples.push(s)
    }
  }
  const total = samples.length
  const pct = (k: number) => (total === 0 ? 100 : Math.round((100 * k) / total))
  const own = cameras.map(() => 0)
  let seen = 0
  for (const s of samples) {
    let any = false
    cameras.forEach((c, i) => {
      if (sees(polygon, polygon[c], s)) {
        own[i]++
        any = true
      }
    })
    if (any) seen++
  }
  return { percent: pct(seen), covered: seen === total, perCamera: own.map(pct) }
}
