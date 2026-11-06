import type { IntersectionPoint, IntersectionResult, Overlap, Pt, Segment } from '../../types'
import {
  GEOM_TOL,
  lowerEndpoint,
  samePt,
  segmentIntersection,
  upperEndpoint,
} from '../../primitives'
import { EventQueue } from './eventQueue'
import { StatusStructure } from './status'
import type { Recorder, SweepPatch, SweepState } from './sweepState'

// de Berg et al., Computational Geometry, ch. 2.1: FindIntersections,
// HandleEventPoint and FindNewEvent. `record` lines index the pseudocode of
// Task 4 (SEGMENT_INTERSECTION_PSEUDOCODE).

const name = (i: number) => `s${i + 1}`
const names = (ids: number[]) => ids.map(name).join(', ')
const fmt = (p: Pt) => `(${Math.round(p.x)}, ${Math.round(p.y)})`
const asc = (ids: Iterable<number>) => [...ids].sort((a, b) => a - b)

export function runSweep(segments: Segment[], record?: Recorder): IntersectionResult {
  const queue = new EventQueue()
  const status = new StatusStructure(segments)
  const points: IntersectionPoint[] = []
  const overlaps: Overlap[] = []
  const overlapPairs = new Set<string>()
  const zeroLength = segments.map((s) => samePt(s.a, s.b))
  let sweepY: number | null = null
  let phase: SweepState['phase'] = 'init'

  const rec = (line: number, description: string, patch: SweepPatch = {}) =>
    record?.(line, description, patch, { queue, status, sweepY, phase, points, overlaps })

  // FindIntersections
  segments.forEach((s, i) => {
    queue.insert(upperEndpoint(s), i)
    queue.insert(lowerEndpoint(s))
  })
  rec(1, 'Insert all endpoints into the event queue')
  rec(2, 'Initialize an empty status structure T')

  /** Overlap extension: report the common part of s_i and s_j once per pair. */
  const reportOverlap = (i: number, j: number, a: Pt, b: Pt, current: Pt) => {
    const [lo, hi] = i < j ? [i, j] : [j, i]
    const k = `${lo},${hi}`
    const testing: [number, number] = [i, j]
    if (overlapPairs.has(k)) {
      rec(19, `Test ${name(i)} and ${name(j)}: collinear and overlapping, overlap already reported`, {
        current,
        testing,
      })
      rec(21, `${name(i)} and ${name(j)} are collinear and overlap`, { current, testing })
      return
    }
    overlapPairs.add(k)
    const o: Overlap = { a: { ...a }, b: { ...b }, segments: [lo, hi] }
    overlaps.push(o)
    rec(
      19,
      `Test ${name(i)} and ${name(j)}: collinear and overlapping → report overlap ${fmt(a)}–${fmt(b)}`,
      { current, testing },
    )
    rec(21, `${name(i)} and ${name(j)} are collinear and overlap`, { current, testing })
    rec(22, `Report overlap ${fmt(a)}–${fmt(b)}: ${name(lo)}, ${name(hi)}`, {
      current,
      testing,
      reported: o,
    })
  }

  // FindNewEvent(sl, sr, p)
  const findNewEvent = (sl: number, sr: number, p: Pt) => {
    const testing: [number, number] = [sl, sr]
    const r = segmentIntersection(segments[sl], segments[sr])
    if (r?.kind === 'overlap') {
      reportOverlap(sl, sr, r.a, r.b, p)
      return
    }
    const pre = `Test ${name(sl)} and ${name(sr)}`
    if (r) {
      const q = r.p
      const ahead =
        q.y < p.y - GEOM_TOL || (Math.abs(q.y - p.y) <= GEOM_TOL && q.x > p.x + GEOM_TOL)
      if (ahead) {
        if (queue.has(q)) {
          rec(19, `${pre}: their intersection ${fmt(q)} is already in the event queue`, {
            current: p,
            testing,
          })
          return
        }
        rec(19, `${pre}: they intersect at ${fmt(q)} below the sweep line → new event`, {
          current: p,
          testing,
        })
        queue.insert(q)
        rec(20, `Insert ${fmt(q)} into the event queue`, {
          current: p,
          testing,
          newEvent: { x: q.x, y: q.y },
        })
        return
      }
    }
    rec(19, `${pre}: no intersection below the sweep line`, { current: p, testing })
  }

  // HandleEventPoint(p)
  const handleEventPoint = (p: Pt, upper: number[]) => {
    const U = asc(upper)
    rec(7, `U = {${names(U)}}`, { current: p, U })

    const through = status.findThrough(p)
    // A zero-length segment's only event is both its upper and lower endpoint.
    const L = asc([
      ...through.filter((i) => samePt(lowerEndpoint(segments[i]), p)),
      ...U.filter((i) => zeroLength[i]),
    ])
    const C = asc(through.filter((i) => !L.includes(i)))
    rec(8, `U = {${names(U)}}, L = {${names(L)}}, C = {${names(C)}}`, { current: p, U, L, C })

    const all = asc(new Set([...U, ...L, ...C]))
    if (all.length >= 2) {
      const ip: IntersectionPoint = { p: { x: p.x, y: p.y }, segments: all }
      points.push(ip)
      rec(10, `Report intersection at ${fmt(p)}: ${names(all)}`, {
        current: p,
        U,
        L,
        C,
        reported: ip,
      })
    }

    for (const i of [...L, ...C]) status.remove(i)
    rec(11, 'Delete L ∪ C from T', { current: p })

    const UC = asc(new Set([...U, ...C])).filter((i) => !zeroLength[i])
    for (const i of UC) status.insert(i, p)
    status.reorderAt(p)
    rec(12, 'Insert U ∪ C into T', { current: p })

    // Overlap extension: collinear segments through p are tied in T and the
    // book's neighbour tests never pair them, so check every pair here.
    for (let a = 0; a < UC.length; a++) {
      for (let b = a + 1; b < UC.length; b++) {
        const i = UC[a]
        const j = UC[b]
        if (!U.includes(i) && !U.includes(j)) continue
        const r = segmentIntersection(segments[i], segments[j])
        if (r?.kind === 'overlap') reportOverlap(i, j, r.a, r.b, p)
      }
    }

    if (UC.length === 0) {
      const sl = status.leftOf(p)
      const sr = status.rightOf(p)
      if (sl !== undefined && sr !== undefined) findNewEvent(sl, sr, p)
    } else {
      const order = status.toArray().filter((i) => UC.includes(i))
      const leftmost = order[0]
      const rightmost = order[order.length - 1]
      const sl = status.leftNeighbor(leftmost)
      if (sl !== undefined) findNewEvent(sl, leftmost, p)
      const sr = status.rightNeighbor(rightmost)
      if (sr !== undefined) findNewEvent(rightmost, sr, p)
    }
  }

  phase = 'event'
  for (let ev = queue.popNext(); ev; ev = queue.popNext()) {
    sweepY = ev.p.y
    rec(4, `Next event p = ${fmt(ev.p)}`, { current: { ...ev.p } })
    handleEventPoint(ev.p, ev.upper)
  }

  phase = 'done'
  sweepY = null
  rec(
    3,
    `The queue is empty: done. Found ${points.length} intersection point(s) and ${overlaps.length} overlap(s)`,
  )
  return { points, overlaps }
}

export function findIntersections(segments: Segment[]): IntersectionResult {
  return runSweep(segments)
}
