import type paper from 'paper'
import { MIN_VERTEX_DISTANCE } from '../engine/triangulation'
import type { Scene } from '../engine/scene'
import { colorName, label } from '../geometry/algorithms/artGallery/fisk'
import type { Colour, GalleryCoverage, GalleryState } from '../geometry/algorithms/artGallery/galleryState'
import { gallerySteps } from '../geometry/algorithms/artGallery/gallerySteps'
import { GALLERY_PRESETS } from '../geometry/algorithms/artGallery/presets'
import { GALLERY_PSEUDOCODE } from '../geometry/algorithms/artGallery/pseudocode'
import { coverage } from '../geometry/algorithms/artGallery/visibility'
import { isSimple, signedArea } from '../geometry/algorithms/triangulation/polygon'
import { pointInPolygon, randomStarPolygon } from '../geometry/algorithms/triangulation/verify'
import type { ArtGalleryInput, Pt } from '../geometry/types'
import { cssColor } from './cssColor'
import type { Panel, PlayerModule } from './types'

const WIDTH = 775
const HEIGHT = 360
const INVALID_MESSAGE = 'The polygon must be simple (no crossing edges)'
/** Uncovered pieces smaller than this (scene units²) are rounding slivers of the boolean operations. */
const MIN_UNCOVERED_AREA = 0.01
const CAMERA_SIZE = 10
const LABEL_SIZE = 13
/** Least distance from a corner to the centre of its label. */
const LABEL_OFFSET = 13
/** Least gap between a label's glyphs and its corner: clears the corner's disc (r 6) and camera square. */
const LABEL_CLEARANCE = 8
/** Least distance from a label's centre to the corner's two walls. */
const LABEL_WALL_GAP = 4
/** Least distance from a label's text box to the canvas edge. */
const LABEL_MARGIN = 2
/** Half the height of the glyphs: digits and lower case reach about 0.72 em above the baseline. */
const GLYPH_HALF_HEIGHT = 0.36 * LABEL_SIZE
const VIEW_ALPHA = 0.25
const UNCOVERED_ALPHA = 0.35
/** The uncovered area's outline: keeps thin slivers along a wall visible over the room's 2 px outline. */
const UNCOVERED_STROKE = 1.5
const DUAL_WIDTH = 1.5
const DUAL_NODE_RADIUS = 3.5
const DUAL_CURRENT_RADIUS = 5.5

type Mode = 'fisk' | 'sandbox'
const modeOf = (mode?: string): Mode => (mode === 'sandbox' ? 'sandbox' : 'fisk')
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const copyPolygon = (poly: Pt[]) => poly.map((p) => ({ x: p.x, y: p.y }))

/**
 * Camera indices that exist in a polygon of `n` vertices, ascending and without duplicates: a list
 * kept from another polygon (e.g. before a preset was loaded) loses the cameras it cannot have.
 */
const cleanCameras = (cameras: number[], n: number) =>
  [...new Set(cameras.filter((c) => Number.isInteger(c) && c >= 0 && c < n))].sort((a, b) => a - b)

/**
 * Valid = simple, with consecutive vertices at least MIN_VERTEX_DISTANCE apart (as the API asks of
 * a polygon): the visibility polygons assume it. Either orientation; one message for both cases.
 */
function validate(input: ArtGalleryInput): string | null {
  const poly = input.polygon
  const n = poly.length
  if (!isSimple(poly)) return INVALID_MESSAGE
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_VERTEX_DISTANCE) return INVALID_MESSAGE
  }
  return null
}

/**
 * A random star-shaped room of 10–16 vertices filling the canvas, without cameras: a star of
 * radii 60–150 around the origin, stretched 2.2× horizontally and moved to the canvas centre
 * (x 57–717, y 30–330).
 */
function randomInput(): ArtGalleryInput {
  for (let k = 0; k < 20; k++) {
    const star = randomStarPolygon(Math.random, 10 + Math.floor(Math.random() * 7), 0, 0, 60, 150)
    const polygon = star.map((p) => ({ x: 387 + 2.2 * p.x, y: 180 + p.y }))
    if (validate({ polygon, cameras: [] }) === null) return { polygon, cameras: [] }
  }
  return { polygon: copyPolygon(GALLERY_PRESETS[1].polygon), cameras: [] }
}

/**
 * The part of the room no camera sees: the polygon minus the union of the visibility polygons
 * (paper.js boolean operations). Every operand and intermediate result is created outside the
 * scene graph (`insert: false`), so nothing is left behind; the caller inserts the result.
 * Null when nothing (but rounding slivers) is left, or when paper.js fails on a degenerate case.
 */
function uncoveredRegion(P: paper.PaperScope, poly: Pt[], regions: Pt[][]): paper.PathItem | null {
  const path = (pts: Pt[]) =>
    new P.Path({ segments: pts.map((q) => new P.Point(q.x, q.y)), closed: true, insert: false })
  try {
    let union: paper.PathItem | null = null
    for (const r of regions) {
      if (r.length < 3) continue
      const v = path(r)
      union = union ? union.unite(v, { insert: false }) : v
    }
    const room = path(poly)
    const rest = union ? room.subtract(union, { insert: false }) : room
    return Math.abs((rest as paper.Path).area) >= MIN_UNCOVERED_AREA ? rest : null
  } catch (e) {
    if (import.meta.env.DEV) console.warn('artGallery: uncovered area failed', e)
    return null
  }
}

/** The per-camera share shown in the Cameras panel: 100% only for a camera that alone sees all. */
function cameraPercents(poly: Pt[], cameras: number[], cov: GalleryCoverage): number[] {
  return cameras.map((c, i) => {
    const p = cov.perCamera[i]
    if (p < 100) return p
    const alone = cameras.length === 1 ? cov.covered : coverage(poly, [c]).covered
    return alone ? 100 : 99
  })
}

/** Coverage as shown: never 100% while some sample is unseen. */
const coveredPercent = (cov: GalleryCoverage) => (cov.covered ? 100 : Math.min(cov.percent, 99))

function cameraPanels(poly: Pt[], cameras: number[], cov: GalleryCoverage): Panel[] {
  const n = poly.length
  const percents = cameraPercents(poly, cameras, cov)
  return [
    {
      title: 'Cameras',
      empty: 'No cameras yet',
      rows: cameras.map((c, i) => ({ text: `${label(c)} sees ${percents[i]}% of the room` })),
    },
    {
      title: 'Coverage',
      rows: [
        { text: `n = ${n} · ⌊n/3⌋ = ${Math.floor(n / 3)} · cameras ${cameras.length} · covered ${coveredPercent(cov)}%` },
      ],
    },
  ]
}

function colourPanel(s: GalleryState): Panel {
  const rows: Panel['rows'] = []
  for (const c of [0, 1, 2] as Colour[]) {
    const members = s.colors.flatMap((x, i) => (x === c ? [i] : []))
    if (!members.length) continue
    const isNew = s.newlyColored?.some((v) => s.colors[v] === c)
    rows.push({
      text: `${colorName(c)}: ${members.map(label).join(' ')} · ${members.length}`,
      highlight: s.chosen === c ? 'active' : isNew ? 'new' : undefined,
    })
  }
  return { title: 'Colours', empty: 'No vertex coloured yet', rows }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * A label's text box: its width, how far it reaches below and above the glyphs' centre, and half
 * the glyphs' height (GLYPH_HALF_HEIGHT at the label's size).
 */
type LabelBox = { width: number; below: number; above: number; glyphHalf: number }

/**
 * Where the centre of each corner's label goes (the glyphs' centre, not the text's baseline).
 * `boxes[i]` is the text box of label i. The label sits at least LABEL_OFFSET out along the outward
 * bisector of the corner's two walls (the sum of their outward normals; for walls that double
 * back, the next wall's normal), further out when its glyphs would touch the corner's mark, and
 * inside the canvas. When the canvas edge pushes it back onto the mark (a corner near the edge),
 * the direction turns in steps of 15° (up to 90°) to the first spot that is clear of the mark,
 * outside the room and away from the two walls. Either orientation.
 */
function labelAnchors(poly: Pt[], boxes: LabelBox[]): Pt[] {
  const n = poly.length
  const sign = signedArea(poly) >= 0 ? 1 : -1
  // outward normal of the wall a → b of a CCW (y-up) polygon, unit length
  const normal = (a: Pt, b: Pt) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: (sign * (b.y - a.y)) / len, y: (-sign * (b.x - a.x)) / len }
  }
  const wallDistance = (p: Pt, a: Pt, b: Pt) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1)
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
  }
  return poly.map((q, i) => {
    const prev = poly[(i + n - 1) % n]
    const next = poly[(i + 1) % n]
    const n1 = normal(prev, q)
    const n2 = normal(q, next)
    const sum = { x: n1.x + n2.x, y: n1.y + n2.y }
    const len = Math.hypot(sum.x, sum.y)
    const d = len < 1e-9 ? n2 : { x: sum.x / len, y: sum.y / len }
    const { width, below, above, glyphHalf } = boxes[i]
    const halfWidth = width / 2
    const place = (dir: Pt, t: number): Pt => ({
      x: clamp(q.x + t * dir.x, LABEL_MARGIN + halfWidth, WIDTH - LABEL_MARGIN - halfWidth),
      y: clamp(q.y + t * dir.y, LABEL_MARGIN + below, HEIGHT - LABEL_MARGIN - above),
    })
    // the gap between the glyphs' box and the corner
    const gap = (a: Pt) =>
      Math.hypot(Math.max(0, Math.abs(a.x - q.x) - halfWidth), Math.max(0, Math.abs(a.y - q.y) - glyphHalf))
    for (const deg of [0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90]) {
      const r = (deg * Math.PI) / 180
      const dir = { x: d.x * Math.cos(r) - d.y * Math.sin(r), y: d.x * Math.sin(r) + d.y * Math.cos(r) }
      for (let t = LABEL_OFFSET; t <= 3 * LABEL_OFFSET; t += 0.5) {
        const a = place(dir, t)
        if (gap(a) < LABEL_CLEARANCE) continue
        if (!pointInPolygon(a, poly) && wallDistance(a, prev, q) > LABEL_WALL_GAP && wallDistance(a, q, next) > LABEL_WALL_GAP)
          return a
        break
      }
    }
    return place(d, LABEL_OFFSET)
  })
}

function drawPlainPolygon(scene: Scene, poly: Pt[], color: string) {
  const P = scene.paper
  const pt = (q: Pt) => new P.Point(q.x, q.y)
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]
    new P.Path({ segments: [pt(a), pt(b)], strokeColor: color, strokeWidth: 2, strokeCap: 'round' })
  })
}

const artGalleryPlayer: PlayerModule<GalleryState, ArtGalleryInput> = {
  computeSteps: (input, mode) =>
    gallerySteps({ polygon: input.polygon, cameras: cleanCameras(input.cameras, input.polygon.length) }, modeOf(mode)),
  modes: [
    { id: 'fisk', label: "Fisk's construction" },
    { id: 'sandbox', label: 'Place your own cameras' },
  ],
  dimmedLines: (mode) => (modeOf(mode) === 'sandbox' ? range(0, 9) : []),
  validate,
  pseudocode: GALLERY_PSEUDOCODE,
  hint: 'Drag the corners to change the room; in the camera mode, click a corner to place or remove a camera. Keys: ← → to step, Space to play or pause.',
  randomInput,
  presets: GALLERY_PRESETS.map(({ name, polygon }) => ({ name, input: { polygon: copyPolygon(polygon), cameras: [] } })),
  handles: (input) => copyPolygon(input.polygon),
  // in the camera mode the corners stay put: a press on one is a click (see clickHandle)
  moveHandle: (input, k, p, mode) =>
    modeOf(mode) === 'sandbox'
      ? input
      : { polygon: input.polygon.map((q, i) => (i === k ? { x: p.x, y: p.y } : { x: q.x, y: q.y })), cameras: [...input.cameras] },
  clickHandle(input, k, mode) {
    const n = input.polygon.length
    if (modeOf(mode) !== 'sandbox' || !Number.isInteger(k) || k < 0 || k >= n) return input
    const cameras = cleanCameras(input.cameras, n)
    return {
      polygon: copyPolygon(input.polygon),
      cameras: cameras.includes(k) ? cameras.filter((c) => c !== k) : [...cameras, k].sort((a, b) => a - b),
    }
  },
  canvas: { width: WIDTH, height: HEIGHT },

  renderInvalid(scene, input) {
    const P = scene.paper
    P.activate()
    scene.clear()
    drawPlainPolygon(scene, input.polygon, cssColor('--ag-uncovered', '#c01c28'))
    const ink = cssColor('--canvas-ink', '#1c1e21')
    for (const q of input.polygon) new P.Path.Circle({ center: new P.Point(q.x, q.y), radius: 4, fillColor: ink })
  },

  render(scene, step, input) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const s = step.state
    const poly = input.polygon
    const n = poly.length
    const c = {
      colour: [cssColor('--ag-c0', '#c01c28'), cssColor('--ag-c1', '#26a269'), cssColor('--ag-c2', '#1a5fb4')],
      diag: cssColor('--ag-diag', '#9aa0a6'),
      dual: cssColor('--ag-dual', '#5e5c64'),
      current: cssColor('--ag-current', '#e66100'),
      view: cssColor('--ag-view', '#f5c211'),
      uncovered: cssColor('--ag-uncovered', '#c01c28'),
      ink: cssColor('--canvas-ink', '#1c1e21'),
      bg: cssColor('--canvas-bg', '#ffffff'),
    }
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    const withAlpha = (color: string, a: number) => {
      const col = new P.Color(color)
      col.alpha = a
      return col
    }
    const centroid = (t: number[]): Pt => ({
      x: (poly[t[0]].x + poly[t[1]].x + poly[t[2]].x) / 3,
      y: (poly[t[0]].y + poly[t[1]].y + poly[t[2]].y) / 3,
    })
    const sandbox = s.mode === 'sandbox'

    // the active triangle
    if (s.current !== undefined && s.triangles[s.current])
      new P.Path({ segments: s.triangles[s.current].map((v) => pt(poly[v])), closed: true, fillColor: withAlpha(c.current, 0.2) })

    // what the cameras see
    for (const r of s.visibility)
      if (r.length >= 3) new P.Path({ segments: r.map(pt), closed: true, fillColor: withAlpha(c.view, VIEW_ALPHA) })

    // diagonals of the triangulation: triangle sides that are not polygon edges
    const seen = new Set<string>()
    for (const t of s.triangles)
      for (let k = 0; k < 3; k++) {
        const a = Math.min(t[k], t[(k + 1) % 3])
        const b = Math.max(t[k], t[(k + 1) % 3])
        if (b - a === 1 || (a === 0 && b === n - 1) || seen.has(`${a}-${b}`)) continue
        seen.add(`${a}-${b}`)
        new P.Path({ segments: [pt(poly[a]), pt(poly[b])], strokeColor: c.diag, strokeWidth: 1 })
      }

    // the dual tree, from line 2 on: a node per triangle, an arc per shared diagonal, bent at the
    // diagonal's midpoint so that each half stays inside its own triangle
    if (!sandbox && s.phase !== 'triangulate') {
      for (const [i, j] of s.dualEdges) {
        const [a, b] = s.triangles[i].filter((v) => s.triangles[j].includes(v))
        const mid = { x: (poly[a].x + poly[b].x) / 2, y: (poly[a].y + poly[b].y) / 2 }
        new P.Path({
          segments: [pt(centroid(s.triangles[i])), pt(mid), pt(centroid(s.triangles[j]))],
          strokeColor: c.dual,
          strokeWidth: DUAL_WIDTH,
          dashArray: [5, 3],
        })
      }
      s.triangles.forEach((t, i) => {
        const active = i === s.current
        new P.Path.Circle({
          center: pt(centroid(t)),
          radius: active ? DUAL_CURRENT_RADIUS : DUAL_NODE_RADIUS,
          fillColor: active ? c.current : c.dual,
        })
      })
    }

    // the room
    new P.Path({ segments: poly.map(pt), closed: true, strokeColor: c.ink, strokeWidth: 2, strokeJoin: 'round' })

    // camera mode: what nobody sees, over the room's outline so that slivers along a wall show. The
    // sampled coverage decides: a room it calls covered gets no red (patches between grid points
    // would contradict the text).
    if (sandbox && !s.coverage?.covered) {
      const rest = uncoveredRegion(P, poly, s.visibility)
      if (rest) {
        rest.fillColor = withAlpha(c.uncovered, UNCOVERED_ALPHA)
        rest.strokeColor = new P.Color(c.uncovered)
        rest.strokeWidth = UNCOVERED_STROKE
        rest.strokeJoin = 'round'
        rest.name = 'uncovered'
        P.project.activeLayer.addChild(rest)
      }
    }

    // corners: colours (Fisk) or small dots (camera mode); one 'vertex' item per corner, in order
    const cameraSet = new Set(s.cameras)
    poly.forEach((q, i) => {
      if (sandbox) {
        new P.Path.Circle({ center: pt(q), radius: 4, fillColor: c.ink, name: 'vertex' })
        return
      }
      const col = s.colors[i]
      if (col === null) new P.Path.Circle({ center: pt(q), radius: 5, fillColor: c.bg, strokeColor: c.ink, strokeWidth: 1.5, name: 'vertex' })
      else new P.Path.Circle({ center: pt(q), radius: 6, fillColor: c.colour[col], name: 'vertex' })
    })
    // line 7: the chosen colour class is ringed
    if (s.phase === 'choose' && s.chosen !== undefined)
      poly.forEach((q, i) => {
        if (s.colors[i] === s.chosen) new P.Path.Circle({ center: pt(q), radius: 10, strokeColor: c.colour[s.chosen!], strokeWidth: 2 })
      })
    // cameras: squares on their corners
    for (const v of cameraSet) {
      const fill = sandbox ? c.view : c.colour[s.chosen ?? s.colors[v] ?? 0]
      new P.Path.Rectangle({ center: pt(poly[v]), size: [CAMERA_SIZE, CAMERA_SIZE], fillColor: fill, strokeColor: c.ink, strokeWidth: 1.5 })
    }

    // labels outside their corners, the glyphs centred on the anchor: the baseline goes
    // GLYPH_HALF_HEIGHT below it (the layer is y-flipped: the text is flipped back to read upright).
    // The text boxes are measured at the origin, unflipped: y from −ascent to +descent. On a canvas
    // shown small the labels are laid out at the enlarged size (scene.textScale), and StepPlayer
    // leaves them as they are (fixedSize).
    const scale = scene.textScale ?? 1
    const glyphHalf = GLYPH_HALF_HEIGHT * scale
    const texts = poly.map(
      (_, i) =>
        new P.PointText({ content: label(i), fontSize: LABEL_SIZE * scale, fillColor: c.ink, justification: 'center', data: { fixedSize: true } }),
    )
    const boxes = texts.map(({ bounds: b }) => ({
      width: b.width,
      below: b.bottom + glyphHalf,
      above: -b.top - glyphHalf,
      glyphHalf,
    }))
    labelAnchors(poly, boxes).forEach((a, i) => {
      texts[i].matrix = new P.Matrix(1, 0, 0, -1, a.x, a.y - glyphHalf)
    })
  },

  panels(step, input): Panel[] {
    const s = step.state
    const poly = input.polygon
    if (s.mode === 'sandbox') return cameraPanels(poly, s.cameras, s.coverage ?? coverage(poly, s.cameras))
    const panels = [colourPanel(s)]
    if (s.phase === 'place' || s.phase === 'done') panels.push(...cameraPanels(poly, s.cameras, coverage(poly, s.cameras)))
    return panels
  },
}

export default artGalleryPlayer
