import paper from 'paper'
import { flipY, toPoint, type EngineContext, type PointInput } from './drawing'

/** The owner a TextPoint redraws after being dragged (a Polygon). */
export type Redrawable = { draw(): void }

/**
 * Builds the legacy `TextPoint` class for one run: a labelled, draggable point.
 * `new TextPoint(x, y)` or `new TextPoint(point)`; the id counter starts at 0.
 */
export function createTextPointClass(ctx: EngineContext) {
  const { scope } = ctx

  class TextPoint {
    /** Next id (legacy: `TextPoint.id`). */
    static id = 0

    id: number
    pos: paper.Point
    path: paper.Path | null = null
    label: paper.PointText | null = null
    /** Set by Polygon.addPoint; dragging the point redraws the polygon. */
    polygon?: Redrawable

    constructor(x?: unknown, y?: unknown) {
      this.id = TextPoint.id++
      if (y === undefined) this.pos = x instanceof TextPoint ? x.pos.clone() : new scope.Point(x as paper.PointLike)
      else this.pos = new scope.Point(x as number, y as number)
      ctx.textPoints.push(this)
      this.draw()
    }

    /** (Re)draws the point and its id label. */
    draw() {
      this.path?.remove()
      this.label?.remove()
      const { x, y } = this.pos
      this.label = new scope.PointText({
        matrix: new scope.Matrix(1, 0, 0, -1, x + 3, y + 5),
        fontSize: '16px',
        fillColor: 'black',
        content: ' ' + this.id,
      })
      this.path = new scope.Path.Circle({ name: '_p' + this.id, center: this.pos, radius: 5, fillColor: 'black' })
      this.path.data.textPoint = this
      this.path.onMouseDrag = ctx.guard((event: paper.MouseEvent) => this.mouseDragEvent(event))
      ctx.drawables.push(this.label, this.path)
    }

    /** Called while the point is dragged; assign your own to replace the default move. */
    mouseDragEvent(event: paper.MouseEvent) {
      this.pos = this.pos.add(flipY(event.delta))
      if (this.polygon) this.polygon.draw()
      else this.draw()
    }

    /** Compat (R4): sample code calls `p1.add(p2)` on TextPoints. Returns a paper.Point. */
    add(other: PointInput) {
      return this.pos.add(toPoint(other))
    }

    /** Compat (R4): returns `this.pos - other` as a paper.Point. */
    subtract(other: PointInput) {
      return this.pos.subtract(toPoint(other))
    }

    toString() {
      return `${this.path ? this.path.name : '_p' + this.id} ${this.pos}`
    }
  }

  return TextPoint
}

export type TextPointClass = ReturnType<typeof createTextPointClass>
export type TextPoint = InstanceType<TextPointClass>
