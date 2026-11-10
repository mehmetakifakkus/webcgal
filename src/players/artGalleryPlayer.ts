import type paper from 'paper'
import { MIN_VERTEX_DISTANCE } from '../engine/triangulation'
import type { Scene } from '../engine/scene'
import { colorName, label } from '../geometry/algorithms/artGallery/fisk'
import type { Colour, GalleryCoverage, GalleryState } from '../geometry/algorithms/artGallery/galleryState'
import { gallerySteps } from '../geometry/algorithms/artGallery/gallerySteps'
import { GALLERY_PRESETS } from '../geometry/algorithms/artGallery/presets'
import { GALLERY_PSEUDOCODE } from '../geometry/algorithms/artGallery/pseudocode'
import { coverage } from '../geometry/algorithms/artGallery/visibility'
import { isSimple } from '../geometry/algorithms/triangulation/polygon'
import { randomStarPolygon } from '../geometry/algorithms/triangulation/verify'
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
const VIEW_ALPHA = 0.25
const UNCOVERED_ALPHA = 0.35

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

/** A random star-shaped room of 10–16 vertices inside the canvas, without cameras. */
function randomInput(): ArtGalleryInput {
  for (let k = 0; k < 20; k++) {
    const polygon = randomStarPolygon(Math.random, 10 + Math.floor(Math.random() * 7), 387, 180, 40, 150)
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
  } catch {
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

    // what the cameras see, and (camera mode) what nobody sees
    for (const r of s.visibility)
      if (r.length >= 3) new P.Path({ segments: r.map(pt), closed: true, fillColor: withAlpha(c.view, VIEW_ALPHA) })
    if (sandbox) {
      const rest = uncoveredRegion(P, poly, s.visibility)
      if (rest) {
        rest.fillColor = withAlpha(c.uncovered, UNCOVERED_ALPHA)
        rest.strokeColor = null
        rest.name = 'uncovered'
        P.project.activeLayer.addChild(rest)
      }
    }

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

    // the dual tree, from line 2 on: arcs between the triangles' centroids, a node per triangle
    if (!sandbox && s.phase !== 'triangulate') {
      for (const [i, j] of s.dualEdges)
        new P.Path({
          segments: [pt(centroid(s.triangles[i])), pt(centroid(s.triangles[j]))],
          strokeColor: c.diag,
          strokeWidth: 1,
          dashArray: [4, 3],
        })
      s.triangles.forEach((t, i) => {
        const active = i === s.current
        new P.Path.Circle({ center: pt(centroid(t)), radius: active ? 5 : 2.5, fillColor: active ? c.current : c.diag })
      })
    }

    // the room
    new P.Path({ segments: poly.map(pt), closed: true, strokeColor: c.ink, strokeWidth: 2, strokeJoin: 'round' })

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

    // labels (the layer is y-flipped: flip back so that they read upright); below a corner near the top
    poly.forEach((q, i) => {
      new P.PointText({
        matrix: new P.Matrix(1, 0, 0, -1, q.x + 8, q.y + 8 + LABEL_SIZE > HEIGHT ? q.y - 8 - LABEL_SIZE : q.y + 8),
        content: label(i),
        fontSize: LABEL_SIZE,
        fillColor: c.ink,
      })
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
