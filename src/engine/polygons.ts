import paper from 'paper'
import svg from './assets/predefinedPolygons.svg?raw'
import { toPoint, type EngineContext } from './drawing'
import { getRandomInt } from './Points'
import type { Polygon, PolygonClass } from './Polygon'

/** Names of the polygons in predefinedPolygons.svg. */
export const PREDEFINED_POLYGONS = ['star', 'square', 'triangle_set', 'arbitrary1']

/**
 * A Polygon from predefinedPolygons.svg, centred at `position` (default
 * [250, 180]) and scaled by `scaleFactor`. Unknown names write an error line
 * to the output and return undefined. The polygon is not drawn yet.
 */
export function createPolygon(
  ctx: EngineContext,
  Polygon: PolygonClass,
  name: string,
  position?: paper.PointLike,
  scaleFactor?: number,
): Polygon | undefined {
  const root = ctx.scope.project.importSVG(svg, { insert: false })
  const group = typeof name === 'string' ? (root.children as unknown as Record<string, paper.Item>)[name] : undefined
  const shape = group?.children?.[0] as paper.Path | undefined
  if (!group || !shape || !PREDEFINED_POLYGONS.includes(name)) {
    ctx.output({
      kind: 'error',
      text: `createPolygon: unknown polygon '${String(name)}' (available: ${PREDEFINED_POLYGONS.join(', ')})`,
    })
    root.remove()
    return undefined
  }
  group.visible = true
  shape.visible = true
  group.position = toPoint(position ?? [250, 180])
  group.scale(scaleFactor || 1)

  const polygon = new Polygon(name)
  for (const seg of shape.segments) {
    // Segment points are local to the shape; map them up to the svg root.
    let p = seg.point
    for (let item: paper.Item | null = shape; item && item !== root; item = item.parent) p = item.matrix.transform(p)
    polygon.addPoint(p)
  }
  root.remove()
  return polygon
}

/** A random star-shaped hexagon around the view centre. The polygon is not drawn yet. */
export function createRandomPolygon(ctx: EngineContext, Polygon: PolygonClass): Polygon {
  const polygon = new Polygon('random')
  const count = 6
  const { width, height } = ctx.scope.view.size
  const origin = new paper.Point(width / 2, height / 2)
  for (let i = 0; i < count; i++)
    polygon.addPoint(origin.add(new paper.Point({ angle: (360 / count) * i, length: getRandomInt(10, 200) })))
  return polygon
}
