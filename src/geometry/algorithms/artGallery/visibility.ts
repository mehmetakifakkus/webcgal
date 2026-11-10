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
/**
 * Relative slack along an edge for hits of a ray aimed exactly at a vertex (parameter
 * units): such a ray must stop at a vertex it passes through.
 */
const EDGE_TOL = 1e-9
/**
 * Absolute slack along an edge for side-ray hits (distance units). A side ray passes the
 * vertex it was cast beside at 1e-7·d (d its distance from the camera, ≥ 1e-3 for any
 * sensible input), so this slack has to stay far below that, or the ray would be stopped
 * at the vertex instead of passing it; it only has to absorb rounding (~1e-13 at canvas
 * scale).
 */
const SIDE_EDGE_SLACK = 1e-11
/** Minimal distance of a ray hit from the camera. */
const MIN_HIT = 1e-9
/** Consecutive output points closer than this are merged. */
const MERGE_TOL = 1e-6
/** An output point this close to the segment between its neighbours is dropped. */
const COLLINEAR_TOL = 1e-9

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
  const [lx, hx] = [Math.min(a.x, b.x) - GEOM_TOL, Math.max(a.x, b.x) + GEOM_TOL]
  const [ly, hy] = [Math.min(a.y, b.y) - GEOM_TOL, Math.max(a.y, b.y) + GEOM_TOL]
  for (let i = 0; i < n; i++) {
    const p = polygon[i]
    const q = polygon[(i + 1) % n]
    // bounding boxes apart: no contact (a cheap filter before the exact test)
    if (Math.max(p.x, q.x) < lx || Math.min(p.x, q.x) > hx || Math.max(p.y, q.y) < ly || Math.min(p.y, q.y) > hy) continue
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
 * edges at v never stop a ray); the hits sorted by angle form the boundary. Side rays
 * only count hits strictly on an edge, so one cast beside a vertex passes it. Points closer
 * than 1e-6 are merged and points on the segment between their neighbours dropped, which
 * keeps the result simple. O(n²).
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
      const p = castRay(polygon, o, d, delta !== 0)
      if (p) hits.push({ rel, p })
    }
  }
  hits.sort((s, t) => s.rel - t.rel)

  // Merge clusters of nearly equal points (side-ray hits next to a vertex hit), keeping a
  // polygon vertex where the cluster has one, and drop points lying on the segment between
  // their neighbours (several rays hitting one edge a few 1e-6 apart): both kinds of
  // near-degenerate edges would make the result fail a simplicity test. The camera stays first.
  const isVertex = (p: Pt) => polygon.some((q) => q.x === p.x && q.y === p.y)
  const out: Pt[] = [{ ...o }]
  for (const { p } of hits) {
    const last = out[out.length - 1]
    if (distance(last, p) <= MERGE_TOL) {
      if (out.length > 1 && !isVertex(last) && isVertex(p)) out[out.length - 1] = p
      continue
    }
    while (out.length > 2 && between(out[out.length - 2], out[out.length - 1], p)) out.pop()
    out.push(p)
  }
  while (out.length > 1 && distance(out[out.length - 1], o) <= MERGE_TOL) out.pop()
  while (out.length > 2 && between(out[out.length - 2], out[out.length - 1], o)) out.pop()
  return out
}

/** True when b lies on the segment ac, within COLLINEAR_TOL of it. */
function between(a: Pt, b: Pt, c: Pt): boolean {
  const r = subtract(c, a)
  const len = Math.hypot(r.x, r.y)
  if (len <= MERGE_TOL) return false
  const w = subtract(b, a)
  const u = dot(w, r) / (len * len)
  return u > 0 && u < 1 && Math.abs(crossVec(r, w)) / len <= COLLINEAR_TOL
}

/**
 * Nearest hit of the ray o + t·d (d a unit vector, t > 0) with the polygon boundary.
 * `side` marks a side ray, whose hits are accepted strictly (see SIDE_EDGE_SLACK).
 */
function castRay(polygon: Polygon, o: Pt, d: Pt, side: boolean): Pt | null {
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
    const slack = side ? SIDE_EDGE_SLACK / le : EDGE_TOL
    if (s < -slack || s > 1 + slack || t <= MIN_HIT) continue
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
