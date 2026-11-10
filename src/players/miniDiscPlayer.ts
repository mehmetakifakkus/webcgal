import type { Scene } from '../engine/scene'
import { randomPointSet } from '../geometry/algorithms/delaunay/verify'
import { defaultOrder, label, listLabels, minidisc } from '../geometry/algorithms/minidisc/minidisc'
import { miniDiscSteps } from '../geometry/algorithms/minidisc/miniDiscSteps'
import type { Frame, MiniDiscState } from '../geometry/algorithms/minidisc/miniDiscState'
import { MINIDISC_PRESETS } from '../geometry/algorithms/minidisc/presets'
import { MINIDISC_PSEUDOCODE } from '../geometry/algorithms/minidisc/pseudocode'
import type { Circle, MiniDiscInput, Pt } from '../geometry/types'
import { cssColor } from './cssColor'
import type { Panel, PlayerModule } from './types'

const WIDTH = 775
const HEIGHT = 360
const POINT_RADIUS = 4
const CURRENT_RADIUS = 7
const RING_RADIUS = 9

function randomInput(): MiniDiscInput {
  const points = randomPointSet(Math.random, 12, { x0: 272, y0: 65, x1: 502, y1: 295 }, 25)
  return { points, order: defaultOrder(12, Math.floor(Math.random() * 1e9)) }
}

const innermost = (s: MiniDiscState): Frame | undefined => s.stack[s.stack.length - 1]

/**
 * The book's loop counter of a frame and its n. `index` is the 0-based position in `order`
 * the loop is at, and p_c of the book is order[c − 1] in every procedure (MiniDisc's p_i,
 * WithPoint's p_j and With2Points' p_k all index the same prefix of the permutation), so the
 * counter is index + 1; n is the size of the frame's P, i.e. `prefix`. Before a loop starts,
 * index is 1 / 0 / −1, so the counter reads 2 / 1 / 0: the subscript of the initial disc
 * D₂ / D₁ / D₀, one before the loop's first value (3 / 2 / 1).
 */
function frameRow(f: Frame): string {
  const at = `${f.index + 1} of ${f.prefix}`
  if (f.proc === 'MiniDisc') return `MiniDisc · i = ${at}`
  // fixed is stored [q, p_j]: the book's q₁ is the new point fixed[1], q₂ the outer q fixed[0]
  if (f.proc === 'WithPoint') return `MiniDiscWithPoint(q = ${label(f.fixed[0])}) · j = ${at}`
  return `MiniDiscWith2Points(q₁ = ${label(f.fixed[1])}, q₂ = ${label(f.fixed[0])}) · k = ${at}`
}

/** The final boundary points (done only; the state does not carry them, so the run is repeated). */
const finalBoundary = (s: MiniDiscState, input: MiniDiscInput): number[] =>
  s.phase === 'done' ? minidisc(input.points, s.order).boundary : []

const miniDiscPlayer: PlayerModule<MiniDiscState, MiniDiscInput> = {
  computeSteps: (input) => miniDiscSteps(input.points, input.order),
  pseudocode: MINIDISC_PSEUDOCODE,
  hint: 'Drag the points to change the input; the order stays. Keys: ← → to step, Space to play or pause.',
  randomInput,
  presets: MINIDISC_PRESETS.map(({ name, points, order }) => ({ name, input: { points, order } })),
  handles: (input) => input.points.map((p) => ({ x: p.x, y: p.y })),
  moveHandle: (input, k, p) => ({
    points: input.points.map((q, i) => (i === k ? { x: p.x, y: p.y } : { x: q.x, y: q.y })),
    order: [...input.order],
  }),
  canvas: { width: WIDTH, height: HEIGHT },

  render(scene: Scene, step, input) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const s = step.state
    const points = input.points
    const c = {
      disk: cssColor('--md-disk', '#1a5fb4'),
      outer: cssColor('--md-outer', '#9aa0a6'),
      fixed: cssColor('--md-fixed', '#9141ac'),
      inside: cssColor('--md-inside', '#26a269'),
      outside: cssColor('--md-outside', '#c01c28'),
      fresh: cssColor('--md-new', '#e66100'),
      ink: cssColor('--canvas-ink', '#1c1e21'),
    }
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    const withAlpha = (color: string, a: number) => {
      const col = new P.Color(color)
      col.alpha = a
      return col
    }
    /** A disc outline; radius-0 discs (n = 1) are not drawn. */
    const disc = (d: Circle, color: string, width: number, opts: { dashed?: boolean; fill?: boolean } = {}) => {
      if (!(d.radius > 0)) return
      new P.Path.Circle({
        center: pt(d.center),
        radius: d.radius,
        strokeColor: color,
        strokeWidth: width,
        ...(opts.dashed ? { dashArray: [6, 4] } : {}),
        ...(opts.fill ? { fillColor: withAlpha(color, 0.08) } : {}),
      })
    }
    const ring = (i: number, color: string) =>
      new P.Path.Circle({ center: pt(points[i]), radius: RING_RADIUS, strokeColor: color, strokeWidth: 2 })

    const done = s.phase === 'done'
    const inner = innermost(s)

    // discs of the outer calls, thin and dashed (one per outer frame)
    for (const f of s.stack.slice(0, -1)) disc(f.disk, c.outer, 1, { dashed: true })
    // the innermost call's disc; at done the final one, thicker
    if (s.disk) disc(s.disk, c.disk, done ? 3 : 2, { fill: true })
    if (s.newDisk) disc(s.newDisk, c.fresh, 3)
    if (s.returned) disc(s.returned, c.fresh, 3, { dashed: true })

    // the innermost call's fixed boundary points; at done the final boundary
    if (inner && !done) for (const i of inner.fixed) ring(i, c.fixed)
    for (const i of finalBoundary(s, input)) ring(i, c.fixed)

    // labels (the layer is y-flipped: flip back so that they read upright)
    points.forEach((q, i) => {
      new P.PointText({
        matrix: new P.Matrix(1, 0, 0, -1, q.x + 8, q.y + 8),
        content: label(i),
        fontSize: 14,
        fillColor: c.ink,
      })
    })

    // points last, so they stay on top (and match handles(input) for dragging): the innermost
    // call's points already processed (order[0..index]) filled, all others hollow
    const tested = new Set(inner ? s.order.slice(0, Math.min(inner.index + 1, inner.prefix)) : [])
    const white = new P.Color(1, 1, 1)
    points.forEach((q, i) => {
      if (i === s.current) return
      const filled = tested.has(i)
      new P.Path.Circle({
        center: pt(q),
        radius: POINT_RADIUS,
        fillColor: filled ? c.ink : white,
        strokeColor: c.ink,
        strokeWidth: filled ? 0 : 1.5,
      })
    })
    if (s.current !== undefined)
      new P.Path.Circle({
        center: pt(points[s.current]),
        radius: CURRENT_RADIUS,
        fillColor: s.testing ? (s.testing.inside ? c.inside : c.outside) : c.fresh,
        strokeColor: c.ink,
        strokeWidth: 1,
      })
  },

  panels(step, input): Panel[] {
    const s = step.state
    const inner = innermost(s)
    const fixed = new Set(inner?.fixed ?? [])
    const boundary = finalBoundary(s, input)
    const d = s.disk
    return [
      {
        title: 'Call stack',
        empty: 'Not started',
        rows: s.stack.map((f, k) => ({
          text: frameRow(f),
          highlight: k === s.stack.length - 1 ? ('active' as const) : undefined,
        })),
      },
      {
        title: 'Order',
        rows: s.order.map((i) => ({
          text: label(i),
          highlight: i === s.current ? ('active' as const) : fixed.has(i) ? ('new' as const) : undefined,
        })),
      },
      {
        title: 'Disc',
        empty: 'No disc yet',
        rows: d
          ? [
              { text: `centre (${d.center.x.toFixed(1)}, ${d.center.y.toFixed(1)})` },
              { text: `radius ${d.radius.toFixed(1)}` },
              ...(boundary.length ? [{ text: `defined by ${listLabels(boundary)}` }] : []),
              { text: `tests ${s.tests} · updates ${s.updates}` },
            ]
          : [],
      },
    ]
  },
}

export default miniDiscPlayer
