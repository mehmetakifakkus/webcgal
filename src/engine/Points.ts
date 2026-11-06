import { clearScreen, drawLine, drawLines, type EngineContext, type PointInput } from './drawing'
import type { TextPoint, TextPointClass } from './TextPoint'

export function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min
}

/** Random permutation; the input is not changed. */
export function shuffle<T>(a: T[]): T[] {
  const temp = a.slice()
  const result: T[] = []
  for (let i = temp.length; i; i--) result.push(temp.splice(Math.floor(Math.random() * i), 1)[0])
  return result
}

/** The legacy `Points` helper object for one run. */
export function createPoints(ctx: EngineContext, TextPoint: TextPointClass) {
  const { scope } = ctx
  const created: TextPoint[] = []
  let count = 0

  const redraw = (points: TextPoint[]) => {
    for (const p of points) p.draw()
  }
  /** Stable index of a point, so its animation does not change when the array is sorted. */
  const indexOf = (p: TextPoint, i: number) => {
    const k = created.indexOf(p)
    return k < 0 ? i : k
  }

  const Points = {
    /** n random points in [min, 0.8 * max) per axis (max defaults to the view size). */
    createRandom(n: number, minX?: number, maxX?: number, minY?: number, maxY?: number) {
      const w = maxX || scope.view.size.width
      const h = maxY || scope.view.size.height
      const out: TextPoint[] = []
      for (let i = 0; i < n; i++) {
        const tp = new TextPoint(getRandomInt(minX || 0.1 * w, 0.8 * w), getRandomInt(minY || 0.1 * h, 0.8 * h))
        out.push(tp)
        created.push(tp)
      }
      return out
    },
    /** Sorts in place by x, clears the screen and redraws the points. */
    sortX(points: TextPoint[]) {
      points.sort((a, b) => a.pos.x - b.pos.x)
      clearScreen(ctx)
      redraw(points)
      return points
    },
    /** Sorts in place by y, clears the screen and redraws the points. */
    sortY(points: TextPoint[]) {
      points.sort((a, b) => a.pos.y - b.pos.y)
      clearScreen(ctx)
      redraw(points)
      return points
    },
    drawPoints(points: TextPoint[]) {
      redraw(points)
    },
    shuffle,
    drawLine: (p1: PointInput, p2: PointInput) => drawLine(ctx, p1, p2),
    drawLines: (points: PointInput[]) => drawLines(ctx, points),
    /** One animation frame: jitter every point, redraw, then return `fn(points)`. */
    animateVibrate<R>(points: TextPoint[], fn?: (points: TextPoint[]) => R) {
      clearScreen(ctx)
      const offset = new scope.Point(2, 1).multiply([Math.sin(count / 30), Math.sin(count / 40)])
      for (const p of points) p.pos = p.pos.add(offset.multiply(getRandomInt(-5, 5)))
      redraw(points)
      const result = fn ? fn(points) : undefined
      count++
      return result
    },
    /** One animation frame: move every point along its own smooth path, redraw, then return `fn(points)`. */
    animateRandom<R>(points: TextPoint[], fn?: (points: TextPoint[]) => R) {
      clearScreen(ctx)
      points.forEach((p, i) => {
        const k = (indexOf(p, i) + 10) / 3
        p.pos = p.pos.add(new scope.Point(2, 1).multiply([Math.sin((k * count) / 170), Math.sin((k * count) / 90)]))
      })
      redraw(points)
      const result = fn ? fn(points) : undefined
      count++
      return result
    },
  }
  return Points
}
