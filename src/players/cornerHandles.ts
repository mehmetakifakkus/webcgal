import type { Box } from '../geometry/algorithms/voronoi/clip'
import type { Pt } from '../geometry/types'

/** Least distance between the two corner handles in each direction (see cornerHandles). */
export const CORNER_GAP = 1

/** `p` moved into the box `B`. */
export const clampToBox = (B: Box, p: Pt): Pt => ({
  x: Math.min(B.x1, Math.max(B.x0, p.x)),
  y: Math.min(B.y1, Math.max(B.y0, p.y)),
})

/**
 * The two corner handles of the query rectangle in the box `B`. StepPlayer grabs the last handle
 * among equally near ones, so when the rectangle has collapsed (zero width and/or height) the
 * lower-left handle is reported 1 unit down / left of the upper-right one in each collapsed
 * direction; the nearer handle then wins and either corner can be grabbed again. At the box's
 * lower-left edge the upper-right one moves up / right instead. The query itself is unchanged.
 */
export function cornerHandles(query: Box, B: Box): [Pt, Pt] {
  const lo = clampToBox(B, { x: query.x0, y: query.y0 })
  const hi = clampToBox(B, { x: query.x1, y: query.y1 })
  for (const a of ['x', 'y'] as const) {
    if (hi[a] - lo[a] >= CORNER_GAP) continue
    if (hi[a] - CORNER_GAP >= (a === 'x' ? B.x0 : B.y0)) lo[a] = hi[a] - CORNER_GAP
    else hi[a] = lo[a] + CORNER_GAP
  }
  return [lo, hi]
}

/**
 * The query with its lower-left (`upper` false) or upper-right corner moved to `q`. The dragged
 * corner stops at the opposite one (which stays put), so a drag keeps its handle index and
 * x0 ≤ x1, y0 ≤ y1 hold; a zero-width or zero-height rectangle is valid.
 */
export function moveCorner(query: Box, upper: boolean, q: Pt): Box {
  const { x0, y0, x1, y1 } = query
  return upper ? { x0, y0, x1: Math.max(q.x, x0), y1: Math.max(q.y, y0) } : { x0: Math.min(q.x, x1), y0: Math.min(q.y, y1), x1, y1 }
}

/** What a handle index stands for: point `point` of the input, or corner 0 (lower-left) or 1 (upper-right). */
export type HandleRef = { point: number } | { corner: 0 | 1 }

/**
 * The handles of a player with points and a query rectangle, in index order: the `n` points when
 * the mode has a build phase (`points`), then the two corners when it has a query phase
 * (`corners`). Both handles(input, mode) and moveHandle(input, index, p, mode) read their indices
 * from this list, so an index means the same handle to both.
 */
export function handleRefs(n: number, { points, corners }: { points: boolean; corners: boolean }): HandleRef[] {
  const refs: HandleRef[] = points ? Array.from({ length: n }, (_, i) => ({ point: i })) : []
  if (corners) refs.push({ corner: 0 }, { corner: 1 })
  return refs
}
