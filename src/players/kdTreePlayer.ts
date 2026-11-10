import type { Scene } from '../engine/scene'
import { randomPointSet } from '../geometry/algorithms/delaunay/verify'
import type { KdNodeView, KdState } from '../geometry/algorithms/kdtree/kdState'
import { kdSteps, type KdMode } from '../geometry/algorithms/kdtree/kdSteps'
import { PLANE_BOX, label } from '../geometry/algorithms/kdtree/kdTree'
import { KD_PRESETS } from '../geometry/algorithms/kdtree/presets'
import { KD_PSEUDOCODE } from '../geometry/algorithms/kdtree/pseudocode'
import { clipSegment, type Box } from '../geometry/algorithms/voronoi/clip'
import type { KdInput, Pt } from '../geometry/types'
import { cssColor } from './cssColor'
import type { Panel, PlayerModule } from './types'

const WIDTH = 775
const HEIGHT = 360
const SEPARATOR_X = 465
/** The tree area (spec §4): x 475–765, y 20–340. */
const TREE = { x0: 475, x1: 765, y0: 20, y1: 340 }
const POINT_RADIUS = 4
const LEAF_RADIUS = 5
const SPLIT_SIZE = 12
const CORNER_SIZE = 7
const MAX_POINT_LABELS = 20
const MAX_NODE_LABELS = 24

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const fmt = (v: number) => v.toFixed(1)
/** Compact number for region bounds: one decimal at most, no trailing ".0". */
const short = (v: number) => String(+v.toFixed(1))
const clamp = (p: Pt): Pt => ({
  x: Math.min(PLANE_BOX.x1, Math.max(PLANE_BOX.x0, p.x)),
  y: Math.min(PLANE_BOX.y1, Math.max(PLANE_BOX.y0, p.y)),
})
const copyInput = (input: KdInput): KdInput => ({ points: input.points.map((q) => ({ x: q.x, y: q.y })), query: { ...input.query } })

/** 14 points at least 20 apart, and a rectangle covering 26–39% of the plane box. */
function randomInput(): KdInput {
  const B = PLANE_BOX
  const points = randomPointSet(Math.random, 14, { x0: B.x0 + 10, y0: B.y0 + 10, x1: B.x1 - 10, y1: B.y1 - 10 }, 20)
  const W = B.x1 - B.x0
  const H = B.y1 - B.y0
  const area = (0.26 + Math.random() * 0.13) * W * H
  const aspect = 0.6 + Math.random() * 1.2 // width / height; keeps w ≤ W and h ≤ H for these areas
  const w = Math.sqrt(area * aspect)
  const h = area / w
  const x0 = B.x0 + Math.random() * (W - w)
  const y0 = B.y0 + Math.random() * (H - h)
  return { points, query: { x0, y0, x1: x0 + w, y1: y0 + h } }
}

/** Whether node `id` or one of its ancestors is in `set`. */
function under(id: number, set: Set<number>, byId: Map<number, KdNodeView>): boolean {
  for (let v = byId.get(id); v; v = v.parent === null ? undefined : byId.get(v.parent)) if (set.has(v.id)) return true
  return false
}

/**
 * Tree positions (spec §4): leaves in left-to-right order, each internal node at the midpoint
 * of its two children; depth top-down. Computed from `size` alone (the left child holds
 * ⌈size/2⌉ points), so nodes keep their place while the tree is being built.
 */
function treeLayout(nodes: KdNodeView[]): Map<number, Pt> {
  const out = new Map<number, Pt>()
  const root = nodes.find((v) => v.parent === null)
  if (!root) return out
  const leaves = root.size
  const depth = Math.ceil(Math.log2(leaves))
  const centre = (offset: number, size: number): number => {
    if (size === 1) return offset + 0.5
    const l = Math.ceil(size / 2)
    return (centre(offset, l) + centre(offset + l, size - l)) / 2
  }
  const offsets = new Map<number, number>()
  const byId = new Map(nodes.map((v) => [v.id, v]))
  for (const v of nodes) {
    const parent = v.parent === null ? undefined : byId.get(v.parent)
    const offset = !parent ? 0 : offsets.get(parent.id)! + (v.side === 'right' ? Math.ceil(parent.size / 2) : 0)
    offsets.set(v.id, offset)
    out.set(v.id, {
      x: TREE.x0 + centre(offset, v.size) * ((TREE.x1 - TREE.x0) / leaves),
      // spec: 20 + depth · (320 / max(1, depth)) from the top; the scene is y-up, so from y1 down
      y: TREE.y1 - v.depth * ((TREE.y1 - TREE.y0) / Math.max(1, depth)),
    })
  }
  return out
}

const kdTreePlayer: PlayerModule<KdState, KdInput> = {
  computeSteps: (input, mode) => kdSteps(input, (mode ?? 'full') as KdMode),
  modes: [
    { id: 'full', label: 'Build and query' },
    { id: 'build', label: 'Build only' },
    { id: 'query', label: 'Query only' },
  ],
  dimmedLines: (mode) => (mode === 'build' ? range(10, 20) : mode === 'query' ? range(0, 9) : []),
  pseudocode: KD_PSEUDOCODE,
  hint: 'Drag the points or the two corners of the query rectangle. Keys: ← → to step, Space to play or pause.',
  randomInput,
  presets: KD_PRESETS.map(({ name, input }) => ({ name, input: copyInput(input) })),
  handles: ({ points, query }) => [
    ...points.map(clamp),
    clamp({ x: query.x0, y: query.y0 }),
    clamp({ x: query.x1, y: query.y1 }),
  ],
  moveHandle(input, k, p) {
    const next = copyInput(input)
    const n = input.points.length
    const q = clamp(p)
    if (k < n) {
      next.points[k] = q
      return next
    }
    // the other corner stays; moving one past it swaps their roles
    const other = k === n ? { x: input.query.x1, y: input.query.y1 } : { x: input.query.x0, y: input.query.y0 }
    next.query = { x0: Math.min(q.x, other.x), y0: Math.min(q.y, other.y), x1: Math.max(q.x, other.x), y1: Math.max(q.y, other.y) }
    return next
  },
  canvas: { width: WIDTH, height: HEIGHT },

  render(scene: Scene, step, input) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const s = step.state
    const { points, query } = input
    const c = {
      x: cssColor('--kd-x', '#1a5fb4'),
      y: cssColor('--kd-y', '#c01c28'),
      current: cssColor('--kd-current', '#e66100'),
      query: cssColor('--kd-query', '#9141ac'),
      report: cssColor('--kd-report', '#26a269'),
      pruned: cssColor('--kd-pruned', '#9aa0a6'),
      ink: cssColor('--canvas-ink', '#1c1e21'),
      bg: cssColor('--canvas-bg', '#ffffff'),
    }
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    const withAlpha = (color: string, a: number) => {
      const col = new P.Color(color)
      col.alpha = a
      return col
    }
    const rect = (b: Box, style: object) => new P.Path.Rectangle({ from: [b.x0, b.y0], to: [b.x1, b.y1], ...style })
    // the layer is y-flipped: flip text back so that it reads upright
    const text = (content: string, x: number, y: number, size: number, justification = 'left') =>
      new P.PointText({ matrix: new P.Matrix(1, 0, 0, -1, x, y), content, fontSize: size, fillColor: c.ink, justification })

    const byId = new Map(s.nodes.map((v) => [v.id, v]))
    const inside = new Set(s.inside)
    const pruned = new Set(s.pruned)
    const visited = new Set(s.visited)
    const reported = new Set(s.reported)
    const leafOf = new Map(s.nodes.filter((v) => v.point !== undefined).map((v) => [v.point!, v.id]))

    // plane: frame, regions, split lines clipped to their regions, the query rectangle
    rect(PLANE_BOX, { strokeColor: withAlpha(c.ink, 0.4), strokeWidth: 1 })
    for (const id of s.pruned) rect(byId.get(id)!.region, { fillColor: withAlpha(c.pruned, 0.2) })
    for (const id of s.inside) rect(byId.get(id)!.region, { fillColor: withAlpha(c.report, 0.15) })
    if (s.current !== undefined) rect(byId.get(s.current)!.region, { fillColor: withAlpha(c.current, 0.15) })
    for (const v of s.nodes) {
      if (!v.axis) continue
      const r = v.region
      const [a, b] = v.axis === 'x' ? [{ x: v.value!, y: r.y0 }, { x: v.value!, y: r.y1 }] : [{ x: r.x0, y: v.value! }, { x: r.x1, y: v.value! }]
      const seg = clipSegment(a, b, r)
      if (seg) new P.Path.Line({ from: pt(seg[0]), to: pt(seg[1]), strokeColor: v.axis === 'x' ? c.x : c.y, strokeWidth: 1.5 })
    }
    rect(query, { strokeColor: c.query, strokeWidth: 2, dashArray: [6, 4] })
    new P.Path.Line({ from: [SEPARATOR_X, PLANE_BOX.y0], to: [SEPARATOR_X, PLANE_BOX.y1], strokeColor: withAlpha(c.ink, 0.25), strokeWidth: 1 })

    // tree: edges, then nodes (squares for splits, circles for leaves), then labels
    const at = treeLayout(s.nodes)
    for (const v of s.nodes)
      if (v.parent !== null && at.has(v.parent))
        new P.Path.Line({ from: pt(at.get(v.parent)!), to: pt(at.get(v.id)!), strokeColor: withAlpha(c.ink, 0.6), strokeWidth: 1 })
    for (const v of s.nodes) {
      const q = at.get(v.id)!
      const fill =
        v.id === s.current
          ? c.current
          : under(v.id, inside, byId) || (v.point !== undefined && reported.has(v.point))
            ? c.report
            : under(v.id, pruned, byId)
              ? c.pruned
              : c.bg
      const style = { fillColor: fill, strokeWidth: visited.has(v.id) ? 3 : 1.5 }
      if (v.axis) {
        const h = SPLIT_SIZE / 2
        rect({ x0: q.x - h, y0: q.y - h, x1: q.x + h, y1: q.y + h }, { ...style, strokeColor: v.axis === 'x' ? c.x : c.y })
      } else new P.Path.Circle({ center: pt(q), radius: LEAF_RADIUS, strokeColor: c.ink, ...style })
    }
    // labels: a leaf's point centred below it; a split's line centred above its square, on a
    // halo that interrupts the incoming edge (siblings and cousins sit ≥ 1.5 leaves apart, so
    // side labels would run into them); the root's to the right. Decided on the whole tree
    // (2n − 1 nodes), so labels do not vanish halfway through the build.
    if (2 * points.length - 1 <= MAX_NODE_LABELS)
      for (const v of s.nodes) {
        const q = at.get(v.id)!
        if (!v.axis) {
          text(label(v.point!), q.x, q.y - LEAF_RADIUS - 9, 9, 'center')
          continue
        }
        const content = `${v.axis} = ${Math.round(v.value!)}`
        const [x, y, j] = v.parent === null ? [q.x + 9, q.y - 3, 'left'] : [q.x, q.y + 9, 'center']
        if (v.parent !== null)
          text(content, x, y, 9, j).set({ fillColor: c.bg, strokeColor: c.bg, strokeWidth: 4, strokeJoin: 'round' })
        text(content, x, y, 9, j)
      }

    // points last (they match handles(input)): reported green, those in skipped regions faded
    if (points.length <= MAX_POINT_LABELS)
      points.forEach((q, i) => (q.x > 430 ? text(label(i), q.x - 7, q.y + 7, 12, 'right') : text(label(i), q.x + 7, q.y + 7, 12)))
    points.forEach((q, i) => {
      const leaf = leafOf.get(i)
      const faded = leaf !== undefined && under(leaf, pruned, byId)
      new P.Path.Circle({
        center: pt(q),
        radius: POINT_RADIUS,
        fillColor: reported.has(i) ? c.report : faded ? withAlpha(c.ink, 0.3) : c.ink,
      })
    })
    for (const q of [{ x: query.x0, y: query.y0 }, { x: query.x1, y: query.y1 }]) {
      const h = CORNER_SIZE / 2
      rect({ x0: q.x - h, y0: q.y - h, x1: q.x + h, y1: q.y + h }, { fillColor: c.query })
    }
  },

  panels(step, input): Panel[] {
    const s = step.state
    const v = s.current === undefined ? undefined : s.nodes.find((x) => x.id === s.current)
    const r = v?.region
    const node = !v
      ? []
      : v.axis
        ? [`${v.axis} = ${fmt(v.value!)} · depth ${v.depth} · region [${short(r!.x0)}, ${short(r!.x1)}] × [${short(r!.y0)}, ${short(r!.y1)}]`]
        : [`leaf ${label(v.point!)} · (${fmt(input.points[v.point!].x)}, ${fmt(input.points[v.point!].y)})`]
    const test = s.test
    const side = test && s.nodes.find((x) => x.id === test.child)?.side === 'left' ? 'lc' : 'rc'
    const fresh = new Set(s.newlyReported ?? [])
    const k = s.counts
    return [
      { title: 'Node', empty: 'No node yet', rows: node.map((text) => ({ text, highlight: 'active' as const })) },
      {
        title: 'Query',
        empty: 'Query not started',
        rows:
          s.phase === 'build'
            ? []
            : [
                ...(test ? [{ text: `region(${side}) ∩ R: ${test.relation}`, highlight: 'testing' as const }] : []),
                { text: `reported ${s.reported.length} · visited ${k.visited} · inside ${k.inside} · skipped ${k.pruned}` },
              ],
      },
      {
        title: 'Reported',
        empty: 'Nothing reported yet',
        rows: s.reported.map((i) => ({ text: label(i), highlight: fresh.has(i) ? ('new' as const) : undefined })),
      },
    ]
  },
}

export default kdTreePlayer
