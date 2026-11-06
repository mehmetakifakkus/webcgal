import paper from 'paper'

type Extendable = { extend(props: Record<string, unknown>): unknown }

/**
 * The legacy `Vector`: a paper.Point subclass (built with paper's own
 * `Point.extend`, so PaperScript operators keep working on it).
 */
export const Vector = (paper.Point as unknown as Extendable).extend({
  _class: 'Vector',
  _readIndex: true,
  deneme() {
    return 'hey'
  },
  /** Draws a small circle and a label at the vector's tip (in the active scope). */
  draw(this: paper.Point) {
    new paper.Path.Circle({ center: [this.x, this.y], radius: 10, strokeColor: 'red' })
    new paper.PointText({
      matrix: new paper.Matrix(1, 0, 0, -1, this.x + 3, this.y + 5),
      fontSize: '16px',
      fillColor: 'black',
      content: ' ' + 1,
    })
  },
}) as typeof paper.Point
