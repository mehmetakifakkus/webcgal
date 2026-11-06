import type { Pt, Segment } from '../../types'
import { GEOM_TOL, isHorizontal, onSegment, xAtY } from '../../primitives'

// Teaching scale (<= ~30 segments): a sorted array with binary search,
// not the balanced tree from the book.

/**
 * Left-to-right order of the segments just below the sweep point p.
 * Rules, in order:
 * 1. x where the segment meets y = p.y (horizontal: p.x); x values within
 *    GEOM_TOL are equal.
 * 2. Among those tied (the segments through p): a horizontal segment goes
 *    after the non-horizontal ones.
 * 3. Then x at y = p.y - 1 (zero-length segment: p.x).
 * 4. Then the segment index.
 */
export function compareAt(segments: Segment[], p: Pt): (i: number, j: number) => number {
  const x0 = (s: Segment) => (isHorizontal(s) ? p.x : xAtY(s, p.y))
  const x1 = (s: Segment) => (isHorizontal(s) ? p.x : xAtY(s, p.y - 1))
  return (i, j) => {
    const s = segments[i]
    const t = segments[j]
    const d0 = x0(s) - x0(t)
    if (Math.abs(d0) > GEOM_TOL) return d0
    const hs = isHorizontal(s)
    const ht = isHorizontal(t)
    if (hs !== ht) return hs ? 1 : -1
    const d1 = x1(s) - x1(t)
    if (Math.abs(d1) > GEOM_TOL) return d1
    return i - j
  }
}

/** x of the segment relative to p; a horizontal segment not through p is clamped to its near end. */
function xRef(s: Segment, p: Pt): number {
  if (!isHorizontal(s)) return xAtY(s, p.y)
  return Math.min(Math.max(p.x, Math.min(s.a.x, s.b.x)), Math.max(s.a.x, s.b.x))
}

export class StatusStructure {
  private order: number[] = []

  constructor(private segments: Segment[]) {}

  insert(i: number, p: Pt): void {
    const cmp = compareAt(this.segments, p)
    let lo = 0
    let hi = this.order.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cmp(this.order[mid], i) < 0) lo = mid + 1
      else hi = mid
    }
    this.order.splice(lo, 0, i)
  }

  remove(i: number): void {
    const k = this.order.indexOf(i)
    if (k >= 0) this.order.splice(k, 1)
  }

  /** Segments in the status that contain p, in current left-to-right order. */
  findThrough(p: Pt): number[] {
    return this.order.filter((i) => onSegment(p, this.segments[i]))
  }

  /** Re-sorts only the block of segments through p; other positions stay. */
  reorderAt(p: Pt): void {
    const through = this.findThrough(p)
    if (through.length < 2) return
    const slots = through.map((i) => this.order.indexOf(i)).sort((a, b) => a - b)
    const sorted = [...through].sort(compareAt(this.segments, p))
    slots.forEach((slot, n) => (this.order[slot] = sorted[n]))
  }

  /** Rightmost segment strictly left of p (segments through p excluded). */
  leftOf(p: Pt): number | undefined {
    let found: number | undefined
    for (const i of this.order) {
      const s = this.segments[i]
      if (!onSegment(p, s) && xRef(s, p) < p.x) found = i
    }
    return found
  }

  /** Leftmost segment strictly right of p (segments through p excluded). */
  rightOf(p: Pt): number | undefined {
    for (const i of this.order) {
      const s = this.segments[i]
      if (!onSegment(p, s) && xRef(s, p) > p.x) return i
    }
    return undefined
  }

  leftNeighbor(i: number): number | undefined {
    const k = this.order.indexOf(i)
    return k > 0 ? this.order[k - 1] : undefined
  }

  rightNeighbor(i: number): number | undefined {
    const k = this.order.indexOf(i)
    return k >= 0 ? this.order[k + 1] : undefined
  }

  toArray(): number[] {
    return [...this.order]
  }
}
