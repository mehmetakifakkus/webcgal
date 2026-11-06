import type { Pt } from '../../types'
import { GEOM_TOL, samePt } from '../../primitives'

// Teaching scale (<= ~30 segments): a sorted array with binary search,
// not the balanced tree from the book.

export type SweepEvent = { p: Pt; upper: number[] }

/** Sweep order: y descending, ties x ascending; y values within GEOM_TOL tie. */
function before(p: Pt, q: Pt): boolean {
  if (Math.abs(p.y - q.y) <= GEOM_TOL) return p.x < q.x
  return p.y > q.y
}

export class EventQueue {
  private events: SweepEvent[] = []

  /** Index of the first event not before p. */
  private lowerBound(p: Pt): number {
    let lo = 0
    let hi = this.events.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (before(this.events[mid].p, p)) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  /** Index of the event at p (within GEOM_TOL), or -1. */
  private find(p: Pt): number {
    const k = this.lowerBound(p)
    const near = (j: number) => Math.abs(this.events[j].p.y - p.y) <= GEOM_TOL
    for (let j = k; j < this.events.length && near(j); j++) {
      if (samePt(this.events[j].p, p)) return j
    }
    for (let j = k - 1; j >= 0 && near(j); j--) {
      if (samePt(this.events[j].p, p)) return j
    }
    return -1
  }

  /** Adds an event at p; `upperOf` records a segment whose upper endpoint is p. */
  insert(p: Pt, upperOf?: number): void {
    let j = this.find(p)
    if (j < 0) {
      j = this.lowerBound(p)
      this.events.splice(j, 0, { p: { x: p.x, y: p.y }, upper: [] })
    }
    const ev = this.events[j]
    if (upperOf !== undefined && !ev.upper.includes(upperOf)) ev.upper.push(upperOf)
  }

  popNext(): SweepEvent | undefined {
    return this.events.shift()
  }

  has(p: Pt): boolean {
    return this.find(p) >= 0
  }

  get size(): number {
    return this.events.length
  }

  toArray(): SweepEvent[] {
    return this.events.map((e) => ({ p: { ...e.p }, upper: [...e.upper] }))
  }
}
