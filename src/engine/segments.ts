import paper from 'paper'
import { bruteForceIntersections as bruteForce } from '../geometry/algorithms/sweep/bruteForceIntersections'
import { findIntersections as sweep } from '../geometry/algorithms/sweep/findIntersections'
import { upperEndpoint } from '../geometry/primitives'
import type { IntersectionResult, Segment } from '../geometry/types'
import { toPoint, toPt, type EngineContext, type PointInput } from './drawing'

/** A segment as user code passes it: endpoints are paper Points or `{x, y}`. */
export type SegmentInput = { a: PointInput; b: PointInput }

/** IntersectionResult with paper Points, as user code gets it. */
export type PaperIntersectionResult = {
  points: { p: paper.Point; segments: number[] }[]
  overlaps: { a: paper.Point; b: paper.Point; segments: [number, number] }[]
}

const toSegments = (segments: SegmentInput[]): Segment[] => segments.map((s) => ({ a: toPt(s.a), b: toPt(s.b) }))

function toPaper(r: IntersectionResult): PaperIntersectionResult {
  const P = (q: { x: number; y: number }) => new paper.Point(q.x, q.y)
  return {
    points: r.points.map((x) => ({ p: P(x.p), segments: [...x.segments] })),
    overlaps: r.overlaps.map((o) => ({ a: P(o.a), b: P(o.b), segments: [o.segments[0], o.segments[1]] })),
  }
}

export const findIntersections = (segments: SegmentInput[]) => toPaper(sweep(toSegments(segments)))
export const bruteForceIntersections = (segments: SegmentInput[]) => toPaper(bruteForce(toSegments(segments)))

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
    /** Draws the segments as 2px black lines labelled s1, s2, … at their upper endpoints. */
    draw(segments: SegmentInput[]) {
      segments.forEach((s, i) => {
        const line = new scope.Path.Line({ from: toPoint(s.a), to: toPoint(s.b), strokeColor: 'black', strokeWidth: 2 })
        const u = upperEndpoint({ a: toPt(s.a), b: toPt(s.b) })
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
