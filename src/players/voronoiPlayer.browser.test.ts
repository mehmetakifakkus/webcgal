import { afterEach, expect, test } from 'vitest'
import paper from 'paper'
import { createScene, type Scene } from '../engine/scene'
import { CANVAS_BOX } from '../geometry/algorithms/voronoi/clip'
import { VORONOI_PRESETS } from '../geometry/algorithms/voronoi/presets'
import { voronoi } from '../geometry/algorithms/voronoi/voronoi'
import { distance } from '../geometry/primitives'
import voronoiPlayer from './voronoiPlayer'

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
const paths = (scene: Scene) =>
  scene.paper.project.activeLayer.children.filter((c): c is paper.Path => c instanceof scene.paper.Path)
/** Path.Circle items are closed four-segment paths. */
const dashedCircles = (scene: Scene) =>
  paths(scene).filter((p) => p.closed && p.segments.length === 4 && !!p.dashArray && p.dashArray.length > 0)
/** Cell fills are translucent (alpha .18 / .4); sites and vertex squares are opaque. */
const filledPolygons = (scene: Scene) =>
  paths(scene).filter((p) => p.closed && !!p.fillColor && p.fillColor.alpha < 0.5)
/** Delaunay edges: open 1px two-point paths without dashes. */
const thinLines = (scene: Scene) =>
  paths(scene).filter((p) => !p.closed && p.segments.length === 2 && p.strokeWidth === 1 && !(p.dashArray?.length > 0))

const preset = (name: string) => voronoiPlayer.presets!.find((p) => p.name === name)!.input
const textbook = () => preset('Textbook example')

test('random input: 12 points, pairwise ≥ 25', () => {
  for (let k = 0; k < 20; k++) {
    const { points } = voronoiPlayer.randomInput()
    expect(points).toHaveLength(12)
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(93)
      expect(p.x).toBeLessThanOrEqual(682)
      expect(p.y).toBeGreaterThanOrEqual(43)
      expect(p.y).toBeLessThanOrEqual(317)
    }
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) expect(distance(points[i], points[j])).toBeGreaterThanOrEqual(25)
  }
})

test('validate rejects 1 unit apart, accepts 2', () => {
  const pts = [{ x: 10, y: 10 }, { x: 50, y: 20 }, { x: 30, y: 60 }]
  expect(voronoiPlayer.validate!({ points: pts })).toBeNull()
  expect(voronoiPlayer.validate!({ points: [...pts, { x: 51, y: 20 }] })).toBe('Points must be distinct')
  expect(voronoiPlayer.validate!({ points: [...pts, { x: 52, y: 20 }] })).toBeNull()
  const input = { points: pts }
  expect(voronoiPlayer.handles(input)).toEqual(pts)
  const moved = voronoiPlayer.moveHandle(input, 1, { x: 70, y: 90 })
  expect(moved.points[1]).toEqual({ x: 70, y: 90 })
  expect(input.points[1]).toEqual({ x: 50, y: 20 })
  const scene = makeScene()
  voronoiPlayer.renderInvalid!(scene, { points: [...pts, { x: 50, y: 20 }] })
  expect(scene.paper.project.activeLayer.children.length).toBeGreaterThanOrEqual(4)
})

test('render is pure', () => {
  const scene = makeScene()
  const input = textbook()
  const before = JSON.stringify(input)
  for (const mode of ['with-delaunay', 'voronoi-only']) {
    const steps = voronoiPlayer.computeSteps(input, mode)
    const pick = [
      steps[0],
      steps.find((s) => s.line === 3)!,
      steps.find((s) => s.line === 7)!,
      steps.find((s) => s.line === 9)!,
      steps.find((s) => s.line === 11)!,
      steps[steps.length - 1],
    ]
    for (const step of pick) {
      const snap = JSON.stringify(step)
      voronoiPlayer.render(scene, step, input)
      const n = scene.paper.project.activeLayer.children.length
      voronoiPlayer.render(scene, step, input)
      expect(scene.paper.project.activeLayer.children.length).toBe(n)
      expect(n).toBeGreaterThan(0)
      expect(JSON.stringify(step)).toBe(snap)
    }
  }
  expect(JSON.stringify(input)).toBe(before)
})

test('vertex step draws a dashed circle', () => {
  const scene = makeScene()
  const input = textbook()
  const steps = voronoiPlayer.computeSteps(input, 'with-delaunay')
  const step = steps.find((s) => s.line === 3)!
  voronoiPlayer.render(scene, step, input)
  const circles = dashedCircles(scene)
  expect(circles).toHaveLength(1)
  const { center, radius } = step.state.circle!
  expect(circles[0].bounds.center.x).toBeCloseTo(center.x, 3)
  expect(circles[0].bounds.center.y).toBeCloseTo(center.y, 3)
  expect(circles[0].bounds.width / 2).toBeCloseTo(radius, 3)
  // the current triangle is filled
  expect(paths(scene).filter((p) => p.closed && p.segments.length === 3 && !!p.fillColor)).toHaveLength(1)
  voronoiPlayer.render(scene, steps[0], input)
  expect(dashedCircles(scene)).toHaveLength(0)
})

test('ray step stays inside the canvas', () => {
  const scene = makeScene()
  const input = textbook()
  const steps = voronoiPlayer.computeSteps(input, 'with-delaunay')
  const step = steps.find((s) => s.line === 9)!
  voronoiPlayer.render(scene, step, input)
  const all = paths(scene)
  expect(all.length).toBeGreaterThan(input.points.length)
  const eps = 1e-6
  for (const p of all)
    for (const seg of p.segments) {
      expect(seg.point.x).toBeGreaterThanOrEqual(CANVAS_BOX.x0 - eps)
      expect(seg.point.x).toBeLessThanOrEqual(CANVAS_BOX.x1 + eps)
      expect(seg.point.y).toBeGreaterThanOrEqual(CANVAS_BOX.y0 - eps)
      expect(seg.point.y).toBeLessThanOrEqual(CANVAS_BOX.y1 + eps)
    }
  // the new ray is drawn 3px
  expect(all.filter((p) => !p.closed && p.strokeWidth === 3).length).toBeGreaterThanOrEqual(1)
})

test('done step fills voronoi().cells.length polygons', () => {
  const scene = makeScene()
  for (const p of VORONOI_PRESETS) {
    const input = { points: p.points }
    const steps = voronoiPlayer.computeSteps(input, 'with-delaunay')
    voronoiPlayer.render(scene, steps[steps.length - 1], input)
    expect(filledPolygons(scene)).toHaveLength(voronoi(p.points).cells.length)
  }
})

test('collinear preset renders without throwing', () => {
  const scene = makeScene()
  const input = preset('Collinear')
  const steps = voronoiPlayer.computeSteps(input, 'with-delaunay')
  for (const step of steps) {
    expect(() => voronoiPlayer.render(scene, step, input)).not.toThrow()
    expect(() => voronoiPlayer.panels!(step, input)).not.toThrow()
  }
  // the four bisectors are drawn in the done step
  expect(paths(scene).filter((p) => !p.closed && p.strokeWidth === 1.5)).toHaveLength(4)
  for (const points of [[], [{ x: 100, y: 100 }]]) {
    const tiny = { points }
    for (const step of voronoiPlayer.computeSteps(tiny, 'with-delaunay')) {
      expect(() => voronoiPlayer.render(scene, step, tiny)).not.toThrow()
      expect(() => voronoiPlayer.panels!(step, tiny)).not.toThrow()
    }
  }
})

test('panels by phase', () => {
  const input = textbook()
  const steps = voronoiPlayer.computeSteps(input, 'with-delaunay')
  const titles = ['Vertices', 'Edges', 'Cells']
  const init = voronoiPlayer.panels!(steps[0], input)
  expect(init.map((p) => p.title)).toEqual(titles)
  expect(init.map((p) => p.rows.length)).toEqual([0, 0, 0])
  expect(init.map((p) => p.empty)).toEqual(['No vertices yet', 'No edges yet', 'No cells yet'])

  for (const step of steps.filter((s) => s.state.phase === 'vertices')) {
    const [vertices, edges, cells] = voronoiPlayer.panels!(step, input)
    expect(vertices.rows).toHaveLength(step.state.vertices.length)
    for (const r of vertices.rows) expect(r.text).toMatch(/^u\d+ ← v\d+ v\d+ v\d+(, v\d+ v\d+ v\d+)*$/)
    expect(vertices.rows.filter((r) => r.highlight).length).toBe(1)
    expect(edges.rows).toHaveLength(0)
    expect(edges.empty).toBe('No edges yet')
    expect(cells.rows).toHaveLength(0)
  }

  for (const step of steps.filter((s) => s.state.phase === 'edges')) {
    const edges = voronoiPlayer.panels!(step, input)[1]
    expect(edges.rows).toHaveLength(step.state.edges.length + (step.state.skipped ? 1 : 0))
    for (const r of edges.rows) expect(r.text).toMatch(/^v\d+–v\d+ → (u\d+–u\d+|u\d+ → ∞|\(skipped\))$/)
    if (step.state.newEdge !== undefined) expect(edges.rows[step.state.newEdge].highlight).toBe('new')
  }

  const cellSteps = steps.filter((s) => s.state.phase === 'cells')
  expect(cellSteps.length).toBe(input.points.length)
  for (const step of cellSteps) {
    const cells = voronoiPlayer.panels!(step, input)[2]
    expect(cells.rows).toHaveLength(step.state.cells.length)
    for (const r of cells.rows) expect(r.text).toMatch(/^v\d+: (∞ )?u\d+( u\d+)*( ∞)?$/)
    expect(cells.rows.filter((r) => r.highlight === 'active').map((r) => r.text.split(':')[0])).toEqual([
      `v${step.state.currentSite! + 1}`,
    ])
  }

  const lines = voronoiPlayer.panels!(voronoiPlayer.computeSteps(preset('Collinear'), 'with-delaunay').at(-1)!, preset('Collinear'))
  expect(lines[1].rows.map((r) => r.text)).toEqual(['v1–v2 → bisector', 'v2–v3 → bisector', 'v3–v4 → bisector', 'v4–v5 → bisector'])
})

test('mode changes drawing, not steps', () => {
  expect(voronoiPlayer.modes).toEqual([
    { id: 'with-delaunay', label: 'With Delaunay' },
    { id: 'voronoi-only', label: 'Voronoi only' },
  ])
  const input = textbook()
  const a = voronoiPlayer.computeSteps(input, 'with-delaunay')
  const b = voronoiPlayer.computeSteps(input, 'voronoi-only')
  expect(b).toHaveLength(a.length)
  expect(a.every((s) => s.state.showDelaunay)).toBe(true)
  expect(b.every((s) => !s.state.showDelaunay)).toBe(true)
  const scene = makeScene()
  voronoiPlayer.render(scene, a[a.length - 1], input)
  const withLines = thinLines(scene).length
  voronoiPlayer.render(scene, b[b.length - 1], input)
  const withoutLines = thinLines(scene).length
  expect(withLines).not.toBe(withoutLines)
  expect(withLines - withoutLines).toBe(a[0].state.delaunayEdges.length)
})

test('presets expose six names', () => {
  expect(voronoiPlayer.presets!.map((p) => p.name)).toEqual(VORONOI_PRESETS.map((p) => p.name))
  expect(voronoiPlayer.presets).toHaveLength(6)
  expect(voronoiPlayer.presets![0].input).toEqual({ points: VORONOI_PRESETS[0].points })
  expect(voronoiPlayer.canvas).toEqual({ width: 775, height: 360 })
  expect(voronoiPlayer.hint).toBe('Drag the points to change the input. Keys: ← → to step, Space to play or pause.')
})
