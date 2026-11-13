import type paper from 'paper'
import type { Scene } from '../engine/scene'
import { compareOn } from '../geometry/algorithms/kdtree/kdTree'
import { RT_PRESETS, randomRangeTreeInput } from '../geometry/algorithms/rangetree/presets'
import { RT_PSEUDOCODE } from '../geometry/algorithms/rangetree/pseudocode'
import { RT_PLANE, buildTree1D, count, fmt, pointLabel, type Tree1DNode } from '../geometry/algorithms/rangetree/rangeTree'
import type { RTMode, RTNodeView, RTState } from '../geometry/algorithms/rangetree/rtState'
import { rtSteps } from '../geometry/algorithms/rangetree/rtSteps'
import type { Box } from '../geometry/algorithms/voronoi/clip'
import type { Pt, RangeTreeInput } from '../geometry/types'
import { clampToBox, cornerHandles, moveCorner } from './cornerHandles'
import { cssColor } from './cssColor'
import type { Panel, PlayerModule } from './types'

const WIDTH = 775
const HEIGHT = 480
/** Between the plane area and the trees. */
const SEPARATOR_X = 367.5
/** Between the main tree (above) and the associated tree (below). */
const DIVIDER_Y = 242.5
/**
 * The tree boxes (spec §4.1), y-up: `top` is the row of the root, `bottom` the lowest row the
 * deepest leaves may take (their labels go below it, still inside the box).
 */
const MAIN = { x0: 380, x1: 765, y0: 250, y1: 465, top: 452, bottom: 272 }
const ASSOC = { x0: 380, x1: 765, y0: 15, y1: 235, top: 210, bottom: 32 }
/** Largest distance between two levels of a tree; small trees stay compact under their title. */
const LEVEL_GAP = 45
const NODE_RADIUS = 10
/** Split nodes when the tree is too wide for labels. */
const SMALL_NODE_RADIUS = 5
const LEAF_RADIUS = 4
const POINT_RADIUS = 4
const CORNER_SIZE = 7
/** Trees with more leaves than this are drawn without labels (leaves would be under 24 px apart). */
const MAX_LABELLED_LEAVES = 16
const MAX_POINT_LABELS = 20
/** Points closer than this to an earlier labelled point share its label (see labelGroups). */
const LABEL_MERGE = 8
const WHITE = '#ffffff'

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const modeOf = (mode?: string): RTMode => (mode === 'build' || mode === 'query' ? mode : 'full')
const copyInput = (input: RangeTreeInput): RangeTreeInput => ({
  points: input.points.map((q) => ({ x: q.x, y: q.y })),
  query: { ...input.query },
})
/** A dragged position: integer coordinates (so step texts compare what they show), in the plane area. */
const snap = (p: Pt): Pt => clampToBox(RT_PLANE, { x: Math.round(p.x), y: Math.round(p.y) })

/** A binary tree for the layout: split nodes have two children, leaves none. */
type LNode = { id: number; left?: LNode; right?: LNode }

/** The main tree as an LNode tree; in pre-order the left child of `v` is `v.id + 1`. */
function mainShape(nodes: RTNodeView[]): LNode | null {
  if (!nodes.length) return null
  const kids = nodes.map(() => [] as number[])
  for (const v of nodes) if (v.parent !== null) kids[v.parent].push(v.id)
  const make = (id: number): LNode => {
    const [l, r] = kids[id]
    return l === undefined ? { id } : { id, left: make(l), right: make(r) }
  }
  return make(nodes.find((v) => v.parent === null)!.id)
}

/**
 * Positions (spec §4.1): leaves left to right, `slot` apart and centred in the box; each split
 * node at the midpoint of its children; rows by depth from `box.top` down, at most LEVEL_GAP
 * apart and with the deepest row no lower than `box.bottom`. Deterministic in the tree shape.
 */
function layout(root: LNode | null, box: typeof MAIN, slot: number): Map<number, Pt> {
  const out = new Map<number, Pt>()
  if (!root) return out
  const size = (v: LNode): number => (v.left ? size(v.left) + size(v.right!) : 1)
  const height = (v: LNode): number => (v.left ? 1 + Math.max(height(v.left), height(v.right!)) : 0)
  const leaves = size(root)
  const gap = Math.min(LEVEL_GAP, (box.top - box.bottom) / Math.max(1, height(root)))
  const x0 = (box.x0 + box.x1) / 2 - (leaves * slot) / 2
  let next = 0
  const place = (v: LNode, depth: number): number => {
    const x = v.left ? (place(v.left, depth + 1) + place(v.right!, depth + 1)) / 2 : x0 + (next++ + 0.5) * slot
    out.set(v.id, { x, y: box.top - depth * gap })
    return x
  }
  place(root, 0)
  return out
}

/**
 * Plane labels of coincident or nearly coincident points: a point within LABEL_MERGE of an
 * earlier labelled point joins that point's label instead of getting its own. Each group lists
 * point indices, the labelled point first.
 */
function labelGroups(points: Pt[]): number[][] {
  const groups: number[][] = []
  points.forEach((q, i) => {
    const g = groups.find((m) => Math.hypot(points[m[0]].x - q.x, points[m[0]].y - q.y) <= LABEL_MERGE)
    if (g) g.push(i)
    else groups.push([i])
  })
  return groups
}

/** Ids of `v` and all nodes below it. */
function subtree(v: Tree1DNode, out: Set<number> = new Set()): Set<number> {
  out.add(v.id)
  if (v.kind === 'split') {
    subtree(v.left, out)
    subtree(v.right, out)
  }
  return out
}

const rangeTreePlayer: PlayerModule<RTState, RangeTreeInput> = {
  computeSteps: (input, mode) => rtSteps(input, modeOf(mode)),
  modes: [
    { id: 'full', label: 'Build and query' },
    { id: 'build', label: 'Build only' },
    { id: 'query', label: 'Query only' },
  ],
  // the query block is lines 8–23, the build block 0–7
  dimmedLines: (mode) => (mode === 'build' ? range(8, RT_PSEUDOCODE.length - 1) : mode === 'query' ? range(0, 7) : []),
  pseudocode: RT_PSEUDOCODE,
  hint: 'Drag the points or the corners of the query rectangle. Keys: ← → to step, Space to play or pause.',
  randomInput: () => randomRangeTreeInput(),
  presets: RT_PRESETS.map(({ name, input }) => ({ name, input: copyInput(input) })),
  // StepPlayer asks for the handles without a mode: all of them, and moveHandle keeps the
  // points put in "Query only" and the corners in "Build only"
  handles: ({ points, query }) => [...points.map((p) => clampToBox(RT_PLANE, p)), ...cornerHandles(query, RT_PLANE)],
  moveHandle(input, k, p, mode) {
    const m = modeOf(mode)
    const n = input.points.length
    if (k < 0 || k > n + 1 || (k < n && m === 'query') || (k >= n && m === 'build')) return input
    const next = copyInput(input)
    const q = snap(p)
    if (k < n) next.points[k] = q
    else next.query = moveCorner(input.query, k === n + 1, q)
    return next
  },
  canvas: { width: WIDTH, height: HEIGHT },

  render(scene: Scene, step, input) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const s = step.state
    const { points, query } = input
    const n = points.length
    const c = {
      current: cssColor('--rt-current', '#e66100'),
      path: cssColor('--rt-path', '#1a5fb4'),
      canonical: cssColor('--rt-canonical', '#26a269'),
      slab: cssColor('--rt-slab', '#99c1f1'),
      faint: cssColor('--rt-faint', '#c0bfbc'),
      ink: cssColor('--canvas-ink', '#1c1e21'),
      bg: cssColor('--canvas-bg', '#ffffff'),
    }
    const build = s.phase === 'build'
    const withAlpha = (color: string, a: number) => {
      const col = new P.Color(color)
      col.alpha = a
      return col
    }
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    const rect = (b: Box, style: object) => new P.Path.Rectangle({ from: [b.x0, b.y0], to: [b.x1, b.y1], ...style })
    // the layer is y-flipped: flip text back so that it reads upright
    const text = (content: string, x: number, y: number, size: number, justification = 'left', color: string | paper.Color = c.ink) =>
      new P.PointText({ matrix: new P.Matrix(1, 0, 0, -1, x, y), content, fontSize: size, fillColor: color, justification })

    const nodes = s.nodes
    const current = s.current === null ? undefined : nodes[s.current]
    const reported = new Set(s.reported)
    const path = new Set([...s.pathLo, ...s.pathHi])
    const canonical = new Set(s.canonical)

    // plane: frame, slab, split lines, query rectangle
    rect(RT_PLANE, { strokeColor: withAlpha(c.ink, 0.4), strokeWidth: 1 })
    if (!build) rect({ x0: query.x0, y0: RT_PLANE.y0, x1: query.x1, y1: RT_PLANE.y1 }, { fillColor: withAlpha(c.slab, 0.25), name: 'slab' })
    const vline = (x: number, style: object) => new P.Path.Line({ from: [x, RT_PLANE.y0], to: [x, RT_PLANE.y1], ...style })
    // the build so far splits the plane into x-ranges (faint); the current node's split line in orange
    if (build)
      for (const v of nodes.slice(0, s.builtUpTo))
        if (v.kind === 'split' && v !== current) vline(v.value!, { strokeColor: c.faint, strokeWidth: 1 })
    if (current?.kind === 'split') vline(current.value!, { strokeColor: c.current, strokeWidth: 1.5, dashArray: [5, 3], name: 'split-line' })
    if (s.mode !== 'build') rect(query, { strokeColor: c.ink, strokeWidth: 1.5, dashArray: [6, 4] })
    new P.Path.Line({ from: [SEPARATOR_X, RT_PLANE.y0], to: [SEPARATOR_X, RT_PLANE.y1], strokeColor: withAlpha(c.ink, 0.25), strokeWidth: 1 })
    new P.Path.Line({ from: [MAIN.x0, DIVIDER_Y], to: [MAIN.x1, DIVIDER_Y], strokeColor: withAlpha(c.ink, 0.2), strokeWidth: 1 })

    // ----- main tree -----
    const slot = (MAIN.x1 - MAIN.x0) / Math.max(1, n)
    const labelled = n <= MAX_LABELLED_LEAVES
    const at = layout(mainShape(nodes), MAIN, slot)
    const built = (id: number) => !build || id < s.builtUpTo
    text('Main tree on x', MAIN.x0 + 2, MAIN.y1 - 11, 10, 'left', withAlpha(c.ink, 0.7))
    for (const v of nodes) {
      if (v.parent === null) continue
      const onPath = !build && path.has(v.id) && path.has(v.parent)
      new P.Path.Line({
        from: pt(at.get(v.parent)!),
        to: pt(at.get(v.id)!),
        strokeColor: !built(v.id) ? c.faint : onPath ? c.path : withAlpha(c.ink, 0.5),
        strokeWidth: onPath ? 2.5 : 1,
      })
    }
    /** Fill of a main-tree node, null for the default (white split node, ink leaf). */
    const mainFill = (v: RTNodeView): string | null => {
      if (!built(v.id)) return null
      if (v.id === s.current) return c.current
      if (build) return null
      if (canonical.has(v.id) || (v.point !== undefined && reported.has(v.point))) return c.canonical
      if (path.has(v.id)) return c.path
      return null
    }
    for (const v of nodes) {
      const q = at.get(v.id)!
      const f = mainFill(v)
      const faint = !built(v.id)
      if (v.kind === 'split') {
        new P.Path.Circle({
          center: pt(q),
          radius: labelled ? NODE_RADIUS : SMALL_NODE_RADIUS,
          fillColor: f ?? c.bg,
          strokeColor: faint ? c.faint : (f ?? c.ink),
          strokeWidth: 1.5,
          name: `main-${v.id}`,
        })
        if (labelled) text(v.label, q.x, q.y - 3, 9, 'center', faint ? c.faint : f ? WHITE : c.ink)
      } else {
        new P.Path.Circle({
          center: pt(q),
          radius: LEAF_RADIUS,
          fillColor: faint ? c.bg : (f ?? c.ink),
          strokeColor: faint ? c.faint : (f ?? c.ink),
          strokeWidth: 1,
          name: `main-${v.id}`,
        })
        if (labelled) text(v.label, q.x, q.y - LEAF_RADIUS - 9, 9, 'center', faint ? c.faint : c.ink)
      }
    }
    // the node whose associated tree is drawn below, ringed in the query (in the build it is the current node)
    if (!build && s.assocShown !== null) {
      const v = nodes[s.assocShown]
      new P.Path.Circle({
        center: pt(at.get(v.id)!),
        radius: (v.kind === 'leaf' ? LEAF_RADIUS : labelled ? NODE_RADIUS : SMALL_NODE_RADIUS) + 3.5,
        strokeColor: c.canonical,
        strokeWidth: 1.5,
      })
    }

    // ----- associated tree of assocShown -----
    if (s.assocShown === null) {
      text('No associated tree selected', (ASSOC.x0 + ASSOC.x1) / 2, (ASSOC.y0 + ASSOC.y1) / 2 - 4, 11, 'center', c.faint).name =
        'assoc-empty'
    } else {
      const owner = nodes[s.assocShown]
      // rebuilt from the node's points: the same ids as the state's assocPaths (pre-order)
      const tree = buildTree1D(points, owner.points, 'y')
      const items: paper.Item[] = []
      const title = text(`T_assoc(${owner.label}) on y`, ASSOC.x0 + 2, ASSOC.y1 - 11, 11, 'left')
      title.name = 'assoc-title'
      items.push(title)
      const q1 = s.assocPaths
      const aPath = new Set(q1 ? [...q1.pathLo, ...q1.pathHi] : [])
      const aReported = new Set<number>()
      for (const id of q1?.reported ?? []) {
        const find = (v: Tree1DNode): Tree1DNode | null =>
          v.id === id ? v : v.kind === 'split' ? (find(v.left) ?? find(v.right)) : null
        subtree(find(tree.root!)!, aReported)
      }
      const aResult = new Set(q1?.result ?? [])
      const aLabelled = tree.size <= MAX_LABELLED_LEAVES
      const aAt = layout(tree.root, ASSOC, slot)
      const edges = (v: Tree1DNode) => {
        if (v.kind === 'leaf') return
        for (const ch of [v.left, v.right]) {
          const on = aPath.has(v.id) && aPath.has(ch.id)
          items.push(
            new P.Path.Line({
              from: pt(aAt.get(v.id)!),
              to: pt(aAt.get(ch.id)!),
              strokeColor: on ? c.path : aReported.has(ch.id) ? c.canonical : withAlpha(c.ink, 0.5),
              strokeWidth: on ? 2.5 : aReported.has(ch.id) ? 1.5 : 1,
            }),
          )
          edges(ch)
        }
      }
      if (tree.root) edges(tree.root)
      const draw = (v: Tree1DNode) => {
        const q = aAt.get(v.id)!
        if (v.kind === 'split') {
          // reported subtree roots green, path nodes blue
          const f = q1?.reported.includes(v.id) ? c.canonical : aPath.has(v.id) ? c.path : null
          items.push(
            new P.Path.Circle({
              center: pt(q),
              radius: aLabelled ? NODE_RADIUS : SMALL_NODE_RADIUS,
              fillColor: f ?? c.bg,
              strokeColor: f ?? (aReported.has(v.id) ? c.canonical : c.ink),
              strokeWidth: 1.5,
              name: `assoc-node-split-${v.id}`,
            }),
          )
          // the split value on y, which the 1-D query compares with, rounded so it fits the circle
          if (aLabelled) items.push(text(String(Math.round(v.value)), q.x, q.y - 3, 8, 'center', f ? WHITE : c.ink))
          draw(v.left)
          draw(v.right)
        } else {
          const f = aResult.has(v.point) ? c.canonical : aPath.has(v.id) ? c.path : null
          items.push(
            new P.Path.Circle({ center: pt(q), radius: LEAF_RADIUS, fillColor: f ?? c.ink, strokeColor: f ?? c.ink, strokeWidth: 1, name: `assoc-node-leaf-${v.id}` }),
          )
          if (aLabelled) items.push(text(pointLabel(v.point), q.x, q.y - LEAF_RADIUS - 9, 9, 'center'))
        }
      }
      if (tree.root) draw(tree.root)
      new P.Group({ children: items, name: 'assoc' })
    }

    // ----- points last (they match handles(input)) -----
    const curPoints = new Set(build && current ? current.points : [])
    // the points of the canonical subtree whose associated tree is shown, ringed
    const ringed = new Set(!build && s.assocShown !== null ? nodes[s.assocShown].points : [])
    if (n <= MAX_POINT_LABELS)
      for (const members of labelGroups(points)) {
        const q = points[members[0]]
        // upper right; to the left / below at the plane's right / top edge, which only a drag reaches
        const right = q.x <= RT_PLANE.x1 - 15
        const up = q.y <= RT_PLANE.y1 - 13
        const content = members.length <= 3 ? members.map(pointLabel).join(', ') : `${pointLabel(members[0])} +${members.length - 1}`
        text(content, q.x + (right ? 6 : -6), q.y + (up ? 5 : -13), 10, right ? 'left' : 'right')
      }
    points.forEach((q, i) => {
      if (ringed.has(i)) new P.Path.Circle({ center: pt(q), radius: POINT_RADIUS + 3.5, strokeColor: c.canonical, strokeWidth: 1.5 })
      if (current?.kind === 'leaf' && current.point === i && !build)
        new P.Path.Circle({ center: pt(q), radius: POINT_RADIUS + 3.5, strokeColor: c.current, strokeWidth: 2 })
      new P.Path.Circle({
        center: pt(q),
        radius: POINT_RADIUS,
        fillColor: curPoints.has(i) ? c.current : reported.has(i) ? c.canonical : c.ink,
        name: `point-${i}`,
      })
    })
    // the corners are drawn where they are grabbed (cornerHandles), in modes with a query phase
    if (s.mode !== 'build')
      cornerHandles(query, RT_PLANE).forEach((q, k) => {
        const h = CORNER_SIZE / 2
        rect({ x0: q.x - h, y0: q.y - h, x1: q.x + h, y1: q.y + h }, { fillColor: c.ink, name: `corner-${k}` })
      })
  },

  panels(step, input): Panel[] {
    const s = step.state
    const points = input.points
    const n = points.length
    const v = s.current === null ? undefined : s.nodes[s.current]
    const labels = (ids: number[]) => ids.map(pointLabel).join(', ')
    const node: Panel['rows'] = !v
      ? []
      : [
          {
            text:
              v.kind === 'split'
                ? `${v.label} · x-range [${fmt(points[v.points[0]].x)}, ${fmt(points[v.points[v.points.length - 1]].x)}] · ${count(v.points.length, 'point')}`
                : `leaf ${v.label} · (${fmt(points[v.point!].x)}, ${fmt(points[v.point!].y)})`,
            highlight: 'active',
          },
          { text: `associated leaves in y order: ${labels([...v.points].sort((a, b) => compareOn(points, 'y', a, b)))}` },
        ]
    const k = s.counts
    const started = s.reported.length || s.canonical.length || s.checked.length
    const result: Panel['rows'] =
      s.phase === 'build' || !started
        ? []
        : [
            { text: `${count(s.reported.length, 'point')} reported${s.reported.length ? `: ${labels(s.reported)}` : ''}` },
            { text: `${count(s.canonical.length, 'canonical subtree')} · ${count(k.assocQueries, 'associated query', 'associated queries')}` },
            ...(s.checked.length ? [{ text: `checked one by one: ${labels(s.checked)}` }] : []),
          ]
    // the whole tree's totals, in the build too (`nodes` is always the full tree; `counts` would
    // be running totals there): each point is stored once per main-tree node on its root path,
    // so at most n·(depth + 1)
    const total = s.nodes.reduce((sum, x) => sum + x.points.length, 0)
    const depth = s.nodes.reduce((d, x) => Math.max(d, x.depth), 0)
    const bound = n * (depth + 1)
    const storage = [
      {
        text:
          `n = ${n} · main tree ${count(s.nodes.length, 'node')} · associated trees ${count(total, 'leaf', 'leaves')} ` +
          `${total === bound ? '=' : '≤'} n·(depth + 1) = ${bound}`,
      },
      { text: `a kd-tree stores n = ${n} ${n === 1 ? 'point' : 'points'} once` },
    ]
    return [
      { title: 'Node', empty: 'No node yet', rows: node },
      { title: 'Result', empty: 'Nothing reported yet', rows: result },
      { title: 'Storage', rows: storage },
    ]
  },
}

export default rangeTreePlayer
