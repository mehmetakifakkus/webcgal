import type { Scene } from '../engine/scene'
import { randomPointSet } from '../geometry/algorithms/delaunay/verify'
import { cellPolygon } from '../geometry/algorithms/voronoi/cells'
import { CANVAS_BOX, clipLine, clipPolygonToBox, clipRay, clipSegment } from '../geometry/algorithms/voronoi/clip'
import { VORONOI_PRESETS } from '../geometry/algorithms/voronoi/presets'
import { VORONOI_PSEUDOCODE } from '../geometry/algorithms/voronoi/pseudocode'
import { label, vertexLabel } from '../geometry/algorithms/voronoi/voronoi'
import type { VoronoiState } from '../geometry/algorithms/voronoi/voronoiState'
import { voronoiSteps } from '../geometry/algorithms/voronoi/voronoiSteps'
import type { Pt, VoronoiCell, VoronoiEdge, VoronoiInput, VoronoiResult } from '../geometry/types'
import { cssColor } from './cssColor'
import type { Panel, PlayerModule } from './types'

const WIDTH = 775
const HEIGHT = 360
const DISTINCT_MESSAGE = 'Points must be distinct'
/** Points closer than this (canvas units) count as coincident, so that a drag can actually hit the check. */
const MIN_DISTANCE = 2
/** Vertex labels are drawn only up to this many vertices (more would clutter the canvas). */
const MAX_VERTEX_LABELS = 20
const VERTEX_HALF = 2.5
const CELL_COLORS = ['#8ecae6', '#ffb703', '#90be6d', '#f4a261', '#cdb4db', '#a8dadc', '#e9c46a', '#b5e48c']

const siteEdge = ([a, b]: [number, number]) => `${label(a)}–${label(b)}`
const isUnbounded = (c: VoronoiCell) => !!c.rays || c.vertices.length < 3

function validate({ points }: VoronoiInput): string | null {
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < MIN_DISTANCE) return DISTINCT_MESSAGE
  return null
}

/** The step state seen as the (partial) result `cellPolygon` expects. */
const resultOf = (s: VoronoiState): VoronoiResult => ({
  vertices: s.vertices,
  edges: s.edges,
  lines: s.lines,
  cells: s.cells,
  triangles: s.triangles,
  vertexOfTriangle: s.vertexOfTriangle as number[],
})

/** The drawable part of a Voronoi edge or ray inside the canvas, or null. */
function clipEdge(s: VoronoiState, e: VoronoiEdge): [Pt, Pt] | null {
  const a = s.vertices[e.a]
  if (e.b !== null) return clipSegment(a, s.vertices[e.b], CANVAS_BOX)
  return e.dir ? clipRay(a, e.dir, CANVAS_BOX) : null
}

function drawSites(scene: Scene, points: Pt[]) {
  const P = scene.paper
  const ink = cssColor('--canvas-ink', '#1c1e21')
  for (const q of points) new P.Path.Circle({ center: new P.Point(q.x, q.y), radius: 4, fillColor: ink })
}

const voronoiPlayer: PlayerModule<VoronoiState, VoronoiInput> = {
  computeSteps: (input, mode) => voronoiSteps(input.points, mode !== 'voronoi-only'),
  modes: [
    { id: 'with-delaunay', label: 'With Delaunay' },
    { id: 'voronoi-only', label: 'Voronoi only' },
  ],
  validate,
  pseudocode: VORONOI_PSEUDOCODE,
  hint: 'Drag the points to change the input. Keys: ← → to step, Space to play or pause.',
  randomInput: () => ({ points: randomPointSet(Math.random, 12, { x0: 93, y0: 43, x1: 682, y1: 317 }, 25) }),
  presets: VORONOI_PRESETS.map(({ name, points }) => ({ name, input: { points } })),
  handles: (input) => input.points.map((p) => ({ x: p.x, y: p.y })),
  moveHandle: (input, k, p) => ({ points: input.points.map((q, i) => (i === k ? { x: p.x, y: p.y } : { x: q.x, y: q.y })) }),
  canvas: { width: WIDTH, height: HEIGHT },

  renderInvalid(scene, input) {
    scene.paper.activate()
    scene.clear()
    drawSites(scene, input.points)
  },

  render(scene, step, input) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const s = step.state
    const points = input.points
    const c = {
      delaunay: cssColor('--vor-delaunay', '#c7cad1'),
      edge: cssColor('--vor-edge', '#1a5fb4'),
      vertex: cssColor('--vor-vertex', '#1a5fb4'),
      current: cssColor('--vor-current', '#e66100'),
      fresh: cssColor('--vor-new', '#26a269'),
      skip: cssColor('--vor-skip', '#c01c28'),
      ink: cssColor('--canvas-ink', '#1c1e21'),
    }
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    const withAlpha = (color: string, a: number) => {
      const col = new P.Color(color)
      col.alpha = a
      return col
    }
    const segment = (ends: [Pt, Pt] | null, color: string, width: number, dashed = false) => {
      if (!ends) return
      new P.Path({
        segments: ends.map(pt),
        strokeColor: color,
        strokeWidth: width,
        strokeCap: 'round',
        ...(dashed ? { dashArray: [6, 4] } : {}),
      })
    }
    const sites = (e: [number, number]): [Pt, Pt] => [points[e[0]], points[e[1]]]
    const fillTriangle = (ti: number) =>
      new P.Path({ segments: s.triangles[ti].map((i) => pt(points[i])), closed: true, fillColor: withAlpha(c.current, 0.25) })
    const text = (q: Pt, content: string, color: string, size: number) =>
      new P.PointText({ matrix: new P.Matrix(1, 0, 0, -1, q.x + 7, q.y + 7), content, fontSize: size, fillColor: color })

    // Delaunay triangulation underneath (mode)
    if (s.showDelaunay) for (const e of s.delaunayEdges) segment(sites(e), c.delaunay, 1)

    // cells (clipped to the canvas), under the edges so that the edges stay on top
    if (s.phase === 'cells' || s.phase === 'done') {
      const result = resultOf(s)
      for (const cell of s.cells) {
        const poly = cellPolygon(points, result, cell, CANVAS_BOX)
        if (poly.length < 3) continue
        const color = cssColor(`--vor-cell-${cell.site % 8}`, CELL_COLORS[cell.site % 8])
        new P.Path({ segments: poly.map(pt), closed: true, fillColor: withAlpha(color, cell.site === s.currentSite ? 0.4 : 0.18) })
      }
    }

    // the triangle whose circumcenter is taken, the ones merged with it, and its circle
    if (s.merged) s.merged.filter((t) => t !== s.currentTriangle).forEach(fillTriangle)
    if (s.currentTriangle !== undefined) fillTriangle(s.currentTriangle)
    if (s.circle)
      new P.Path.Circle({ center: pt(s.circle.center), radius: s.circle.radius, strokeColor: c.current, strokeWidth: 1, dashArray: [5, 4] })

    // Voronoi edges, rays and (collinear input) bisector lines
    for (const e of s.edges) segment(clipEdge(s, e), c.edge, 1.5)
    for (const l of s.lines) segment(clipLine(l.p, l.dir, CANVAS_BOX), c.edge, 1.5)

    // the Delaunay edge being processed and what it produced
    if (s.currentEdge) segment(sites(s.currentEdge), s.skipped ? c.skip : c.current, 3, !!s.skipped)
    if (s.newEdge !== undefined) segment(clipEdge(s, s.edges[s.newEdge]), c.fresh, 3)
    if (s.currentLine !== undefined) {
      const l = s.lines[s.currentLine]
      segment(clipLine(l.p, l.dir, CANVAS_BOX), c.fresh, 3)
    }

    // Voronoi vertices: squares clipped to the canvas, labelled when there are few
    const labelled = s.vertices.length <= MAX_VERTEX_LABELS
    s.vertices.forEach((v, k) => {
      const square = clipPolygonToBox(
        [
          { x: v.x - VERTEX_HALF, y: v.y - VERTEX_HALF },
          { x: v.x + VERTEX_HALF, y: v.y - VERTEX_HALF },
          { x: v.x + VERTEX_HALF, y: v.y + VERTEX_HALF },
          { x: v.x - VERTEX_HALF, y: v.y + VERTEX_HALF },
        ],
        CANVAS_BOX,
      )
      if (square.length < 3) return
      new P.Path({ segments: square.map(pt), closed: true, fillColor: c.vertex })
      if (labelled) text(v, vertexLabel(k), c.vertex, 12)
    })

    // sites last, so they stay on top (and match handles(input) for dragging)
    points.forEach((q, i) => text(q, label(i), c.ink, 14))
    drawSites(scene, points)
  },

  panels(step): Panel[] {
    const s = step.state
    const current = s.currentTriangle !== undefined ? s.vertexOfTriangle[s.currentTriangle] : null
    const created = step.line === 3 ? s.vertices.length - 1 : -1
    const vertices = s.vertices.map((_, k) => ({
      text: `${vertexLabel(k)} ← ${s.vertexOfTriangle
        .flatMap((v, ti) => (v === k ? [s.triangles[ti].map(label).join(' ')] : []))
        .join(', ')}`,
      highlight: k === created ? ('new' as const) : k === current ? ('active' as const) : undefined,
    }))
    const edges = [
      ...s.edges.map((e, k) => ({
        text: `${siteEdge(e.sites)} → ${e.b === null ? `${vertexLabel(e.a)} → ∞` : `${vertexLabel(e.a)}–${vertexLabel(e.b)}`}`,
        highlight: k === s.newEdge ? ('new' as const) : undefined,
      })),
      ...(s.skipped && s.currentEdge ? [{ text: `${siteEdge(s.currentEdge)} → (skipped)`, highlight: 'testing' as const }] : []),
      ...s.lines.map((l, k) => ({
        text: `${siteEdge(l.sites)} → bisector`,
        highlight: k === s.currentLine ? ('new' as const) : undefined,
      })),
    ]
    // the cell of the current site is the one built in this step
    const cells = s.cells.map((cell) => {
      const names = cell.vertices.map(vertexLabel).join(' ')
      return {
        text: `${label(cell.site)}: ${isUnbounded(cell) ? (names ? `∞ ${names} ∞` : '∞ ∞') : names}`,
        highlight: cell.site === s.currentSite ? ('active' as const) : undefined,
      }
    })
    return [
      { title: 'Vertices', empty: 'No vertices yet', rows: vertices },
      { title: 'Edges', empty: 'No edges yet', rows: edges },
      { title: 'Cells', empty: 'No cells yet', rows: cells },
    ]
  },
}

export default voronoiPlayer
