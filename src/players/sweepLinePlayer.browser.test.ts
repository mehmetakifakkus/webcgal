import { afterEach, expect, test } from 'vitest'
import paper from 'paper'
import { createScene, type Scene } from '../engine/scene'
import { SWEEP_PRESETS } from '../geometry/algorithms/sweep/presets'
import { samePt } from '../geometry/primitives'
import sweepLinePlayer from './sweepLinePlayer'

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

test('random input has 7 segments of length ≥ 40 inside the canvas', () => {
  for (let k = 0; k < 20; k++) {
    const segs = sweepLinePlayer.randomInput()
    expect(segs).toHaveLength(7)
    for (const { a, b } of segs) {
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(40)
      for (const p of [a, b]) {
        expect(p.x).toBeGreaterThanOrEqual(77.5)
        expect(p.x).toBeLessThanOrEqual(697.5)
        expect(p.y).toBeGreaterThanOrEqual(36)
        expect(p.y).toBeLessThanOrEqual(324)
      }
    }
  }
})

test('handles and moveHandle', () => {
  const segs = [
    { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } },
    { a: { x: 5, y: 6 }, b: { x: 7, y: 8 } },
  ]
  expect(sweepLinePlayer.handles(segs)).toEqual([segs[0].a, segs[0].b, segs[1].a, segs[1].b])
  const p = { x: 9, y: 9 }
  const moved = sweepLinePlayer.moveHandle(segs, 3, p)
  expect(moved[1].b).toEqual(p)
  expect(moved[1].a).toEqual({ x: 5, y: 6 })
  expect(segs[1].b).toEqual({ x: 7, y: 8 })
})

test('render draws the sweep line at sweepY', () => {
  const scene = makeScene()
  const input = SWEEP_PRESETS[0].segments
  const steps = sweepLinePlayer.computeSteps(input)
  const step = steps.find((s) => s.line === 4)!
  sweepLinePlayer.render(scene, step, input)
  const dashed = scene.paper.project.activeLayer.children.filter(
    (c): c is paper.Path => c instanceof scene.paper.Path && !!c.dashArray && c.dashArray.length > 0,
  )
  expect(dashed).toHaveLength(1)
  expect(dashed[0].segments[0].point.y).toBeCloseTo(step.state.sweepY!)
})

test('render is pure', () => {
  const scene = makeScene()
  const input = SWEEP_PRESETS[0].segments
  const steps = sweepLinePlayer.computeSteps(input)
  const step = steps.find((s) => s.line === 4)!
  sweepLinePlayer.render(scene, step, input)
  const n = scene.paper.project.activeLayer.children.length
  sweepLinePlayer.render(scene, step, input)
  expect(scene.paper.project.activeLayer.children.length).toBe(n)
  expect(n).toBeGreaterThan(0)
})

test('panels reflect queue and status', () => {
  const input = SWEEP_PRESETS[0].segments
  const steps = sweepLinePlayer.computeSteps(input)
  const init = steps[0]
  const initPanels = sweepLinePlayer.panels!(init, input)
  expect(initPanels.map((p) => p.title)).toEqual(['Event queue', 'Status structure'])
  expect(initPanels[1].empty).toBe('Status is empty')
  expect(initPanels[0].empty).toBe('Queue is empty')
  expect(initPanels[1].rows).toHaveLength(0)

  const step = steps.find((s) => s.line === 12)!
  const [queue, status] = sweepLinePlayer.panels!(step, input)
  expect(status.rows).toHaveLength(step.state.status.length)
  expect(status.rows.some((r) => r.highlight === 'new')).toBe(true)
  expect(status.rows.every((r) => /^s\d+$/.test(r.text))).toBe(true)
  expect(queue.rows).toHaveLength(step.state.queue.length)
  for (const r of queue.rows) expect(r.text).toMatch(/^\(-?\d+, -?\d+\) {3}U = \{(s\d+(, s\d+)*)?\}$/)
  // the current event is already deleted from Q at line 12, so check highlighting on a synthetic step
  const p0 = step.state.queue[0].p
  const synthetic = { ...step, state: { ...step.state, current: p0, newEvent: step.state.queue[1].p } }
  const [q] = sweepLinePlayer.panels!(synthetic, input)
  expect(q.rows[0].highlight).toBe('active')
  expect(q.rows[1].highlight).toBe('new')
})

test('presets expose names', () => {
  expect(sweepLinePlayer.presets).toHaveLength(6)
  expect(sweepLinePlayer.presets!.map((p) => p.name)).toEqual(SWEEP_PRESETS.map((p) => p.name))
})
