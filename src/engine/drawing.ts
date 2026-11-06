import paper from 'paper'
import type { Pt } from '../geometry/types'
import type { OutputLine } from './output'

/** Something with a position: a TextPoint (`pos`) or anything paper.Point accepts. */
export type PointInput = { pos: paper.Point } | paper.PointLike

/** Per-run state shared by the legacy API objects. */
export type EngineContext = {
  scope: paper.PaperScope
  /** Items removed by clearScreen() (lines, circles, points, labels...). */
  drawables: paper.Item[]
  /** Every TextPoint created in this run, in creation order. */
  textPoints: { id: number; path: paper.Path | null; pos: paper.Point }[]
  output: (l: OutputLine) => void
  /** Wraps an event handler: activates the scope and reports errors to the output. */
  guard<A extends unknown[]>(fn: (...args: A) => unknown): (...args: A) => void
}

export const hasPos = (p: unknown): p is { pos: paper.Point } =>
  typeof p === 'object' && p !== null && (p as { pos?: unknown }).pos instanceof paper.Point

export function toPoint(p: PointInput): paper.Point {
  if (hasPos(p)) return p.pos
  return new paper.Point(p as paper.PointLike)
}

export function toPt(p: PointInput): Pt {
  const q = toPoint(p)
  return { x: q.x, y: q.y }
}

/** Point with the y component negated: converts view deltas into the flipped layer. */
export const flipY = (p: paper.Point) => new paper.Point(p.x, -p.y)

export function clearScreen(ctx: EngineContext) {
  for (const item of ctx.drawables.splice(0)) item.remove()
}

export function drawLine(ctx: EngineContext, p1: PointInput, p2: PointInput) {
  const line = new ctx.scope.Path.Line({ from: toPoint(p1), to: toPoint(p2), strokeColor: 'black', strokeWidth: 2 })
  ctx.drawables.push(line)
  return line
}

export function drawLines(ctx: EngineContext, points: PointInput[]) {
  for (let i = 0; i < points.length - 1; i++) drawLine(ctx, points[i], points[i + 1])
}

export function drawCircle(ctx: EngineContext, circle: { center: PointInput; radius: number }) {
  const c = new ctx.scope.Path.Circle({
    name: 'circle',
    center: toPoint(circle.center),
    radius: circle.radius,
    strokeColor: 'black',
  })
  ctx.drawables.push(c)
  return c
}

/** Grid cell (unit) to layer coordinates, as in the legacy drawCoordinateSystem.js. */
export const convertToRealCoord = (p: PointInput) => toPoint(p).multiply(50)

/** Axes through the origin and a dashed 50px grid. Not part of `drawables`. */
export function drawCoordinateSystem(ctx: EngineContext) {
  const { Path, PointText, Matrix, Point } = ctx.scope
  new Path.Circle({ center: [0, 0], radius: 5, fillColor: 'black' })
  new PointText({ fontSize: '14px', fillColor: 'black', content: '(0,0)', matrix: new Matrix(1, 0, 0, -1, 10, 10) })
  new Path.Line({ name: 'x-coord', from: [-400, 0], to: [1000, 0], strokeColor: 'black', strokeWidth: 2 })
  new Path.Line({ name: 'y-coord', from: [0, -400], to: [0, 420], strokeColor: 'black', strokeWidth: 2 })
  const grid = { name: 'coord', strokeColor: 'black', strokeWidth: 1, dashArray: [1, 2] }
  for (let i = 0; i <= 10; i++)
    new Path.Line({ ...grid, from: convertToRealCoord(new Point(0, i)), to: convertToRealCoord(new Point(20, i)) })
  for (let i = 0; i <= 20; i++)
    new Path.Line({ ...grid, from: convertToRealCoord(new Point(i, 0)), to: convertToRealCoord(new Point(i, 10)) })
}
