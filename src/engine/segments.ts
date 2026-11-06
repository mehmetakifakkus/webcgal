import paper from 'paper'
import { bruteForceIntersections as bruteForce } from '../geometry/algorithms/sweep/bruteForceIntersections'
import { findIntersections as sweep } from '../geometry/algorithms/sweep/findIntersections'
import { upperEndpoint } from '../geometry/primitives'
import type { IntersectionResult, Segment } from '../geometry/types'
import { hasPos, toPoint, toPt, type EngineContext, type PointInput } from './drawing'

/**
 * A segment as user code passes it: `{a, b}` or a pair `[a, b]`; endpoints are
 * paper Points, `{x, y}` or `[x, y]`.
 */
export type SegmentInput = { a: PointInput; b: PointInput } | [PointInput, PointInput]

/** IntersectionResult with paper Points, as user code gets it. */
export type PaperIntersectionResult = {
  points: { p: paper.Point; segments: number[] }[]
  overlaps: { a: paper.Point; b: paper.Point; segments: [number, number] }[]
}

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

/** Point, TextPoint, `{x, y}` or `[x, y]` with finite numbers. */
export function isPointInput(p: unknown): p is PointInput {
  if (p instanceof paper.Point || hasPos(p)) return true
  if (Array.isArray(p)) return p.length === 2 && p.every(isNum)
  return typeof p === 'object' && p !== null && isNum((p as { x?: unknown }).x) && isNum((p as { y?: unknown }).y)
}

/** Validates user input (`fn` names the API function in the message) and converts it. */
function toSegments(segments: unknown, fn: string): Segment[] {
  const fail = (why: string): never => {
    throw new Error(`${fn}: segments must be an array of {a, b} objects (${why})`)
  }
  if (!Array.isArray(segments)) return fail(`got ${segments === null ? 'null' : typeof segments}`)
  return segments.map((s: unknown, i) => {
    let a: unknown
    let b: unknown
    if (Array.isArray(s)) {
      if (s.length !== 2) fail(`segment ${i} is an array of length ${s.length}, not a pair [p, q]`)
      ;[a, b] = s
    } else if (typeof s === 'object' && s !== null) {
      ;({ a, b } = s as { a?: unknown; b?: unknown })
    } else fail(`segment ${i} is ${s === null ? 'null' : typeof s}`)
    if (a === undefined) fail(`segment ${i} has no 'a'`)
    if (b === undefined) fail(`segment ${i} has no 'b'`)
    if (!isPointInput(a)) fail(`segment ${i}: 'a' is not a point`)
    if (!isPointInput(b)) fail(`segment ${i}: 'b' is not a point`)
    return { a: toPt(a as PointInput), b: toPt(b as PointInput) }
  })
}

function toPaper(r: IntersectionResult): PaperIntersectionResult {
  const P = (q: { x: number; y: number }) => new paper.Point(q.x, q.y)
  return {
    points: r.points.map((x) => ({ p: P(x.p), segments: [...x.segments] })),
    overlaps: r.overlaps.map((o) => ({ a: P(o.a), b: P(o.b), segments: [o.segments[0], o.segments[1]] })),
  }
}

export const findIntersections = (segments: SegmentInput[]) => toPaper(sweep(toSegments(segments, 'findIntersections')))
export const bruteForceIntersections = (segments: SegmentInput[]) =>
  toPaper(bruteForce(toSegments(segments, 'bruteForceIntersections')))

/** The `Segments` helper object and `drawIntersections` for one run. */
export function createSegments(ctx: EngineContext) {
  const { scope } = ctx

  const Segments = {
    /** n random segments inside the canvas (10% margin), each at least `minLen` long. */
    createRandom(n: number, minLen = 40) {
      const { width, height } = scope.view.size
      const rand = (size: number) => size * (0.1 + 0.8 * Math.random())
      const point = () => new scope.Point(rand(width), rand(height))
      const out: { a: paper.Point; b: paper.Point }[] = []
      for (let i = 0; i < n; i++) {
        let a = point()
        let b = point()
        for (let tries = 0; a.getDistance(b) < minLen && tries < 1000; tries++) {
          a = point()
          b = point()
        }
        out.push({ a, b })
      }
      return out
    },
    /** Draws the segments (validated like findIntersections) as 2px black lines labelled s1, s2, … at their upper endpoints. */
    draw(segments: SegmentInput[]) {
      toSegments(segments, 'Segments.draw').forEach((s, i) => {
        const line = new scope.Path.Line({ from: toPoint(s.a), to: toPoint(s.b), strokeColor: 'black', strokeWidth: 2 })
        const u = upperEndpoint(s)
        // the layer is y-flipped: flip the label back so that it reads upright
        const label = new scope.PointText({
          matrix: new scope.Matrix(1, 0, 0, -1, u.x + 6, u.y + 6),
          content: 's' + (i + 1),
          fontSize: '14px',
          fillColor: 'black',
        })
        ctx.drawables.push(line, label)
      })
    },
  }

  /** Intersection points as red dots (r = 5), overlaps as green 5px lines. */
  function drawIntersections(result: { points: { p: PointInput }[]; overlaps: { a: PointInput; b: PointInput }[] }) {
    for (const o of result.overlaps)
      ctx.drawables.push(
        new scope.Path.Line({ from: toPoint(o.a), to: toPoint(o.b), strokeColor: 'green', strokeWidth: 5, strokeCap: 'round' }),
      )
    for (const x of result.points)
      ctx.drawables.push(new scope.Path.Circle({ center: toPoint(x.p), radius: 5, fillColor: 'red' }))
  }

  return { Segments, drawIntersections }
}
