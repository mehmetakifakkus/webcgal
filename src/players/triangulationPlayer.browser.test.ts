import { afterEach, expect, test } from 'vitest'
import paper from 'paper'
import { createScene, type Scene } from '../engine/scene'
import { TRIANGULATION_PRESETS } from '../geometry/algorithms/triangulation/presets'
import { isSimple, signedArea } from '../geometry/algorithms/triangulation/polygon'
import triangulationPlayer from './triangulationPlayer'

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
const dashedPaths = (scene: Scene) =>
  scene.paper.project.activeLayer.children.filter(
    (c): c is paper.Path => c instanceof scene.paper.Path && !!c.dashArray && c.dashArray.length > 0,
  )

test('random input is simple, CCW, 8–12 vertices', () => {
  for (let k = 0; k < 20; k++) {
    const poly = triangulationPlayer.randomInput()
    expect(poly.length).toBeGreaterThanOrEqual(8)
    expect(poly.length).toBeLessThanOrEqual(12)
    expect(isSimple(poly)).toBe(true)
    expect(signedArea(poly)).toBeGreaterThan(0)
  }
})

test('validate rejects a bowtie, accepts a square', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
  const bowtie = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }]
  expect(triangulationPlayer.validate!(square)).toBeNull()
  expect(triangulationPlayer.validate!(bowtie)).toBe('The polygon must be simple (no crossing edges)')
  // a fully reversed (clockwise) polygon is rejected too, so that steps always see a CCW polygon
  expect(triangulationPlayer.validate!([...square].reverse())).toBe('The polygon must be simple (no crossing edges)')
})

test('modes and dimmedLines', () => {
  const m = triangulationPlayer.modes!
  expect(m.map((x) => x.id)).toEqual(['full', 'partition', 'triangulate'])
  expect(m.map((x) => x.label)).toEqual(['Full', 'Partition only', 'Triangulation only'])
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  expect(triangulationPlayer.dimmedLines!('partition')).toEqual(range(29, 40))
  expect(triangulationPlayer.dimmedLines!('triangulate')).toEqual(range(0, 28))
  expect(triangulationPlayer.dimmedLines!('full')).toEqual([])
})

test('handles and moveHandle are pure', () => {
  const poly = TRIANGULATION_PRESETS[4].polygon
  expect(triangulationPlayer.handles(poly)).toEqual(poly)
  const moved = triangulationPlayer.moveHandle(poly, 1, { x: 5, y: 6 })
  expect(moved[1]).toEqual({ x: 5, y: 6 })
  expect(poly[1]).not.toEqual({ x: 5, y: 6 })
  expect(moved).toHaveLength(poly.length)
})

test('render is pure', () => {
  const scene = makeScene()
  const input = TRIANGULATION_PRESETS[0].polygon
  const steps = triangulationPlayer.computeSteps(input, 'full')
  for (const step of [steps[0], steps.find((s) => s.line === 4)!, steps.find((s) => s.line >= 31)!, steps[steps.length - 1]]) {
    triangulationPlayer.render(scene, step, input)
    const n = scene.paper.project.activeLayer.children.length
    triangulationPlayer.render(scene, step, input)
    expect(scene.paper.project.activeLayer.children.length).toBe(n)
    expect(n).toBeGreaterThan(0)
  }
})

test('render draws sweep line in partition phase and stack rings in triangulate phase', () => {
  const scene = makeScene()
  const input = TRIANGULATION_PRESETS[0].polygon
  const steps = triangulationPlayer.computeSteps(input, 'full')
  const part = steps.find((s) => s.line === 4)!
  triangulationPlayer.render(scene, part, input)
  expect(dashedPaths(scene).length).toBeGreaterThanOrEqual(1)
  expect(dashedPaths(scene).some((p) => Math.abs(p.segments[0].point.y - part.state.sweepY!) < 1e-6)).toBe(true)
  const tri = steps.find((s) => s.line >= 31)!
  triangulationPlayer.render(scene, tri, input)
  expect(dashedPaths(scene)).toHaveLength(0)
})

test('invalid input is drawn with edges and handles', () => {
  const scene = makeScene()
  const bowtie = [{ x: 100, y: 100 }, { x: 200, y: 200 }, { x: 200, y: 100 }, { x: 100, y: 200 }]
  triangulationPlayer.renderInvalid!(scene, bowtie)
  expect(scene.paper.project.activeLayer.children.length).toBeGreaterThanOrEqual(5)
})

test('panels by phase', () => {
  const input = TRIANGULATION_PRESETS[0].polygon
  const steps = triangulationPlayer.computeSteps(input, 'full')
  const titles = (i: number) => triangulationPlayer.panels!(steps[i], input).map((p) => p.title)
  expect(titles(0)).toEqual(['Vertex types'])
  const part = steps.findIndex((s) => s.state.phase === 'partition')
  expect(titles(part)).toEqual(['Event queue', 'Status structure'])
  const tri = steps.findIndex((s) => s.state.phase === 'triangulate')
  expect(titles(tri)).toEqual(['Pieces', 'Stack'])
  expect(titles(steps.length - 1)).toEqual(['Vertex types'])
  const types = triangulationPlayer.panels!(steps[0], input)[0]
  expect(types.rows[0].text).toBe('v1   ' + steps[0].state.types[0])
  const q = triangulationPlayer.panels!(steps[part], input)
  expect(q[0].empty).toBe('Queue is empty')
  expect(q[1].empty).toBe('Status is empty')
  expect(triangulationPlayer.panels!(steps[tri], input)[1].empty).toBe('Stack is empty')
})

test('presets expose five names', () => {
  expect(triangulationPlayer.presets!.map((p) => p.name)).toEqual(TRIANGULATION_PRESETS.map((p) => p.name))
  expect(triangulationPlayer.presets).toHaveLength(5)
})
