import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { inCircle } from '../../primitives'
import { delaunay, mulberry32 } from './delaunay'
import { delaunaySteps } from './delaunaySteps'
import { DELAUNAY_PRESETS } from './presets'
import { DELAUNAY_PSEUDOCODE, PSEUDOCODE_HEADINGS } from './pseudocode'
import { highestIndex } from './symbolic'
import { randomPointSet } from './verify'

const BOX = { x0: 60, y0: 40, x1: 700, y1: 320 }
const random = (seed: number, n: number): Pt[] => randomPointSet(mulberry32(seed), n, BOX, 20)
const inputs = (): { points: Pt[]; order?: number[] }[] => [
  ...DELAUNAY_PRESETS.map((p) => ({ points: p.points, order: p.order })),
  ...Array.from({ length: 30 }, (_, k) => ({ points: random(k + 1, 5 + (k % 10)) })),
]
const run = (inp: { points: Pt[]; order?: number[] }) => {
  const order = inp.order ?? orderOf(inp.points)
  return { order, steps: delaunaySteps(inp.points, order) }
}
// the default order delaunay() would pick, via the recorder context
function orderOf(points: Pt[]): number[] {
  let o: number[] = []
  delaunay(points, undefined, (_l, _d, _p, ctx) => {
    o = [...ctx.order]
  })
  return o
}
const tkey = (t: number[]) => {
  const m = t.indexOf(Math.min(...t))
  return [t[m], t[(m + 1) % 3], t[(m + 2) % 3]].join(',')
}
const tset = (ts: { v: number[] }[] | number[][]) =>
  ts.map((t) => tkey('v' in t ? t.v : t)).sort()

describe('delaunaySteps', () => {
  it('pseudocode has 21 lines, headings [0, 15]', () => {
    expect(DELAUNAY_PSEUDOCODE).toHaveLength(21)
    expect(PSEUDOCODE_HEADINGS).toEqual([0, 15])
    expect(DELAUNAY_PSEUDOCODE[0]).toBe('DelaunayTriangulation(P)')
    expect(DELAUNAY_PSEUDOCODE[15]).toBe('LegalizeEdge(p_r, p_i p_j, T)')
    expect(DELAUNAY_PSEUDOCODE[1]).toMatch(/^ {4}Let p_0/)
    expect(DELAUNAY_PSEUDOCODE[6]).toMatch(/^ {8}Find the triangle/)
    expect(DELAUNAY_PSEUDOCODE[8]).toMatch(/^ {12}Add edges/)
  })

  it('last step matches delaunay', () => {
    for (const inp of inputs()) {
      const { order, steps } = run(inp)
      const ref = delaunay(inp.points, order)
      const last = steps[steps.length - 1].state
      expect(last.phase).toBe('done')
      expect(tset(last.triangles)).toEqual(tset(ref.triangles))
      expect(last.flips).toBe(ref.flips)
      expect(steps[steps.length - 1].description).toBe(`Done: ${ref.triangles.length} triangles, ${ref.flips} flips`)
    }
  })

  it('lines valid, never heading', () => {
    for (const inp of inputs())
      for (const s of run(inp).steps) {
        expect(Number.isInteger(s.line)).toBe(true)
        expect(s.line).toBeGreaterThanOrEqual(0)
        expect(s.line).toBeLessThan(DELAUNAY_PSEUDOCODE.length)
        expect(PSEUDOCODE_HEADINGS).not.toContain(s.line)
      }
  })

  it('flipped only on line 18 and flips increments by 1', () => {
    for (const inp of inputs()) {
      const { steps } = run(inp)
      steps.forEach((s, i) => {
        const prev = i > 0 ? steps[i - 1].state.flips : 0
        if (s.line === 18) {
          expect(s.state.flipped).toBeDefined()
          expect(s.state.flips).toBe(prev + 1)
        } else {
          expect(s.state.flipped).toBeUndefined()
          expect(s.state.flips).toBe(prev)
        }
      })
    }
  })

  it('testing.legal matches inCircle for real quadruples', () => {
    let checked = 0
    for (const inp of inputs())
      for (const s of run(inp).steps) {
        const t = s.state.testing
        if (!t || s.state.current === undefined) continue
        const [i, j] = t.edge
        const k = t.opposite
        if (i < 0 || j < 0 || k < 0) continue
        const inside = inCircle(inp.points[i], inp.points[j], inp.points[k], inp.points[s.state.current]) > 0
        expect(t.legal).toBe(!inside)
        expect(s.state.circle).toBeDefined()
        checked++
      }
    expect(checked).toBeGreaterThan(20)
  })

  it('stack is LIFO: the tested edge is the end of the previous step stack', () => {
    for (const inp of inputs()) {
      const { steps } = run(inp)
      steps.forEach((s, i) => {
        if (s.line !== 16 || i === 0) return
        const prevStack = steps[i - 1].state.stack
        expect(prevStack.length).toBeGreaterThan(0)
        const top = prevStack[prevStack.length - 1]
        expect(s.state.stack).toEqual(prevStack.slice(0, -1))
        if (s.state.testing) expect(s.state.testing.edge).toEqual(top)
      })
    }
  })

  it('current persists until next insert', () => {
    for (const inp of inputs()) {
      const { order, steps } = run(inp)
      const inserts = steps.filter((s) => s.line === 5)
      expect(inserts.map((s) => s.state.current)).toEqual(order)
      let cur: number | undefined
      for (const s of steps) {
        if (s.line === 5) cur = s.state.current
        if (s.state.phase === 'insert' || s.state.phase === 'legalize') expect(s.state.current).toBe(cur)
        if (s.state.phase === 'cleanup' || s.state.phase === 'done' || s.state.phase === 'init')
          expect(s.state.current).toBeUndefined()
      }
    }
  })

  it('snapshots independent', () => {
    const p = DELAUNAY_PRESETS[0]
    const steps = delaunaySteps(p.points, p.order)
    const before = JSON.stringify(steps[5].state)
    const a = steps[4].state
    a.triangles.push({ v: [0, 1, 2], alive: true })
    a.inserted.push(99)
    a.order.length = 0
    a.stack.push([0, 0])
    expect(JSON.stringify(steps[5].state)).toBe(before)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].state.triangles).not.toBe(steps[i - 1].state.triangles)
      expect(steps[i].state.inserted).not.toBe(steps[i - 1].state.inserted)
    }
  })

  it('patch fields apply to a single step only', () => {
    const p = DELAUNAY_PRESETS[0]
    const steps = delaunaySteps(p.points, p.order)
    steps.forEach((s, i) => {
      if (s.line === 6) expect(s.state.located).toBeDefined()
      else expect(s.state.located).toBeUndefined()
      if (s.line !== 16) expect(s.state.testing).toBeUndefined()
      if (i > 0 && s.state.circle) expect(s.line).toBe(16)
    })
  })

  it('preset counts', () => {
    for (const p of DELAUNAY_PRESETS) {
      const steps = delaunaySteps(p.points, p.order)
      const last = steps[steps.length - 1].state
      expect(last.triangles).toHaveLength(p.expected.triangles)
      expect(last.flips).toBe(p.expected.flips)
      expect(last.p0).toBe(highestIndex(p.points))
      expect(steps[0].state.phase).toBe('init')
      expect(steps[0].state.triangles.filter((t) => t.alive)).toHaveLength(1)
    }
  })

  it('step count bound ≤ 600', () => {
    const sets: { points: Pt[]; order?: number[] }[] = [
      ...DELAUNAY_PRESETS.map((p) => ({ points: p.points, order: p.order })),
      ...Array.from({ length: 20 }, (_, k) => ({ points: random(100 + k, 12) })),
      ...Array.from({ length: 5 }, (_, k) => ({ points: random(200 + k, 25) })),
    ]
    let max = 0
    for (const inp of sets) {
      const len = run(inp).steps.length
      max = Math.max(max, len)
      expect(len).toBeLessThanOrEqual(600)
    }
    expect(max).toBeGreaterThan(0)
  })

  it('flip count bounded', () => {
    for (const name of ['Points on a circle', 'Square grid 4×4']) {
      const p = DELAUNAY_PRESETS.find((q) => q.name === name)!
      const last = delaunaySteps(p.points, p.order).at(-1)!.state
      expect(last.flips).toBeLessThanOrEqual(3 * p.points.length)
    }
  })
})
