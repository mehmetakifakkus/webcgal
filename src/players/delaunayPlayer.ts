import type { Scene } from '../engine/scene'
import { defaultOrder } from '../geometry/algorithms/delaunay/delaunay'
import { delaunaySteps } from '../geometry/algorithms/delaunay/delaunaySteps'
import type { DelaunayState } from '../geometry/algorithms/delaunay/delaunayState'
import { DELAUNAY_PRESETS } from '../geometry/algorithms/delaunay/presets'
import { DELAUNAY_PSEUDOCODE } from '../geometry/algorithms/delaunay/pseudocode'
import { highestIndex, isSymbolic, P_MINUS_1, P_MINUS_2 } from '../geometry/algorithms/delaunay/symbolic'
import { randomPointSet } from '../geometry/algorithms/delaunay/verify'
import type { DelaunayInput, Pt } from '../geometry/types'
import { cssColor } from './cssColor'
import type { Panel, PlayerModule } from './types'

const WIDTH = 775
const HEIGHT = 360
const DISTINCT_MESSAGE = 'Points must be distinct'
/** Points closer than this (canvas units) count as coincident, so that a drag can actually hit the check. */
const MIN_DISTANCE = 2
const RAY_LENGTH = 30
const SQRT_HALF = Math.SQRT1_2
/**
 * Screen directions of the rays towards the symbolic vertices (y-up). symbolic.ts places p₋₁
 * far away on the lexicographically higher side and p₋₂ on the lower side, i.e. far west and far
 * east of the initial triangle, so p₋₁ points up-left and p₋₂ down-right.
 */
const RAY_DIR: Record<number, Pt> = {
  [P_MINUS_1]: { x: -SQRT_HALF, y: SQRT_HALF },
  [P_MINUS_2]: { x: SQRT_HALF, y: -SQRT_HALF },
}

const label = (i: number) => (i === P_MINUS_1 ? 'p₋₁' : isSymbolic(i) ? 'p₋₂' : `v${i + 1}`)
const edgeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)
const isReal = (v: readonly number[]) => !v.some(isSymbolic)
const aliveTriangles = (s: DelaunayState) => s.triangles.filter((t) => t.alive).map((t) => t.v)

function validate({ points }: DelaunayInput): string | null {
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < MIN_DISTANCE) return DISTINCT_MESSAGE
  return null
}

function randomInput(): DelaunayInput {
  const points = randomPointSet(Math.random, 12, { x0: 93, y0: 43, x1: 682, y1: 317 }, 25)
  return { points, order: defaultOrder(12, highestIndex(points), Math.floor(Math.random() * 1e9)) }
}

/** Undirected edges of the given triangles, each once, in first-seen order. */
function edgesOf(tris: [number, number, number][]): [number, number][] {
  const seen = new Set<string>()
  const out: [number, number][] = []
  for (const v of tris)
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3]
      const k = edgeKey(a, b)
      if (!seen.has(k)) {
        seen.add(k)
        out.push([a, b])
      }
    }
  return out
}

/** Edges used by exactly one of the (real) triangles: the convex hull after cleanup. */
function boundaryEdges(tris: [number, number, number][]): [number, number][] {
  const count = new Map<string, { e: [number, number]; n: number }>()
  for (const v of tris)
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3]
      const k = edgeKey(a, b)
      const c = count.get(k)
      if (c) c.n++
      else count.set(k, { e: [a, b], n: 1 })
    }
  return [...count.values()].filter((c) => c.n === 1).map((c) => c.e)
}

/** Alive triangles created in this step: by the split (they contain p_r) or by the flip (they contain the new edge). */
function createdThisStep(step: { line: number; state: DelaunayState }, v: [number, number, number]): boolean {
  const s = step.state
  if ((step.line === 8 || step.line === 11) && s.current !== undefined) return v.includes(s.current)
  if (s.flipped) return v.includes(s.flipped.to[0]) && v.includes(s.flipped.to[1])
  return false
}

function drawPoints(scene: Scene, points: Pt[], inserted: Set<number> | null) {
  const P = scene.paper
  const ink = cssColor('--canvas-ink', '#1c1e21')
  const white = new P.Color(1, 1, 1)
  points.forEach((q, i) => {
    const filled = inserted === null || inserted.has(i)
    new P.Path.Circle({
      center: new P.Point(q.x, q.y),
      radius: 4,
      fillColor: filled ? ink : white,
      strokeColor: ink,
      strokeWidth: filled ? 0 : 1.5,
    })
  })
}

const delaunayPlayer: PlayerModule<DelaunayState, DelaunayInput> = {
  computeSteps: (input) => delaunaySteps(input.points, input.order),
  validate,
  pseudocode: DELAUNAY_PSEUDOCODE,
  hint: 'Drag the points to change the input; the insertion order stays. Keys: ← → to step, Space to play or pause.',
  randomInput,
  presets: DELAUNAY_PRESETS.map(({ name, points, order }) => ({ name, input: { points, order } })),
  handles: (input) => input.points.map((p) => ({ x: p.x, y: p.y })),
  // delaunay() normalizes the order itself, so a move that changes p0 needs no fix-up here
  moveHandle: (input, k, p) => ({
    points: input.points.map((q, i) => (i === k ? { x: p.x, y: p.y } : { x: q.x, y: q.y })),
    order: [...input.order],
  }),
  canvas: { width: WIDTH, height: HEIGHT },

  renderInvalid(scene, input) {
    scene.paper.activate()
    scene.clear()
    drawPoints(scene, input.points, null)
  },

  render(scene, step, input) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const s = step.state
    const points = input.points
    const c = {
      edge: cssColor('--del-edge', '#374151'),
      current: cssColor('--del-current', '#e66100'),
      located: cssColor('--del-located', '#4f46e5'),
      legal: cssColor('--del-legal', '#26a269'),
      illegal: cssColor('--del-illegal', '#c01c28'),
      flip: cssColor('--del-flip', '#9141ac'),
      circle: cssColor('--del-circle', '#6b7280'),
      hull: cssColor('--del-hull', '#1a5fb4'),
      ink: cssColor('--canvas-ink', '#1c1e21'),
    }
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    const withAlpha = (color: string, a: number) => {
      const col = new P.Color(color)
      col.alpha = a
      return col
    }
    const fillTriangle = (v: [number, number, number], color: string, alpha: number) =>
      new P.Path({ segments: v.map((i) => pt(points[i])), closed: true, fillColor: withAlpha(color, alpha) })
    /** A real edge as a segment, a real–symbolic edge as a dashed ray; symbolic–symbolic edges are not drawn. */
    const edge = ([a, b]: [number, number], color: string, width: number) => {
      if (isSymbolic(a) && isSymbolic(b)) return
      if (!isSymbolic(a) && !isSymbolic(b)) {
        new P.Path({ segments: [pt(points[a]), pt(points[b])], strokeColor: color, strokeWidth: width, strokeCap: 'round' })
        return
      }
      const [r, sym] = isSymbolic(a) ? [b, a] : [a, b]
      const q = points[r], d = RAY_DIR[sym]
      new P.Path({
        segments: [pt(q), new P.Point(q.x + RAY_LENGTH * d.x, q.y + RAY_LENGTH * d.y)],
        strokeColor: color,
        strokeWidth: width,
        dashArray: [4, 3],
      })
    }

    const alive = aliveTriangles(s)
    const final = s.phase === 'cleanup' || s.phase === 'done'

    // fills
    if (final) alive.filter(isReal).forEach((v) => fillTriangle(v, c.located, 0.08))
    if (s.located && isReal(s.located.t)) fillTriangle(s.located.t, c.located, 0.18)

    // triangulation edges (real ones and rays towards p₋₁ / p₋₂)
    for (const e of edgesOf(alive)) edge(e, c.edge, 1.5)
    if (final) for (const e of boundaryEdges(alive.filter(isReal))) edge(e, c.hull, 2)

    // located triangle with a symbolic vertex: only its real edge(s) and rays, highlighted
    if (s.located && !isReal(s.located.t)) {
      const t = s.located.t
      for (let e = 0; e < 3; e++) edge([t[e], t[(e + 1) % 3]], c.located, 2)
    }
    if (s.located?.edge) edge(s.located.edge, c.located, 3)

    // legality test, its circumcircle, and the flip
    if (s.circle)
      new P.Path.Circle({
        center: pt(s.circle.center),
        radius: s.circle.radius,
        strokeColor: c.circle,
        strokeWidth: 1,
        dashArray: [5, 4],
      })
    if (s.testing) edge(s.testing.edge, s.testing.legal ? c.legal : c.illegal, 3)
    if (s.flipped) edge(s.flipped.to, c.flip, 3)

    // the point being inserted
    if (s.current !== undefined)
      new P.Path.Circle({ center: pt(points[s.current]), radius: 7, strokeColor: c.current, strokeWidth: 2.5 })

    // labels (the layer is y-flipped: flip back so that they read upright)
    points.forEach((q, i) => {
      new P.PointText({
        matrix: new P.Matrix(1, 0, 0, -1, q.x + 8, q.y + 8),
        content: label(i),
        fontSize: 14,
        fillColor: c.ink,
      })
    })

    // points last, so they stay on top (and match handles(input) for dragging)
    drawPoints(scene, points, new Set(s.inserted))
  },

  panels(step): Panel[] {
    const s = step.state
    const inserted = new Set(s.inserted)
    const located = s.located?.t
    const testing = s.testing?.edge
    return [
      {
        title: 'Insertion order',
        rows: s.order.map((i) => ({
          text: label(i),
          highlight: i === s.current ? ('active' as const) : inserted.has(i) ? ('new' as const) : undefined,
        })),
      },
      {
        title: 'Flip stack',
        empty: 'Stack is empty',
        // top of the stack first; the edge under test is already popped, so it is shown above the stack
        rows: [
          ...(testing ? [{ text: `${label(testing[0])}–${label(testing[1])}`, highlight: 'testing' as const }] : []),
          ...[...s.stack].reverse().map(([a, b]) => ({ text: `${label(a)}–${label(b)}` })),
        ],
      },
      {
        title: 'Triangles',
        empty: 'No triangles yet',
        rows: aliveTriangles(s)
          .filter(isReal)
          .map((v) => ({
            text: v.map(label).join(' '),
            highlight:
              located && v.every((i) => located.includes(i))
                ? ('active' as const)
                : createdThisStep(step, v)
                  ? ('new' as const)
                  : undefined,
          })),
      },
    ]
  },
}

export default delaunayPlayer
