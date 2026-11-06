import { findIntersectionsSteps } from '../geometry/algorithms/sweep/findIntersectionsSteps'
import { SEGMENT_INTERSECTION_PSEUDOCODE } from '../geometry/algorithms/sweep/pseudocode'
import { SWEEP_PRESETS } from '../geometry/algorithms/sweep/presets'
import type { SweepState } from '../geometry/algorithms/sweep/sweepState'
import { samePt, upperEndpoint } from '../geometry/primitives'
import type { Pt, Segment } from '../geometry/types'
import { cssColor } from './cssColor'
import type { Panel, PlayerModule } from './types'

const WIDTH = 775
const HEIGHT = 360
const SEGMENT_COUNT = 7
const MIN_LENGTH = 40
const X_RANGE = [77.5, 697.5] as const
const Y_RANGE = [36, 324] as const

const randIn = ([lo, hi]: readonly [number, number]) => lo + Math.random() * (hi - lo)
const randomPt = (): Pt => ({ x: randIn(X_RANGE), y: randIn(Y_RANGE) })

function randomSegment(): Segment {
  for (;;) {
    const a = randomPt()
    const b = randomPt()
    if (Math.hypot(a.x - b.x, a.y - b.y) >= MIN_LENGTH) return { a, b }
  }
}

const r = (v: number) => Math.round(v)
const fmtPt = (p: Pt) => `(${r(p.x)}, ${r(p.y)})`
const name = (i: number) => `s${i + 1}`

const sweepLinePlayer: PlayerModule<SweepState, Segment[]> = {
  computeSteps: findIntersectionsSteps,
  pseudocode: SEGMENT_INTERSECTION_PSEUDOCODE,
  hint: 'Drag the endpoints to change the input. Keys: ← → to step, Space to play or pause.',
  randomInput: () => Array.from({ length: SEGMENT_COUNT }, randomSegment),
  presets: SWEEP_PRESETS.map(({ name, segments }) => ({ name, input: segments })),
  handles: (segs) => segs.flatMap((s) => [s.a, s.b]),
  moveHandle: (segs, k, p) =>
    segs.map((s, i) => (i !== Math.floor(k / 2) ? s : k % 2 === 0 ? { a: p, b: s.b } : { a: s.a, b: p })),
  canvas: { width: WIDTH, height: HEIGHT },

  render(scene, step, segs) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const s = step.state
    const c = {
      line: cssColor('--sweep-line', '#6b7280'),
      segment: cssColor('--sweep-segment', '#374151'),
      status: cssColor('--sweep-status', '#1a5fb4'),
      testing: cssColor('--sweep-testing', '#9141ac'),
      event: cssColor('--sweep-event', '#e66100'),
      found: cssColor('--sweep-found', '#c01c28'),
      overlap: cssColor('--sweep-overlap', '#26a269'),
      ink: cssColor('--canvas-ink', '#1c1e21'),
    }
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    const seg = (i: number, color: string, width: number) =>
      new P.Path({ segments: [pt(segs[i].a), pt(segs[i].b)], strokeColor: color, strokeWidth: width, strokeCap: 'round' })

    // thin segments first, then the ones in the status structure, then the testing pair
    segs.forEach((_, i) => seg(i, c.segment, 1.5))
    const inStatus = new Set(s.status)
    for (const i of inStatus) if (segs[i]) seg(i, c.status, 3)
    if (s.testing) for (const i of s.testing) if (segs[i]) seg(i, c.testing, 3)

    if (s.sweepY !== null)
      new P.Path({
        segments: [new P.Point(0, s.sweepY), new P.Point(WIDTH, s.sweepY)],
        strokeColor: c.line,
        strokeWidth: 1,
        dashArray: [6, 4],
      })

    for (const o of s.overlaps)
      new P.Path({ segments: [pt(o.a), pt(o.b)], strokeColor: c.overlap, strokeWidth: 5, strokeCap: 'round' })

    for (const e of s.queue)
      new P.Path.Circle({ center: pt(e.p), radius: 4, strokeColor: c.event, strokeWidth: 1.5, fillColor: new P.Color(1, 1, 1, 0) })
    if (s.current) new P.Path.Circle({ center: pt(s.current), radius: 5, fillColor: c.event })
    for (const f of s.points) new P.Path.Circle({ center: pt(f.p), radius: 5, fillColor: c.found })
    if (s.newEvent) new P.Path.Circle({ center: pt(s.newEvent), radius: 8, strokeColor: c.event, strokeWidth: 2 })

    // the layer is y-flipped: flip the label back so that it reads upright
    segs.forEach((sg, i) => {
      const u = upperEndpoint(sg)
      new P.PointText({
        matrix: new P.Matrix(1, 0, 0, -1, u.x + 8, u.y + 8),
        content: name(i),
        fontSize: 14,
        fillColor: c.ink,
      })
    })

    // handles last, so they stay on top (and match handles(segs) for dragging)
    for (const q of sweepLinePlayer.handles(segs))
      new P.Path.Circle({ center: pt(q), radius: 4, fillColor: c.ink })
  },

  panels(step): Panel[] {
    const s = step.state
    const queue: Panel = {
      title: 'Event queue',
      empty: 'Queue is empty',
      rows: s.queue.map((e) => {
        const u = e.upper.map(name).join(', ')
        const active = !!s.current && samePt(e.p, s.current)
        const isNew = !!s.newEvent && samePt(e.p, s.newEvent)
        return {
          text: `${fmtPt(e.p)}   U = {${u}}`,
          highlight: active ? 'active' : isNew ? 'new' : undefined,
        }
      }),
    }
    const added = new Set(step.line === 12 ? [...(s.U ?? []), ...(s.C ?? [])] : [])
    const status: Panel = {
      title: 'Status structure',
      empty: 'Status is empty',
      rows: s.status.map((i) => ({
        text: name(i),
        highlight: s.testing?.includes(i) ? 'testing' : added.has(i) ? 'new' : undefined,
      })),
    }
    return [queue, status]
  },
}

export default sweepLinePlayer
