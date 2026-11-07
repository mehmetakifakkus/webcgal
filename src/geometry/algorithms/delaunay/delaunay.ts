import type { DelaunayResult, Pt, Triangle } from '../../types'
import { circumcenter, distance, inCircle, samePt } from '../../primitives'
import { convexHull } from '../convexHull'
import type { DelaunayState, DelPatch, DelRecorder } from './delaunayState'
import { TriangleMesh } from './mesh'
import { highestIndex, orient, P_MINUS_1, P_MINUS_2 } from './symbolic'

/** Seeded PRNG returning numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Seeded random permutation (Fisher-Yates, mulberry32) of all indices 0..n-1 except p0. */
export function defaultOrder(n: number, p0: number, seed = n): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) if (i !== p0) out.push(i)
  const rng = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Drops p0, invalid and repeated indices, then appends the missing indices in ascending order. */
function normalizeOrder(n: number, p0: number, order: number[]): number[] {
  const seen = new Set<number>([p0])
  const out: number[] = []
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) continue
    seen.add(i)
    out.push(i)
  }
  for (let i = 0; i < n; i++) if (!seen.has(i)) out.push(i)
  return out
}

/**
 * Legality test of de Berg et al. §9.3 for edge (i, j) of the CCW triangle (p_r, i, j), with k
 * the vertex across it (triangle (j, i, k)). All four real: illegal iff p_r is strictly inside
 * the circle through i, j, k (on the circle is legal). Otherwise the book's rule: legal iff
 * min(k, p_r) < min(i, j); the symbolic indices are negative (p-2 < p-1 < every real index).
 *
 * Convexity guard: when the book's rule asks for a flip, the edge is illegal only if the
 * quadrilateral p_r, i, k, j is strictly convex (symbolic-aware `orient`). With the symbolic
 * placement of `symbolic.ts` the bare rule can ask for impossible flips, e.g. for the unit
 * square after v2, v1: edge p-2–v2 with k = v3. For an edge with one symbolic endpoint and
 * k, p_r real the guarded test equals the limit in-circle test (the circle through two real
 * points and a point at infinity becomes a half-plane).
 */
export function isIllegal(points: Pt[], pr: number, i: number, j: number, k: number): boolean {
  if (pr >= 0 && i >= 0 && j >= 0 && k >= 0) return inCircle(points[i], points[j], points[k], points[pr]) === 1
  if (Math.min(k, pr) < Math.min(i, j)) return false
  return isConvexQuad(points, pr, i, k, j)
}

/** True when a, b, c, d (CCW, from two CCW triangles (a, b, d) and (d, b, c)) is strictly convex. */
function isConvexQuad(points: Pt[], a: number, b: number, c: number, d: number): boolean {
  return orient(points, a, b, c) === 1 && orient(points, c, d, a) === 1
}

const label = (i: number) => (i === P_MINUS_1 ? 'p₋₁' : i === P_MINUS_2 ? 'p₋₂' : `v${i + 1}`)
const edgeLabel = (a: number, b: number) => `${label(a)}–${label(b)}`

/** CCW hull indices; for fewer than three hull vertices (collinear input) all points along the line. */
function hullIndices(points: Pt[]): number[] {
  const ch = convexHull(points)
  if (ch.length < 3)
    return points.map((_, i) => i).sort((a, b) => points[a].x - points[b].x || points[a].y - points[b].y)
  // convexHull runs clockwise from the leftmost point; keep that start, reverse the direction
  const idx = ch.map((q) => points.findIndex((p) => samePt(p, q)))
  return [idx[0], ...idx.slice(1).reverse()]
}

/**
 * Randomized incremental Delaunay triangulation (de Berg et al. §9.3). Points are inserted in
 * `order` (normalized: p0 removed, invalid/repeated indices dropped, missing ones appended in
 * ascending order; default `defaultOrder(n, p0)`). `record` receives one call per step; the
 * insert step "(k of n)" counts p0 as point 1, so the first inserted point is "2 of n".
 *
 * Stack entries are (triangle, e) with v[e] = p_r, i.e. the edge opposite p_r in a triangle of
 * the star of p_r. A flip only replaces the tested triangle and its neighbor across the link,
 * which is not in the star, so pending entries stay alive. The recorded stack shows the edges
 * [v[e+1], v[e+2]], top at the end. Edges are pushed so that they are popped in the order of
 * the pseudocode's LegalizeEdge calls.
 */
export function delaunay(points: Pt[], order?: number[], record?: DelRecorder): DelaunayResult {
  const n = points.length
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) if (samePt(points[i], points[j])) throw new Error('points must be distinct')
  if (n === 0) return { triangles: [], edges: [], hull: [], flips: 0 }

  const p0 = highestIndex(points)
  const ord = normalizeOrder(n, p0, order ?? defaultOrder(n, p0))
  const mesh = new TriangleMesh(points)
  mesh.init(p0, P_MINUS_1, P_MINUS_2)
  const inserted = [p0]
  const stack: { t: number; e: number }[] = []
  let flips = 0
  let phase: DelaunayState['phase'] = 'init'
  let current: number | undefined

  const stackEdge = ({ t, e }: { t: number; e: number }): [number, number] => {
    const v = mesh.tris[t].v
    return [v[(e + 1) % 3], v[(e + 2) % 3]]
  }
  const emit = (line: number, description: string, patch: DelPatch = {}, triangles?: DelaunayState['triangles']) => {
    if (!record) return
    record(line, description, patch, {
      phase,
      p0,
      order: ord,
      inserted,
      triangles: triangles ?? mesh.snapshot(),
      stack: stack.map(stackEdge),
      flips,
      current,
    })
  }
  /** Pushes entries given in pseudocode call order (first one ends on top). */
  const push = (entries: { t: number; e: number }[]) => {
    for (let x = entries.length - 1; x >= 0; x--) stack.push(entries[x])
    return entries.map((en) => edgeLabel(...stackEdge(en)))
  }

  emit(3, `p₀ = ${label(p0)} is the lexicographically highest point; start with the triangle p₀ p₋₁ p₋₂`)
  emit(4, `Insertion order: ${ord.length ? ord.map(label).join(', ') : 'none'}`)

  ord.forEach((pr, idx) => {
    phase = 'insert'
    current = pr
    emit(5, `Insert p_r = ${label(pr)} (${idx + 2} of ${n})`)
    const loc = mesh.locate(pr)
    const tv = [...mesh.tris[loc.t].v] as [number, number, number]
    if (loc.edge === undefined) {
      emit(6, `${label(pr)} lies inside triangle (${tv.map(label).join(', ')})`, { located: { t: tv } })
      const ts = mesh.split3(loc.t, pr)
      inserted.push(pr)
      emit(8, 'Split into three triangles')
      const names = push(ts.map((t) => ({ t, e: 2 })))
      emit(9, `Push edges ${names.join(', ')} onto the stack`)
    } else {
      const a = tv[loc.edge], b = tv[(loc.edge + 1) % 3]
      emit(6, `${label(pr)} lies on edge ${edgeLabel(a, b)}`, { located: { t: tv, edge: [a, b] } })
      // [a,p,c], [p,b,c], [b,p,d], [p,a,d]; pseudocode order: a–d, d–b, b–c, c–a
      const [t1, t2, u1, u2] = mesh.split4(loc.t, loc.edge, pr)
      inserted.push(pr)
      emit(11, 'Split into four triangles')
      const names = push([{ t: u2, e: 0 }, { t: u1, e: 1 }, { t: t2, e: 0 }, { t: t1, e: 1 }])
      emit(12, `Push edges ${names.join(', ')} onto the stack`)
    }

    phase = 'legalize'
    while (stack.length > 0) {
      const entry = stack.pop()!
      const T = mesh.tris[entry.t]
      if (!T.alive || T.v[entry.e] !== pr) throw new Error('delaunay: stale stack entry')
      const [i, j] = stackEdge(entry)
      const o = mesh.opposite(entry.t, entry.e)
      if (!o) {
        // an edge of the initial triangle p0 p-1 p-2: always legal
        emit(16, `Test edge ${edgeLabel(i, j)}: legal by the symbolic rule`)
        continue
      }
      const k = o.vertex
      const illegal = isIllegal(points, pr, i, j, k)
      const patch: DelPatch = { testing: { edge: [i, j], opposite: k, legal: !illegal } }
      if (i >= 0 && j >= 0 && k >= 0) {
        const center = circumcenter(points[pr], points[i], points[j])
        if (center) patch.circle = { center, radius: distance(center, points[pr]) }
        const onCircle = inCircle(points[i], points[j], points[k], points[pr]) === 0
        const where = illegal ? 'inside' : onCircle ? 'on' : 'outside'
        const verdict = illegal ? 'illegal' : 'legal'
        emit(16, `Test edge ${edgeLabel(i, j)} (opposite ${label(k)}): ${label(k)} is ${where} the circumcircle → ${verdict}`, patch)
      } else {
        const bookIllegal = !(Math.min(k, pr) < Math.min(i, j))
        const why = illegal
          ? 'illegal by the symbolic rule'
          : bookIllegal
            ? 'legal, since the quadrilateral is not convex'
            : 'legal by the symbolic rule'
        emit(16, `Test edge ${edgeLabel(i, j)}: ${why}`, patch)
      }
      if (!illegal) continue
      const f = mesh.flip(entry.t, entry.e)
      flips++
      emit(18, `Flip ${edgeLabel(i, j)} to ${edgeLabel(pr, k)}`, { flipped: { from: [i, j], to: [pr, k] } })
      // a = [p_r, i, k], b = [p_r, k, j]; edge 0 of each is opposite p_r
      const names = push([{ t: f.a, e: 0 }, { t: f.b, e: 0 }])
      emit(19, `Push ${names[0]} and ${names[1]} onto the stack`)
    }
  })

  const triangles: Triangle[] = mesh.realTriangles()
  phase = 'cleanup'
  current = undefined
  const realSnapshot = () => triangles.map((v) => ({ v: [...v] as Triangle, alive: true }))
  emit(13, 'Remove p₋₁ and p₋₂ with all their edges', {}, realSnapshot())
  const edges = mesh
    .edges()
    .filter(([a, b]) => a >= 0 && b >= 0)
    .sort((p, q) => p[0] - q[0] || p[1] - q[1])
  phase = 'done'
  emit(14, `Done: ${triangles.length} triangles, ${flips} flips`, {}, realSnapshot())
  return { triangles, edges, hull: hullIndices(points), flips }
}
