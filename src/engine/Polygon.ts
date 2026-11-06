import paper from 'paper'
import { clearScreen, flipY, toPoint, type EngineContext, type PointInput } from './drawing'
import type { TextPoint, TextPointClass } from './TextPoint'

/** Builds the legacy `Polygon` class for one run: TextPoint corners, draggable as a whole. */
export function createPolygonClass(ctx: EngineContext, TextPoint: TextPointClass) {
  const { scope } = ctx

  class Polygon {
    name: string
    points: TextPoint[] = []
    path: paper.Path | null = null

    constructor(name?: string) {
      this.name = String(name ?? '')
    }

    addPoint(p: PointInput) {
      const tp = new TextPoint(p)
      tp.polygon = this
      this.points.push(tp)
      return tp
    }

    /** Moves every corner by `delta` (layer coordinates) and redraws. */
    changePosition(delta: paper.PointLike) {
      const d = toPoint(delta)
      for (const p of this.points) p.pos = p.pos.add(d)
      this.draw()
    }

    /** Clears the screen (legacy behaviour), then draws the corners and the outline. */
    draw() {
      clearScreen(ctx)
      for (const p of this.points) p.draw()
      const path = new scope.Path({
        name: 'polygon_' + this.name,
        fillColor: 'white',
        strokeColor: 'black',
        strokeWidth: 2,
        closed: true,
        segments: this.points.map((p) => p.pos),
      })
      path.sendToBack()
      path.data.polygon = this
      path.onMouseDrag = ctx.guard((event: paper.MouseEvent) => this.mouseDragEvent(event))
      ctx.drawables.push(path)
      this.path = path
    }

    /** Called while the outline is dragged; assign your own to replace the default move. */
    mouseDragEvent(event: paper.MouseEvent) {
      this.changePosition(flipY(event.delta))
    }

    sort() {
      this.points.sort((a, b) => a.pos.x - b.pos.x)
    }
  }

  return Polygon
}

export type PolygonClass = ReturnType<typeof createPolygonClass>
export type Polygon = InstanceType<PolygonClass>
