import paper from 'paper'
import { convexHull as hullOf } from '../geometry/algorithms/convexHull'
import { dualLine, dualPoint, findStabber } from '../geometry/algorithms/duality'
import { isMonotone, monotoneDirections } from '../geometry/algorithms/monotone'
import { circleFrom2, circumcircle, smallestEnclosingDisk } from '../geometry/algorithms/smallestEnclosingDisk'
import { distance } from '../geometry/primitives'
import type { Circle, Pt } from '../geometry/types'
import {
  clearScreen,
  convertToRealCoord,
  drawCircle,
  drawCoordinateSystem,
  drawLine,
  drawLines,
  toPoint,
  toPt,
  type EngineContext,
  type PointInput,
} from './drawing'
import { createConsole, errorText, formatArgs, stackLine, type OutputLine } from './output'
import { createPolygonClass } from './Polygon'
import { createPoints, getRandomInt, shuffle } from './Points'
import { createPolygon, createRandomPolygon } from './polygons'
import { bruteForceIntersections, createSegments, findIntersections } from './segments'
import { createTriangulationDrawing, makeMonotone, triangulate } from './triangulation'
import { circumcircle as circumcircleApi, createDelaunayDrawing, delaunay } from './delaunay'
import { createVoronoiDrawing, voronoi, voronoiCells } from './voronoi'
import type { Scene } from './scene'
import { createTextPointClass, type TextPoint } from './TextPoint'
import { Vector } from './Vector'

/** paper.js names exposed to user code (besides `project`, `view`, `tool`, `paper`). */
export const PAPER_CLASSES = [
  'Point', 'Size', 'Rectangle', 'Matrix', 'Line', 'Segment', 'Curve', 'CurveLocation',
  'Item', 'Group', 'Layer', 'Shape', 'Path', 'CompoundPath', 'PathItem', 'PointText', 'TextItem',
  'Raster', 'SymbolDefinition', 'SymbolItem', 'Color', 'Gradient', 'GradientStop', 'Style',
  'Tool', 'Tween', 'Key',
] as const

/** Every name user code can use without importing it. The single list (spec §4). */
export const API_NAMES = [
  // legacy library
  'Points', 'TextPoint', 'Polygon', 'Vector', 'convexHull', 'isLeftTurn',
  'miniDisc', 'getCenterAndRadius2', 'getCenterAndRadius3', 'inCircle', 'drawCircle',
  'add', 'subtract', 'dotProduct', 'crossProduct', 'getRandomInt', 'range', 'shuffle',
  'drawLine', 'drawLines', 'drawCoordinateSystem', 'convertToRealCoord', 'clearScreen', 'clear',
  'createPolygon', 'createRandomPolygon', 'printLog', 'print', 'clearLog',
  'origin', 'drawables', 'getTextPoint', 'mouseDown', 'loop',
  // legacy globals that sample code assigns without `var`
  'polygon', 'colors',
  // geometry versions (take {x, y} or TextPoint)
  'dualLine', 'dualPoint', 'findStabber', 'isMonotone', 'monotoneDirections', 'smallestEnclosingDisk',
  'convexHullPts',
  // line segment intersection (segments are {a, b} or [a, b]; result points are paper Points)
  'Segments', 'findIntersections', 'bruteForceIntersections', 'drawIntersections',
  // polygon triangulation (polygons are a Polygon or an array of points; indices refer to the input)
  'triangulate', 'makeMonotone', 'drawDiagonals', 'drawTriangles',
  // Delaunay triangulation (points are an array of points; indices refer to the input)
  'delaunay', 'drawTriangulation', 'circumcircle',
  // Voronoi diagram (points are an array of points; site indices refer to the input)
  'voronoi', 'drawVoronoi', 'voronoiCells',
  // environment
  'console', 'document',
  // paper.js
  ...PAPER_CLASSES, 'project', 'view', 'tool', 'paper',
] as const

export type ApiName = (typeof API_NAMES)[number]

export type ApiOptions = {
  /** The run's tool (exposed as `tool`); defaults to the scope's active tool. */
  tool?: paper.Tool | null
  /** Called by clearLog() and console.clear(). */
  clearOutput?: () => void
  /** Canvases `document.getElementById` should find even when they are not in the DOM. */
  extraCanvases?: Record<string, HTMLCanvasElement>
  /** Called when an event handler throws, after the error line was written. */
  onHandlerError?: (e: unknown) => void
  /** Lines before the user's first line in the compiled function (for handler error lines). */
  lineOffset?: number
  /** Runs a handler call; the runtime uses it to collect paper scopes the handler creates. */
  trackScopes?: (call: () => void) => void
}

/** Circle with a paper.Point centre (the legacy circle shape). */
type LegacyCircle = { center: paper.Point; radius: number }
const legacyCircle = (c: Circle): LegacyCircle => ({ center: new paper.Point(c.center.x, c.center.y), radius: c.radius })

function scopedDocument(extra: Record<string, HTMLCanvasElement>): Document {
  return new Proxy(document, {
    get(target, prop) {
      if (prop === 'getElementById') return (id: string) => extra[id] ?? target.getElementById(id)
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

/**
 * Wraps an event handler: activates the scope first and writes an error line
 * (with the user's line number when known) instead of throwing.
 */
export function createGuard(
  scope: paper.PaperScope,
  output: (l: OutputLine) => void,
  options: Pick<ApiOptions, 'lineOffset' | 'onHandlerError' | 'trackScopes'> = {},
): EngineContext['guard'] {
  const track = options.trackScopes ?? ((call: () => void) => call())
  return (fn) =>
    function (this: unknown, ...args) {
      scope.activate()
      try {
        track(() => void fn.apply(this, args))
      } catch (e) {
        const line = stackLine(e, options.lineOffset ?? 0)
        output({ kind: 'error', text: errorText(e) + (line ? ` (line ${line})` : '') })
        options.onHandlerError?.(e)
      } finally {
        // the handler may have activated a scope of its own
        scope.activate()
      }
    }
}

export function buildApi(
  scene: Scene,
  output: (l: OutputLine) => void,
  options: ApiOptions = {},
): Record<ApiName, unknown> {
  const scope = scene.paper
  const clearOutput = options.clearOutput ?? (() => {})

  const ctx: EngineContext = {
    scope,
    drawables: [],
    textPoints: [],
    output,
    guard: createGuard(scope, output, options),
  }

  const TextPoint = createTextPointClass(ctx)
  const Polygon = createPolygonClass(ctx, TextPoint)
  const Points = createPoints(ctx, TextPoint)
  const { Segments, drawIntersections } = createSegments(ctx)
  const { drawDiagonals, drawTriangles } = createTriangulationDrawing(ctx)
  const { drawTriangulation } = createDelaunayDrawing(ctx)
  const { drawVoronoi } = createVoronoiDrawing(ctx)
  const pts = (points: PointInput[]) => points.map(toPt)

  const getCenterAndRadius2 = (p1: PointInput, p2: PointInput) => legacyCircle(circleFrom2(toPt(p1), toPt(p2)))
  const getCenterAndRadius3 = (p1: PointInput, p2: PointInput, p3: PointInput) => {
    const [a, b, c] = [toPt(p1), toPt(p2), toPt(p3)]
    const cc = circumcircle(a, b, c)
    if (cc) return legacyCircle(cc)
    // Collinear: the circle on the farthest pair encloses all three.
    const pairs: [Pt, Pt][] = [[a, b], [a, c], [b, c]]
    const far = pairs.reduce((m, pr) => (distance(pr[0], pr[1]) > distance(m[0], m[1]) ? pr : m))
    return legacyCircle(circleFrom2(far[0], far[1]))
  }

  const print = (...args: unknown[]) => output({ kind: 'log', text: formatArgs(args) })
  const subtract = (p1: PointInput, p2: PointInput) => toPoint(p1).subtract(toPoint(p2))
  const crossProduct = (v1: Pt, v2: Pt) => v1.x * v2.y - v2.x * v1.y
  const clear = () => clearScreen(ctx)

  const api: Record<ApiName, unknown> = {
    Points,
    TextPoint,
    Polygon,
    Vector,
    /** Hull as TextPoints from the leftmost point clockwise, closed (last === first). */
    convexHull(points: TextPoint[]) {
      const tagged = points.map((tp) => ({ ...toPt(tp), tp }))
      const hull = hullOf(tagged) as typeof tagged
      const out = hull.map((h) => h.tp)
      if (out.length) out.push(out[0])
      return out
    },
    /** True when the last three points of the list make a left turn (legacy convexHull.js). */
    isLeftTurn(list: PointInput[]) {
      const last = list.length - 1
      return crossProduct(subtract(list[last], list[last - 1]), subtract(list[last - 1], list[last - 2])) < 0
    },
    miniDisc: (points: PointInput[]) => legacyCircle(smallestEnclosingDisk(pts(points))),
    getCenterAndRadius2,
    getCenterAndRadius3,
    inCircle: (center: PointInput, radius: number, p: PointInput) => distance(toPt(center), toPt(p)) - radius,
    drawCircle: (circle: { center: PointInput; radius: number }) => drawCircle(ctx, circle),
    add: (p1: PointInput, p2: PointInput) => toPoint(p1).add(toPoint(p2)),
    subtract,
    dotProduct: (v1: Pt, v2: Pt) => v1.x * v2.x + v1.y * v2.y,
    crossProduct,
    getRandomInt,
    range(start: number, stop: number, step = 1) {
      const a = [start]
      for (let b = start; b < stop; ) a.push((b += step))
      return a
    },
    shuffle,
    drawLine: (p1: PointInput, p2: PointInput) => drawLine(ctx, p1, p2),
    drawLines: (points: PointInput[]) => drawLines(ctx, points),
    drawCoordinateSystem: () => drawCoordinateSystem(ctx),
    convertToRealCoord,
    clearScreen: clear,
    clear,
    createPolygon: (name: string, position?: paper.PointLike, scaleFactor?: number) =>
      createPolygon(ctx, Polygon, name, position, scaleFactor),
    createRandomPolygon: () => createRandomPolygon(ctx, Polygon),
    printLog: print,
    print,
    clearLog: clearOutput,
    origin: new paper.Point(0, 0),
    drawables: ctx.drawables,
    getTextPoint(name: string) {
      const named = (tp: (typeof ctx.textPoints)[number]) => tp.path?.name ?? '_p' + tp.id
      return ctx.textPoints.find((tp) => named(tp) === name) ?? ctx.textPoints.find((tp) => named(tp).startsWith(name))
    },
    mouseDown(_point: TextPoint) {},
    loop(_event: unknown) {},
    polygon: null,
    colors: ['red', 'blue', 'yellow', 'magenta', 'green'],
    dualLine: (p: PointInput) => dualLine(toPt(p)),
    dualPoint,
    findStabber: (segments: [PointInput, PointInput][]) => findStabber(segments.map(([a, b]) => [toPt(a), toPt(b)])),
    isMonotone: (polygon: PointInput[] | { points: PointInput[] }, angleDeg: number) =>
      isMonotone(pts(Array.isArray(polygon) ? polygon : polygon.points), angleDeg),
    monotoneDirections: (polygon: PointInput[] | { points: PointInput[] }) =>
      monotoneDirections(pts(Array.isArray(polygon) ? polygon : polygon.points)),
    smallestEnclosingDisk: (points: PointInput[]) => smallestEnclosingDisk(pts(points)),
    convexHullPts: (points: PointInput[]) => hullOf(pts(points)),
    Segments,
    findIntersections,
    bruteForceIntersections,
    drawIntersections,
    triangulate,
    makeMonotone,
    drawDiagonals,
    drawTriangles,
    delaunay,
    drawTriangulation,
    circumcircle: circumcircleApi,
    voronoi,
    drawVoronoi,
    voronoiCells,
    console: createConsole(output, clearOutput),
    document: options.extraCanvases ? scopedDocument(options.extraCanvases) : document,
    ...(Object.fromEntries(PAPER_CLASSES.map((n) => [n, scope[n as keyof paper.PaperScope]])) as Record<
      (typeof PAPER_CLASSES)[number],
      unknown
    >),
    project: scope.project,
    view: scope.view,
    tool: options.tool === undefined ? scope.tool : options.tool,
    paper,
  }
  return api
}
