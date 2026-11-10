import type { Circle, Pt } from '../../types'
import { EPS, distance } from '../../primitives'
import { mulberry32 } from '../delaunay/delaunay'
import type { Frame, MdPatch, MdRecorder, MiniDiscState } from './miniDiscState'

export type MiniDiscResult = {
  disk: Circle | null
  /** Indices of the points that define `disk` (2 or 3; 1 for n = 1; none for n = 0). */
  boundary: number[]
  /** Number of "is p in D?" checks at all levels. */
  tests: number
  /** Number of times a procedure's D changed (initial discs excluded). */
  updates: number
}

export const label = (i: number) => `v${i + 1}`

/** Smallest circle having a and b as diameter endpoints. */
export function circleFrom2(a: Pt, b: Pt): Circle {
  return {
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    radius: distance(a, b) / 2,
  }
}

/** Circle through three points (closed form); null when they are collinear. */
export function circumcircle(a: Pt, b: Pt, c: Pt): Circle | null {
  const bx = b.x - a.x
  const by = b.y - a.y
  const cx = c.x - a.x
  const cy = c.y - a.y
  const d = 2 * (bx * cy - by * cx)
  const scale = Math.hypot(bx, by) * Math.hypot(cx, cy)
  if (Math.abs(d) <= 2 * EPS * scale) return null
  const b2 = bx * bx + by * by
  const c2 = cx * cx + cy * cy
  const ux = (cy * b2 - by * c2) / d
  const uy = (bx * c2 - cx * b2) / d
  return { center: { x: a.x + ux, y: a.y + uy }, radius: Math.hypot(ux, uy) }
}

/** Scale-relative "p ∈ D" test of spec §2.1. */
const inside = (c: Circle, p: Pt) => distance(c.center, p) <= c.radius * (1 + 1e-9) + 1e-9

/** Seeded random permutation (Fisher-Yates, mulberry32) of 0..n-1. */
export function defaultOrder(n: number, seed = n): number[] {
  const out = Array.from({ length: n }, (_, i) => i)
  const rng = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Drops invalid and repeated indices, then appends the missing indices in ascending order;
 * without an order, `defaultOrder(n)`.
 */
export function normalizeOrder(n: number, order?: number[]): number[] {
  if (!order) return defaultOrder(n)
  const seen = new Set<number>()
  const out: number[] = []
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) continue
    seen.add(i)
    out.push(i)
  }
  for (let i = 0; i < n; i++) if (!seen.has(i)) out.push(i)
  return out
}

/** A disc together with the indices of the points that define it. */
type Disc = { circle: Circle; def: number[] }

const copyCircle = (c: Circle): Circle => ({ center: { ...c.center }, radius: c.radius })
const copyFrame = (f: Frame): Frame => ({ ...f, fixed: [...f.fixed], disk: copyCircle(f.disk) })
const fmtR = (r: number) => r.toFixed(1)

/** "v1", "v1 and v2", "v1, v2 and v3". */
function listLabels(ids: number[]): string {
  const ls = ids.map(label)
  return ls.length <= 1 ? ls.join('') : `${ls.slice(0, -1).join(', ')} and ${ls[ls.length - 1]}`
}

/**
 * Smallest enclosing disc by the randomized incremental algorithm of de Berg et al. §4.7,
 * run literally: MiniDisc, MiniDiscWithPoint and MiniDiscWith2Points all work on prefixes of
 * the single permutation `order` (normalized; default `defaultOrder(n)`), nothing is
 * reshuffled. `record` receives one call per step (lines of the spec §3.1 pseudocode).
 *
 * The update counted for an inner call (lines 6 / 13) is recorded with its return step
 * (lines 14 / 21); the outer frame takes the returned disc right after that step.
 */
export function minidisc(points: Pt[], order?: number[], record?: MdRecorder): MiniDiscResult {
  const n = points.length
  const ord = normalizeOrder(n, order)
  const pt = (pos: number) => points[ord[pos]]
  const stack: Frame[] = []
  let phase: MiniDiscState['phase'] = 'init'
  let tests = 0
  let updates = 0

  const emit = (line: number, description: string, patch: MdPatch = {}) => {
    if (!record) return
    record(line, description, patch, {
      phase,
      order: ord,
      stack: stack.map(copyFrame),
      disk: stack.length ? copyCircle(stack[stack.length - 1].disk) : null,
      tests,
      updates,
    })
  }
  const done = (d: Disc): MiniDiscResult => {
    const boundary = [...d.def].sort((a, b) => a - b)
    phase = 'done'
    emit(
      7,
      `Done: smallest disc through ${listLabels(boundary)} (r = ${fmtR(d.circle.radius)}), ${tests} tests, ${updates} updates`,
    )
    return { disk: copyCircle(d.circle), boundary, tests, updates }
  }
  /** Lines 4 / 11 / 18: is the point at `pos` in the frame's disc? */
  const test = (line: number, f: Frame, pos: number): boolean => {
    const p = ord[pos]
    const ins = inside(f.disk, points[p])
    tests++
    emit(
      line,
      ins ? `${label(p)} is inside D → keep D` : `${label(p)} is outside D → it must lie on the boundary of the new disc`,
      { current: p, testing: { point: p, inside: ins } },
    )
    return ins
  }
  const enter = (f: Frame) => {
    stack.push(f)
    return f
  }
  /** Lines 14 / 21: the D change of the caller (line 6 / 13) is counted here. */
  const leave = (line: number, to: string, d: Disc): Disc => {
    updates++
    emit(line, `Return D (r = ${fmtR(d.circle.radius)}) to ${to}`, { returned: copyCircle(d.circle) })
    stack.pop()
    return d
  }

  /** Lines 15–21: smallest disc of order[0..prefix) with q1, q2 on its boundary. */
  const with2Points = (prefix: number, q1: number, q2: number): Disc => {
    let d: Disc = { circle: circleFrom2(points[q1], points[q2]), def: [q1, q2] }
    const f = enter({ proc: 'With2Points', fixed: [q2, q1], prefix, index: -1, disk: d.circle })
    emit(16, `D₀: smallest disc with ${label(q1)} and ${label(q2)} on its boundary`)
    for (let k = 0; k < prefix; k++) {
      f.index = k
      if (test(18, f, k)) continue
      const p = ord[k]
      d = circleFrom3(points, q1, q2, p)
      f.disk = d.circle
      updates++
      emit(20, `D: disc through ${label(q1)}, ${label(q2)} and ${label(p)}`, { current: p, newDisk: copyCircle(d.circle) })
    }
    return leave(21, 'MiniDiscWithPoint', d)
  }

  /** Lines 8–14: smallest disc of order[0..prefix) with q on its boundary. */
  const withPoint = (prefix: number, q: number): Disc => {
    let d: Disc = { circle: circleFrom2(points[q], pt(0)), def: [q, ord[0]] }
    const f = enter({ proc: 'WithPoint', fixed: [q], prefix, index: 0, disk: d.circle })
    emit(9, `D₁: smallest disc with ${label(q)} and ${label(ord[0])} on its boundary`)
    for (let j = 1; j < prefix; j++) {
      f.index = j
      if (test(11, f, j)) continue
      const p = ord[j]
      emit(13, `Call MiniDiscWith2Points with q₁ = ${label(p)}, q₂ = ${label(q)}`, { current: p })
      d = with2Points(j, p, q)
      f.disk = d.circle
    }
    return leave(14, 'MiniDisc', d)
  }

  // Lines 0–7: MiniDisc(P)
  emit(1, `Order: ${ord.length ? ord.map(label).join(', ') : 'none'}`)
  phase = 'run'
  if (n === 0) {
    phase = 'done'
    emit(7, 'Done: no points')
    return { disk: null, boundary: [], tests: 0, updates: 0 }
  }
  if (n === 1) {
    const d: Disc = { circle: { center: { ...pt(0) }, radius: 0 }, def: [ord[0]] }
    enter({ proc: 'MiniDisc', fixed: [], prefix: 1, index: 0, disk: d.circle })
    return done(d)
  }
  let d: Disc = { circle: circleFrom2(pt(0), pt(1)), def: [ord[0], ord[1]] }
  const f = enter({ proc: 'MiniDisc', fixed: [], prefix: n, index: 1, disk: d.circle })
  emit(2, `D₂: smallest disc of ${label(ord[0])} and ${label(ord[1])}`)
  for (let i = 2; i < n; i++) {
    f.index = i
    if (test(4, f, i)) continue
    const p = ord[i]
    emit(6, `Call MiniDiscWithPoint with q = ${label(p)}`, { current: p })
    d = withPoint(i, p)
    f.disk = d.circle
  }
  return done(d)
}

/**
 * Line 20: circle through q1, q2 and p. The book shows the three points are never collinear
 * for distinct points; with duplicates they can be, and then the diameter disc of the
 * farthest pair is used (as the earlier implementation did).
 */
function circleFrom3(points: Pt[], q1: number, q2: number, p: number): Disc {
  const cc = circumcircle(points[q1], points[q2], points[p])
  if (cc) return { circle: cc, def: [q1, q2, p] }
  const pairs: [number, number][] = [[q1, q2], [q1, p], [q2, p]]
  let best = pairs[0]
  for (const pr of pairs)
    if (distance(points[pr[0]], points[pr[1]]) > distance(points[best[0]], points[best[1]])) best = pr
  return { circle: circleFrom2(points[best[0]], points[best[1]]), def: best }
}
