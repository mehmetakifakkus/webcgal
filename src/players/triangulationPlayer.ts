import { TRIANGULATION_PRESETS } from '../geometry/algorithms/triangulation/presets'
import { TRIANGULATION_PSEUDOCODE } from '../geometry/algorithms/triangulation/pseudocode'
import { ensureCCW, isSimple, signedArea } from '../geometry/algorithms/triangulation/polygon'
import { triangulationSteps } from '../geometry/algorithms/triangulation/triangulationSteps'
import type { TriangulationState } from '../geometry/algorithms/triangulation/triangulationState'
import { randomStarPolygon } from '../geometry/algorithms/triangulation/verify'
import type { Diagonal, Polygon, Pt } from '../geometry/types'
import { cssColor } from './cssColor'
import type { Panel, PlayerModule } from './types'

const WIDTH = 775
const HEIGHT = 360
const INVALID_MESSAGE = 'The polygon must be simple (no crossing edges)'

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const vname = (i: number) => `v${i + 1}`

/**
 * Valid = simple and counter-clockwise. A drag keeps the vertex order, so the orientation can only
 * flip through a self-intersection (rejected by isSimple) or by turning the whole polygon inside out
 * without crossing, which isSimple still accepts: signedArea < 0 gives the same message so the
 * player reverts and the steps always see a CCW polygon. O(n²), cheap enough for every mouse move.
 */
const validate = (poly: Polygon) => (isSimple(poly) && signedArea(poly) >= 0 ? null : INVALID_MESSAGE)

/** Triangles of a triangulated polygon: mutually adjacent vertex triples (outerplanar, so all are faces). */
function trianglesOf(n: number, diagonals: Diagonal[]): [number, number, number][] {
  const adj = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const link = (a: number, b: number) => {
    adj[a][b] = adj[b][a] = true
  }
  for (let i = 0; i < n; i++) link(i, (i + 1) % n)
  for (const [a, b] of diagonals) link(a, b)
  const out: [number, number, number][] = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (adj[i][j]) for (let k = j + 1; k < n; k++) if (adj[j][k] && adj[i][k]) out.push([i, j, k])
  return out
}

function drawHandles(scene: Parameters<PlayerModule<TriangulationState, Polygon>['render']>[0], poly: Polygon) {
  const P = scene.paper
  const ink = cssColor('--canvas-ink', '#1c1e21')
  for (const q of poly) new P.Path.Circle({ center: new P.Point(q.x, q.y), radius: 4, fillColor: ink })
}

const triangulationPlayer: PlayerModule<TriangulationState, Polygon> = {
  computeSteps: (poly, mode) => triangulationSteps(poly, (mode ?? 'full') as 'full' | 'partition' | 'triangulate'),
  modes: [
    { id: 'full', label: 'Full' },
    { id: 'partition', label: 'Partition only' },
    { id: 'triangulate', label: 'Triangulation only' },
  ],
  dimmedLines: (mode) => (mode === 'partition' ? range(29, 40) : mode === 'triangulate' ? range(0, 28) : []),
  validate,
  pseudocode: TRIANGULATION_PSEUDOCODE,
  hint: 'Drag the vertices to change the polygon (it must stay simple). Keys: ← → to step, Space to play or pause.',
  randomInput: () => randomStarPolygon(Math.random, 8 + Math.floor(Math.random() * 5), 387, 180, 60, 150),
  presets: TRIANGULATION_PRESETS.map(({ name, polygon }) => ({ name, input: polygon })),
  handles: (poly) => poly.map((p) => ({ x: p.x, y: p.y })),
  moveHandle: (poly, k, p) => poly.map((q, i) => (i === k ? { x: p.x, y: p.y } : { x: q.x, y: q.y })),
  canvas: { width: WIDTH, height: HEIGHT },

  renderInvalid(scene, poly) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const bad = cssColor('--tri-invalid', '#c01c28')
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]
      new P.Path({ segments: [pt(a), pt(b)], strokeColor: bad, strokeWidth: 2, strokeCap: 'round' })
    })
    drawHandles(scene, poly)
  },

  render(scene, step, input) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const s = step.state
    // step indices refer to the CCW polygon
    const poly = ensureCCW(input).polygon
    const n = poly.length
    const c = {
      start: cssColor('--tri-start', '#1a5fb4'),
      end: cssColor('--tri-end', '#1a5fb4'),
      split: cssColor('--tri-split', '#e66100'),
      merge: cssColor('--tri-merge', '#9141ac'),
      regular: cssColor('--tri-regular', '#1c1e21'),
      partition: cssColor('--tri-partition', '#c01c28'),
      diagonal: cssColor('--tri-diagonal', '#26a269'),
      sweep: cssColor('--tri-sweep', '#6b7280'),
      active: cssColor('--tri-active', '#4f46e5'),
      ink: cssColor('--canvas-ink', '#1c1e21'),
    }
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    const line = (a: Pt, b: Pt, color: string, width: number, dash?: number[]) =>
      new P.Path({ segments: [pt(a), pt(b)], strokeColor: color, strokeWidth: width, strokeCap: 'round', dashArray: dash })
    const withAlpha = (color: string, a: number) => {
      const col = new P.Color(color)
      col.alpha = a
      return col
    }
    const fillPoly = (idx: number[], alpha: number) =>
      new P.Path({ segments: idx.map((i) => pt(poly[i])), closed: true, fillColor: withAlpha(c.active, alpha) })
    const edge = (i: number): [Pt, Pt] => [poly[i], poly[(i + 1) % n]]

    // fills
    if (s.phase === 'done') {
      const tris = trianglesOf(n, s.triangulationDiagonals)
      if (tris.length === n - 2) tris.forEach((t) => fillPoly(t, 0.08))
      else s.pieces.forEach((p) => fillPoly(p, 0.08))
    } else {
      fillPoly(range(0, n - 1), 0.06)
      if (s.phase === 'triangulate' && s.activePiece !== undefined && s.pieces[s.activePiece])
        fillPoly(s.pieces[s.activePiece], 0.15)
    }

    // polygon edges
    for (let i = 0; i < n; i++) line(...edge(i), c.regular, 1.5)

    // sweep line
    if (s.phase === 'partition' && s.sweepY !== null) line({ x: 0, y: s.sweepY }, { x: WIDTH, y: s.sweepY }, c.sweep, 1, [6, 4])

    // status edges and helper links
    if (s.phase === 'partition') {
      for (const { edge: e, helper } of s.status) {
        const [a, b] = edge(e)
        line(a, b, c.active, 3)
        line({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, poly[helper], c.active, 1, [3, 3])
      }
      if (s.edgeLeft !== undefined) line(...edge(s.edgeLeft), c.split, 3)
    }

    // diagonals
    for (const [a, b] of s.partitionDiagonals) line(poly[a], poly[b], c.partition, 2)
    for (const [a, b] of s.triangulationDiagonals) line(poly[a], poly[b], c.diagonal, 2)
    if (s.reported) line(poly[s.reported[0]], poly[s.reported[1]], c.diagonal, 4)

    // vertex symbols
    const white = new P.Color(1, 1, 1)
    poly.forEach((q, i) => {
      const t = s.types[i]
      const color = c[t] ?? c.regular
      const h = 5
      if (t === 'start') new P.Path.Rectangle({ center: pt(q), size: [10, 10], fillColor: color })
      else if (t === 'end')
        new P.Path.Rectangle({ center: pt(q), size: [10, 10], strokeColor: color, strokeWidth: 1.5, fillColor: white })
      else if (t === 'split')
        new P.Path({
          segments: [new P.Point(q.x, q.y + h), new P.Point(q.x - h, q.y - h + 1), new P.Point(q.x + h, q.y - h + 1)],
          closed: true,
          fillColor: color,
        })
      else if (t === 'merge')
        new P.Path({
          segments: [new P.Point(q.x, q.y - h), new P.Point(q.x - h, q.y + h - 1), new P.Point(q.x + h, q.y + h - 1)],
          closed: true,
          fillColor: color,
        })
      else new P.Path.Circle({ center: pt(q), radius: 4, fillColor: color })
    })

    // phase-specific markers
    if (s.phase === 'partition' && s.current !== undefined)
      new P.Path.Circle({ center: pt(poly[s.current]), radius: 7, strokeColor: c.active, strokeWidth: 2 })
    if (s.phase === 'triangulate') {
      s.stack.forEach((v, k) => {
        const q = poly[v]
        new P.Path.Circle({ center: pt(q), radius: 9, strokeColor: c.active, strokeWidth: 1.5 })
        new P.PointText({
          matrix: new P.Matrix(1, 0, 0, -1, q.x - 18, q.y + 14),
          content: String(k + 1),
          fontSize: 11,
          fillColor: c.active,
        })
      })
      if (s.cursor !== undefined) new P.Path.Circle({ center: pt(poly[s.cursor]), radius: 7, fillColor: c.active })
    }

    // labels (the layer is y-flipped: flip back so that they read upright)
    poly.forEach((q, i) => {
      new P.PointText({
        matrix: new P.Matrix(1, 0, 0, -1, q.x + 8, q.y + 8),
        content: vname(i),
        fontSize: 14,
        fillColor: c.ink,
      })
    })

    // handles last, so they stay on top (and match handles(input) for dragging)
    drawHandles(scene, input)
  },

  panels(step): Panel[] {
    const s = step.state
    if (s.phase === 'partition') {
      return [
        {
          title: 'Event queue',
          empty: 'Queue is empty',
          rows: s.queue.map((v) => ({ text: `${vname(v)} (${s.types[v]})`, highlight: v === s.current ? 'active' : undefined })),
        },
        {
          title: 'Status structure',
          empty: 'Status is empty',
          rows: s.status.map(({ edge, helper }) => ({
            text: `e${edge + 1}   helper: ${vname(helper)}`,
            highlight: edge === s.edgeLeft ? 'testing' : undefined,
          })),
        },
      ]
    }
    if (s.phase === 'triangulate') {
      return [
        {
          title: 'Pieces',
          empty: 'No pieces',
          rows: s.pieces.map((p, i) => ({
            text: `piece ${i + 1}: ${p.map(vname).join(' ')}`,
            highlight: i === s.activePiece ? 'active' : undefined,
          })),
        },
        {
          title: 'Stack',
          empty: 'Stack is empty',
          // top of the stack first
          rows: [...s.stack].reverse().map((v) => ({ text: vname(v) })),
        },
      ]
    }
    return [
      {
        title: 'Vertex types',
        rows: s.types.map((t, i) => ({ text: `${vname(i)}   ${t}` })),
      },
    ]
  },
}

export default triangulationPlayer
