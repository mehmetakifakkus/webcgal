import { afterEach, expect, test } from 'vitest'
import { createElement } from 'react'
import { render as renderReact } from 'vitest-browser-react'
import paper from 'paper'
import StepPlayer from '../components/StepPlayer'
import { createScene, type Scene } from '../engine/scene'
import { GALLERY_PRESETS } from '../geometry/algorithms/artGallery/presets'
import { GALLERY_PSEUDOCODE } from '../geometry/algorithms/artGallery/pseudocode'
import { isSimple, signedArea } from '../geometry/algorithms/triangulation/polygon'
import { pointInPolygon } from '../geometry/algorithms/triangulation/verify'
import type { ArtGalleryInput, Pt } from '../geometry/types'
import themeCss from '../styles/theme.css?raw'
import artGalleryPlayer from './artGalleryPlayer'

const scenes: Scene[] = []
afterEach(() => {
  scenes.splice(0).forEach((s) => s.dispose())
})
function makeScene() {
  const canvas = document.createElement('canvas')
  canvas.width = 775
  canvas.height = 360
  document.body.appendChild(canvas)
  const scene = createScene(canvas)
  scenes.push(scene)
  return scene
}
const items = (scene: Scene) => scene.paper.project.activeLayer.children
const uncovered = (scene: Scene) => items(scene).filter((c) => c.name === 'uncovered') as paper.PathItem[]
const uncoveredArea = (scene: Scene) => uncovered(scene).reduce((s, p) => s + Math.abs((p as paper.Path).area), 0)
const polygonArea = (poly: Pt[]) =>
  Math.abs(poly.reduce((s, p, i) => s + p.x * poly[(i + 1) % poly.length].y - poly[(i + 1) % poly.length].x * p.y, 0)) / 2

const presetInput = (name: string): ArtGalleryInput => artGalleryPlayer.presets!.find((p) => p.name === name)!.input
const SQUARE: Pt[] = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 300 },
  { x: 100, y: 300 },
]
const BOWTIE: Pt[] = [
  { x: 100, y: 100 },
  { x: 300, y: 300 },
  { x: 300, y: 100 },
  { x: 100, y: 300 },
]
const SIMPLE = 'The polygon must be simple (no crossing edges)'

test('random input is a simple polygon with 10–16 vertices', () => {
  const sizes = new Set<number>()
  for (let k = 0; k < 60; k++) {
    const input = artGalleryPlayer.randomInput()
    const n = input.polygon.length
    sizes.add(n)
    expect(n).toBeGreaterThanOrEqual(10)
    expect(n).toBeLessThanOrEqual(16)
    expect(isSimple(input.polygon)).toBe(true)
    expect(artGalleryPlayer.validate!(input)).toBeNull()
    expect(input.cameras).toEqual([])
    for (const p of input.polygon) {
      expect(p.x).toBeGreaterThanOrEqual(15)
      expect(p.x).toBeLessThanOrEqual(760)
      expect(p.y).toBeGreaterThanOrEqual(15)
      expect(p.y).toBeLessThanOrEqual(345)
      // a star of radii 60–150 around the centre, stretched 2.2× horizontally
      const r = Math.hypot((p.x - 387) / 2.2, p.y - 180)
      expect(r).toBeGreaterThanOrEqual(60 - 1e-9)
      expect(r).toBeLessThanOrEqual(150 + 1e-9)
    }
  }
  expect(sizes.size).toBeGreaterThan(3)
})

const distToSegment = (p: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
const onBoundary = (p: Pt, poly: Pt[]) => poly.some((a, i) => distToSegment(p, a, poly[(i + 1) % poly.length]) < 1e-6)

test('dual-tree arcs stay inside the room (centroid → diagonal midpoint → centroid)', () => {
  const scene = makeScene()
  for (const preset of GALLERY_PRESETS) {
    const input = presetInput(preset.name)
    const poly = input.polygon
    const steps = artGalleryPlayer.computeSteps(input, 'fisk')
    const step = steps[steps.length - 1]
    artGalleryPlayer.render(scene, step, input)
    const arcs = items(scene).filter(
      (c): c is paper.Path => c instanceof scene.paper.Path && !c.closed && !!c.dashArray && c.dashArray.length > 0,
    )
    expect(arcs, preset.name).toHaveLength(step.state.dualEdges.length)
    for (const arc of arcs) {
      expect(arc.segments, preset.name).toHaveLength(3)
      const pts = arc.segments.map((g) => ({ x: g.point.x, y: g.point.y }))
      for (let k = 0; k < 2; k++)
        for (let t = 0; t <= 10; t++) {
          const p = { x: pts[k].x + ((pts[k + 1].x - pts[k].x) * t) / 10, y: pts[k].y + ((pts[k + 1].y - pts[k].y) * t) / 10 }
          expect(pointInPolygon(p, poly) || onBoundary(p, poly), `${preset.name} (${p.x}, ${p.y})`).toBe(true)
        }
    }
  }
})

test('vertex labels sit outside the room, clear of their walls, inside the canvas', () => {
  const scene = makeScene()
  const star = presetInput('Star')
  const rooms = [
    ...GALLERY_PRESETS.map((p) => ({ name: p.name, input: presetInput(p.name) })),
    { name: 'Star (clockwise)', input: { polygon: [...star.polygon].reverse(), cameras: [] } },
  ]
  expect(signedArea(rooms[rooms.length - 1].input.polygon)).toBeLessThan(0)
  for (const { name, input } of rooms) {
    const poly = input.polygon
    const n = poly.length
    artGalleryPlayer.render(scene, artGalleryPlayer.computeSteps(input, 'fisk')[0], input)
    const labels = items(scene).filter((c): c is paper.PointText => c instanceof scene.paper.PointText)
    expect(labels, name).toHaveLength(n)
    labels.forEach((text, i) => {
      expect(text.content).toBe(`v${i + 1}`)
      expect(text.fontSize).toBe(13)
      expect(text.fillColor?.toCSS(true)).toBe('#1c1e21')
      // the glyphs' centre, 0.36 em above the baseline (the text's flipped matrix sits on the baseline)
      const anchor = { x: text.bounds.center.x, y: text.matrix.ty + 0.36 * 13 }
      expect(text.matrix.d).toBe(-1)
      const where = `${name} v${i + 1} (${anchor.x.toFixed(1)}, ${anchor.y.toFixed(1)})`
      expect(!pointInPolygon(anchor, poly) || onBoundary(anchor, poly), where).toBe(true)
      expect(distToSegment(anchor, poly[(i + n - 1) % n], poly[i]), where).toBeGreaterThan(4)
      expect(distToSegment(anchor, poly[i], poly[(i + 1) % n]), where).toBeGreaterThan(4)
      // the glyphs (0.72 em tall) keep clear of the corner's disc, square or ring
      const gap = Math.hypot(
        Math.max(0, Math.abs(anchor.x - poly[i].x) - text.bounds.width / 2),
        Math.max(0, Math.abs(anchor.y - poly[i].y) - 0.36 * 13),
      )
      expect(gap, where).toBeGreaterThanOrEqual(7.9)
      expect(text.bounds.left, where).toBeGreaterThanOrEqual(0)
      expect(text.bounds.right, where).toBeLessThanOrEqual(775)
      expect(text.bounds.top, where).toBeGreaterThanOrEqual(0)
      expect(text.bounds.bottom, where).toBeLessThanOrEqual(360)
    })
  }
})

test('modes, dimmed lines, pseudocode, hint and colours', () => {
  expect(artGalleryPlayer.modes).toEqual([
    { id: 'fisk', label: "Fisk's construction" },
    { id: 'sandbox', label: 'Place your own cameras' },
  ])
  expect(artGalleryPlayer.dimmedLines!('sandbox')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  expect(artGalleryPlayer.dimmedLines!('fisk')).toEqual([])
  expect(artGalleryPlayer.pseudocode).toEqual(GALLERY_PSEUDOCODE)
  expect(artGalleryPlayer.hint).toBe(
    'Drag the corners to change the room; in the camera mode, click a corner to place or remove a camera. Keys: ← → to step, Space to play or pause.',
  )
  expect(artGalleryPlayer.canvas).toEqual({ width: 775, height: 360 })
  const colours = {
    '--ag-c0': '#c01c28',
    '--ag-c1': '#26a269',
    '--ag-c2': '#1a5fb4',
    '--ag-diag': '#9aa0a6',
    '--ag-dual': '#5e5c64',
    '--ag-current': '#e66100',
    '--ag-view': '#f5c211',
    '--ag-uncovered': '#c01c28',
  }
  // the light block and the dark block
  for (const [name, value] of Object.entries(colours))
    expect(themeCss.split(`${name}: ${value};`).length - 1, name).toBe(2)
})

test('render is pure', () => {
  const scene = makeScene()
  const input = presetInput('Textbook polygon')
  const fisk = artGalleryPlayer.computeSteps(input, 'fisk')
  const sandbox = artGalleryPlayer.computeSteps({ ...input, cameras: [1, 5] }, 'sandbox')
  const picks = [fisk[0], fisk[1], fisk[2], fisk[5], fisk[fisk.length - 3], fisk[fisk.length - 2], fisk[fisk.length - 1], sandbox[0]]
  for (const step of picks) {
    const used = step.state.mode === 'sandbox' ? { ...input, cameras: [1, 5] } : input
    artGalleryPlayer.render(scene, step, used)
    const n = items(scene).length
    const json = items(scene).map((c) => c.className + ':' + c.bounds.toString())
    artGalleryPlayer.render(scene, step, used)
    expect(items(scene).length).toBe(n)
    expect(items(scene).map((c) => c.className + ':' + c.bounds.toString())).toEqual(json)
    expect(n).toBeGreaterThan(0)
    // nothing is left outside the layer (e.g. boolean operands)
    expect(scene.paper.project.layers).toHaveLength(1)
  }
})

test('last Fisk step: cameras ≤ ⌊n/3⌋ and no uncovered area drawn', () => {
  const scene = makeScene()
  for (const preset of GALLERY_PRESETS) {
    const input = presetInput(preset.name)
    const steps = artGalleryPlayer.computeSteps(input, 'fisk')
    const last = steps[steps.length - 1]
    const n = input.polygon.length
    expect(last.state.phase).toBe('done')
    expect(last.state.cameras.length).toBeLessThanOrEqual(Math.floor(n / 3))
    expect(last.state.cameras.length).toBe(preset.expected.cameras)
    artGalleryPlayer.render(scene, last, input)
    expect(uncovered(scene), preset.name).toHaveLength(0)
    // Fisk's cameras leave nothing uncovered in the camera mode either
    const own = { polygon: input.polygon, cameras: last.state.cameras }
    artGalleryPlayer.render(scene, artGalleryPlayer.computeSteps(own, 'sandbox')[0], own)
    const covered = artGalleryPlayer.computeSteps(own, 'sandbox')[0].state.coverage!.covered
    expect(covered, preset.name).toBe(true)
    expect(uncovered(scene), preset.name).toHaveLength(0)
    const coverage = artGalleryPlayer.panels!(last, input).find((p) => p.title === 'Coverage')!
    expect(coverage.rows[0].text).toBe(
      `n = ${n} · ⌊n/3⌋ = ${Math.floor(n / 3)} · cameras ${last.state.cameras.length} · covered 100%`,
    )
  }
})

test('colouring steps: every triangle has three different colours', () => {
  const scene = makeScene()
  for (const preset of GALLERY_PRESETS) {
    const input = presetInput(preset.name)
    const steps = artGalleryPlayer.computeSteps(input, 'fisk')
    const colouring = steps.filter((s) => s.state.phase === 'color')
    expect(colouring.length).toBe(input.polygon.length - 2)
    for (const step of colouring) {
      const c = step.state.colors
      for (const t of step.state.triangles) {
        const known = t.map((v) => c[v]).filter((x) => x !== null)
        expect(new Set(known).size).toBe(known.length)
      }
    }
    const final = steps[steps.length - 1].state
    for (const t of final.triangles) expect(new Set(t.map((v) => final.colors[v])).size).toBe(3)
    // the coloured vertices are drawn as discs in their colour
    const step = colouring[colouring.length - 1]
    artGalleryPlayer.render(scene, step, input)
    const discs = items(scene).filter((c) => c.name === 'vertex') as paper.Path[]
    expect(discs).toHaveLength(input.polygon.length)
    const hex = ['#c01c28', '#26a269', '#1a5fb4']
    discs.forEach((d, i) => expect(d.fillColor?.toCSS(true)).toBe(hex[step.state.colors[i]!]))
  }
})

test('sandbox clickHandle toggles a camera', () => {
  const input: ArtGalleryInput = { polygon: SQUARE, cameras: [] }
  const a = artGalleryPlayer.clickHandle!(input, 2, 'sandbox')
  expect(a.cameras).toEqual([2])
  const b = artGalleryPlayer.clickHandle!(a, 0, 'sandbox')
  expect(b.cameras).toEqual([0, 2])
  const c = artGalleryPlayer.clickHandle!(b, 3, 'sandbox')
  expect(c.cameras).toEqual([0, 2, 3])
  const d = artGalleryPlayer.clickHandle!(c, 2, 'sandbox')
  expect(d.cameras).toEqual([0, 3])
  // inputs are left unchanged
  expect(input.cameras).toEqual([])
  expect(b.cameras).toEqual([0, 2])
  expect(d.polygon).toEqual(SQUARE)
  // a list that is not sorted or has duplicates comes back ascending and deduplicated
  expect(artGalleryPlayer.clickHandle!({ polygon: SQUARE, cameras: [3, 1, 3] }, 0, 'sandbox').cameras).toEqual([0, 1, 3])
  // in Fisk's mode a click does nothing
  expect(artGalleryPlayer.clickHandle!(input, 2, 'fisk')).toEqual(input)
  // out-of-range cameras (from another polygon) are dropped, not fatal
  const stale: ArtGalleryInput = { polygon: SQUARE, cameras: [1, 9, 14] }
  const steps = artGalleryPlayer.computeSteps(stale, 'sandbox')
  expect(steps[0].state.cameras).toEqual([1])
  expect(artGalleryPlayer.clickHandle!(stale, 2, 'sandbox').cameras).toEqual([1, 2])
  const scene = makeScene()
  artGalleryPlayer.render(scene, steps[0], stale)
  expect(() => artGalleryPlayer.panels!(steps[0], stale)).not.toThrow()
})

test('sandbox moveHandle keeps the input; Fisk moveHandle moves the vertex', () => {
  const input: ArtGalleryInput = { polygon: SQUARE, cameras: [1] }
  expect(artGalleryPlayer.handles(input)).toEqual(SQUARE)
  expect(artGalleryPlayer.moveHandle(input, 0, { x: 5, y: 6 }, 'sandbox')).toEqual(input)
  const moved = artGalleryPlayer.moveHandle(input, 0, { x: 120, y: 80 }, 'fisk')
  expect(moved.polygon[0]).toEqual({ x: 120, y: 80 })
  expect(moved.polygon.slice(1)).toEqual(SQUARE.slice(1))
  expect(moved.cameras).toEqual([1])
  expect(input.polygon[0]).toEqual({ x: 100, y: 100 })
})

test('uncovered area > 0 without cameras', () => {
  const scene = makeScene()
  const input = presetInput('Comb')
  const area = polygonArea(input.polygon)
  const empty = artGalleryPlayer.computeSteps(input, 'sandbox')[0]
  expect(empty.description).toBe('No cameras yet: click a corner to place one')
  artGalleryPlayer.render(scene, empty, input)
  expect(uncoveredArea(scene)).toBeGreaterThan(0)
  expect(uncoveredArea(scene)).toBeCloseTo(area, 0)
  // one camera covers part of the room
  const one = { ...input, cameras: [0] }
  artGalleryPlayer.render(scene, artGalleryPlayer.computeSteps(one, 'sandbox')[0], one)
  expect(uncoveredArea(scene)).toBeGreaterThan(0)
  expect(uncoveredArea(scene)).toBeLessThan(area * 0.95)
  // the uncovered area is drawn in --ag-uncovered at alpha .35, outlined in the same colour
  const region = uncovered(scene)[0]
  expect(region.fillColor!.alpha).toBeCloseTo(0.35, 5)
  expect(region.strokeColor?.toCSS(true)).toBe('#c01c28')
  expect(region.strokeWidth).toBe(1.5)
  // a convex room is covered by any single camera
  const convex = { ...presetInput('Convex room'), cameras: [4] }
  artGalleryPlayer.render(scene, artGalleryPlayer.computeSteps(convex, 'sandbox')[0], convex)
  expect(uncovered(scene)).toHaveLength(0)
})

test('a thin uncovered sliver is outlined over the walls; a covered room has no red', () => {
  const scene = makeScene()
  // two cameras on the textbook polygon leave a thin sliver along the wall v12–v11
  const input = { ...presetInput('Textbook polygon'), cameras: [3, 6] }
  const step = artGalleryPlayer.computeSteps(input, 'sandbox')[0]
  expect(step.state.coverage!.covered).toBe(false)
  expect(step.description).toMatch(/^2 cameras · 9\d% covered$/)
  artGalleryPlayer.render(scene, step, input)
  const [region] = uncovered(scene)
  expect(region).toBeDefined()
  expect(Math.abs((region as paper.Path).area)).toBeGreaterThan(1)
  expect(region.strokeColor?.toCSS(true)).toBe('#c01c28')
  expect(region.strokeWidth).toBe(1.5)
  // drawn after the room's outline (the closed 2 px path), so the walls do not hide it
  const room = items(scene).findIndex((c) => c instanceof scene.paper.Path && c.closed && c.strokeWidth === 2)
  expect(room).toBeGreaterThanOrEqual(0)
  expect(region.index).toBeGreaterThan(room)
  // the sampled coverage decides: a covered room gets no red at all
  for (const preset of GALLERY_PRESETS) {
    const fisk = artGalleryPlayer.computeSteps(presetInput(preset.name), 'fisk')
    const own = { polygon: preset.polygon, cameras: fisk[fisk.length - 1].state.cameras }
    const s = artGalleryPlayer.computeSteps(own, 'sandbox')[0]
    expect(s.state.coverage!.covered).toBe(true)
    artGalleryPlayer.render(scene, s, own)
    expect(uncovered(scene), preset.name).toHaveLength(0)
  }
})

test('the dual tree is drawn apart from the diagonals', () => {
  const scene = makeScene()
  const input = presetInput('Textbook polygon')
  const steps = artGalleryPlayer.computeSteps(input, 'fisk')
  const dual = steps.find((s) => s.state.phase === 'dual')!
  artGalleryPlayer.render(scene, dual, input)
  const lines = items(scene).filter((c): c is paper.Path => c instanceof scene.paper.Path && !c.closed)
  const arcs = lines.filter((p) => p.dashArray && p.dashArray.length > 0)
  const diagonals = lines.filter((p) => !p.dashArray || p.dashArray.length === 0)
  expect(arcs).toHaveLength(dual.state.dualEdges.length)
  expect(diagonals).toHaveLength(input.polygon.length - 3)
  for (const a of arcs) {
    expect(a.strokeColor?.toCSS(true)).toBe('#5e5c64')
    expect(a.strokeWidth).toBe(1.5)
  }
  for (const d of diagonals) {
    expect(d.strokeColor?.toCSS(true)).toBe('#9aa0a6')
    expect(d.strokeWidth).toBe(1)
  }
  // a node per triangle (r = 3.5), the current one in --ag-current (r = 5.5)
  const nodes = (r: number) =>
    items(scene).filter((c) => c instanceof scene.paper.Path && c.closed && Math.abs(c.bounds.width - 2 * r) < 1e-6)
  expect(nodes(3.5)).toHaveLength(dual.state.triangles.length)
  const colour = steps.find((s) => s.state.phase === 'color')!
  artGalleryPlayer.render(scene, colour, input)
  const current = nodes(5.5) as paper.Path[]
  expect(current).toHaveLength(1)
  expect(current[0].fillColor?.toCSS(true)).toBe('#e66100')
})

test('panels by phase', () => {
  const input = presetInput('Textbook polygon')
  const steps = artGalleryPlayer.computeSteps(input, 'fisk')
  const panelsOf = (k: number) => artGalleryPlayer.panels!(steps[k], input)
  const titles = (k: number) => panelsOf(k).map((p) => p.title)
  const at = (phase: string) => steps.findIndex((s) => s.state.phase === phase)
  expect(titles(at('triangulate'))).toEqual(['Colours'])
  expect(titles(at('dual'))).toEqual(['Colours'])
  expect(titles(at('color'))).toEqual(['Colours'])
  expect(titles(at('choose'))).toEqual(['Colours'])
  expect(titles(at('place'))).toEqual(['Colours', 'Cameras', 'Coverage'])
  expect(titles(at('done'))).toEqual(['Colours', 'Cameras', 'Coverage'])

  // before any colouring: the empty text
  const first = panelsOf(0)[0]
  expect(first.rows).toEqual([])
  expect(first.empty).toBe('No vertex coloured yet')
  // the first triangle: three rows, all new
  const c3 = panelsOf(at('color'))[0]
  expect(c3.rows).toHaveLength(3)
  expect(c3.rows.every((r) => r.highlight === 'new')).toBe(true)
  // a later colouring step: only the row of the new colour is new
  const k6 = steps.findIndex((s) => s.line === 6)
  const s6 = steps[k6].state
  const c6 = panelsOf(k6)[0]
  const newColour = s6.colors[s6.newlyColored![0]]!
  const names = ['red', 'green', 'blue']
  expect(c6.rows.filter((r) => r.highlight === 'new').map((r) => r.text.split(':')[0])).toEqual([names[newColour]])
  // the chosen colour is the active row; rows read "red: v1 v4 · 2"
  const done = steps[steps.length - 1].state
  const colours = panelsOf(steps.length - 1)[0]
  expect(colours.rows).toHaveLength(3)
  colours.rows.forEach((r, c) => {
    const members = done.colors.flatMap((x, i) => (x === c ? [`v${i + 1}`] : []))
    expect(r.text).toBe(`${names[c]}: ${members.join(' ')} · ${members.length}`)
    expect(r.highlight).toBe(c === done.chosen ? 'active' : undefined)
  })
  // cameras: one row per camera
  const cams = panelsOf(steps.length - 1)[1]
  expect(cams.rows.map((r) => r.text.split(' ')[0])).toEqual(done.cameras.map((c) => `v${c + 1}`))
  for (const r of cams.rows) expect(r.text).toMatch(/^v\d+ sees \d+% of the room$/)

  // sandbox: cameras and coverage
  const sandbox = artGalleryPlayer.computeSteps(input, 'sandbox')
  const sp = artGalleryPlayer.panels!(sandbox[0], input)
  expect(sp.map((p) => p.title)).toEqual(['Cameras', 'Coverage'])
  expect(sp[0].rows).toEqual([])
  expect(sp[0].empty).toBe('No cameras yet')
  expect(sp[1].rows[0].text).toBe('n = 14 · ⌊n/3⌋ = 4 · cameras 0 · covered 0%')
  const two = { ...input, cameras: [0, 7] }
  const s2 = artGalleryPlayer.computeSteps(two, 'sandbox')[0]
  const p2 = artGalleryPlayer.panels!(s2, two)
  expect(p2[0].rows.map((r) => r.text.split(' ')[0])).toEqual(['v1', 'v8'])
  const cov = s2.state.coverage!
  const pct = cov.covered ? 100 : Math.min(cov.percent, 99)
  expect(p2[1].rows[0].text).toBe(`n = 14 · ⌊n/3⌋ = 4 · cameras 2 · covered ${pct}%`)
})

test('percentages never read 100% while the room is not covered', () => {
  // a long room with a tiny notch: one camera sees almost everything
  const room: Pt[] = [
    { x: 20, y: 20 },
    { x: 750, y: 20 },
    { x: 750, y: 340 },
    { x: 60, y: 340 },
    { x: 60, y: 330 },
    { x: 50, y: 330 },
    { x: 50, y: 340 },
    { x: 20, y: 340 },
  ]
  const input = { polygon: room, cameras: [1] }
  const step = artGalleryPlayer.computeSteps(input, 'sandbox')[0]
  const cov = step.state.coverage!
  expect(cov.covered).toBe(false)
  expect(cov.percent).toBe(100)
  const [cams, coverage] = artGalleryPlayer.panels!(step, input)
  expect(cams.rows[0].text).toBe('v2 sees 99% of the room')
  expect(coverage.rows[0].text).toBe('n = 8 · ⌊n/3⌋ = 2 · cameras 1 · covered 99%')
})

test('presets expose six names', () => {
  expect(artGalleryPlayer.presets!.map((p) => p.name)).toEqual([
    'Comb',
    'Textbook polygon',
    'Convex room',
    'L-shaped gallery',
    'Star',
    'Spiral corridor',
  ])
  for (const p of artGalleryPlayer.presets!) {
    expect(p.input.cameras).toEqual([])
    expect(artGalleryPlayer.validate!(p.input)).toBeNull()
  }
  // presets are copies
  expect(artGalleryPlayer.presets![0].input.polygon).not.toBe(GALLERY_PRESETS[0].polygon)
})

test('invalid polygon shows the alert text', async () => {
  expect(artGalleryPlayer.validate!({ polygon: SQUARE, cameras: [] })).toBeNull()
  expect(artGalleryPlayer.validate!({ polygon: BOWTIE, cameras: [] })).toBe(SIMPLE)
  // clockwise rooms are fine (the geometry handles either orientation)
  expect(artGalleryPlayer.validate!({ polygon: [...SQUARE].reverse(), cameras: [] })).toBeNull()
  // consecutive vertices closer than 0.001
  const close = [...SQUARE.slice(0, 2), { x: 300, y: 100.0005 }, ...SQUARE.slice(2)]
  expect(artGalleryPlayer.validate!({ polygon: close, cameras: [] })).toBe(SIMPLE)
  expect(artGalleryPlayer.validate!({ polygon: SQUARE.slice(0, 2), cameras: [] })).toBe(SIMPLE)

  const scene = makeScene()
  artGalleryPlayer.renderInvalid!(scene, { polygon: BOWTIE, cameras: [] })
  expect(items(scene).length).toBeGreaterThanOrEqual(8)

  const screen = await renderReact(
    createElement(StepPlayer, { module: { ...artGalleryPlayer, randomInput: () => ({ polygon: BOWTIE, cameras: [] }) } }),
  )
  await expect.element(screen.getByRole('alert')).toHaveTextContent(SIMPLE)
})
