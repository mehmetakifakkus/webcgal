import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../delaunay/delaunay'
import { randomPointSet } from '../delaunay/verify'
import { defaultOrder, minidisc } from './minidisc'
import { miniDiscSteps } from './miniDiscSteps'
import { MINIDISC_PRESETS } from './presets'
import { MINIDISC_PSEUDOCODE, PSEUDOCODE_HEADINGS } from './pseudocode'

const box = { x0: 93, y0: 43, x1: 682, y1: 317 }
const randomCases = Array.from({ length: 30 }, (_, s) => {
  const rng = mulberry32(1000 + s)
  const n = 2 + Math.floor(rng() * 14)
  return { points: randomPointSet(rng, n, box, 20), order: defaultOrder(n, 77 + s) }
})
const allCases = [...MINIDISC_PRESETS.map((p) => ({ points: p.points, order: p.order })), ...randomCases]

describe('MINIDISC_PSEUDOCODE', () => {
  it('has the 22 lines of spec 3.1 and headings [0, 8, 15]', () => {
    expect(MINIDISC_PSEUDOCODE).toEqual([
      'MiniDisc(P)',
      '    Compute a random permutation p_1, …, p_n of P',
      '    Let D_2 be the smallest enclosing disc for {p_1, p_2}',
      '    for i ← 3 to n',
      '        if p_i ∈ D_{i−1}',
      '            then D_i ← D_{i−1}',
      '            else D_i ← MiniDiscWithPoint({p_1, …, p_{i−1}}, p_i)',
      '    return D_n',
      'MiniDiscWithPoint(P, q)',
      '    Let D_1 be the smallest disc with q and p_1 on its boundary',
      '    for j ← 2 to n',
      '        if p_j ∈ D_{j−1}',
      '            then D_j ← D_{j−1}',
      '            else D_j ← MiniDiscWith2Points({p_1, …, p_{j−1}}, p_j, q)',
      '    return D_n',
      'MiniDiscWith2Points(P, q_1, q_2)',
      '    Let D_0 be the smallest disc with q_1 and q_2 on its boundary',
      '    for k ← 1 to n',
      '        if p_k ∈ D_{k−1}',
      '            then D_k ← D_{k−1}',
      '            else D_k ← the disc with q_1, q_2 and p_k on its boundary',
      '    return D_n',
    ])
    expect(PSEUDOCODE_HEADINGS).toEqual([0, 8, 15])
  })
})

describe('miniDiscSteps', () => {
  it('last step matches minidisc', () => {
    for (const c of allCases) {
      const r = minidisc(c.points, c.order)
      const last = miniDiscSteps(c.points, c.order).at(-1)!
      expect(last.line).toBe(7)
      expect(last.state.phase).toBe('done')
      expect(last.state.disk).toEqual(r.disk)
      expect(last.state.tests).toBe(r.tests)
      expect(last.state.updates).toBe(r.updates)
      const b = r.boundary.map((i) => `v${i + 1}`)
      const through = b.length <= 1 ? b.join('') : `${b.slice(0, -1).join(', ')} and ${b[b.length - 1]}`
      expect(last.description).toBe(
        `Done: smallest disc through ${through} (r = ${r.disk!.radius.toFixed(1)}), ${r.tests} tests, ${r.updates} updates`,
      )
    }
  })

  it('n <= 1 gives two steps (lines 1 and 7)', () => {
    expect(miniDiscSteps([], []).map((s) => s.line)).toEqual([1, 7])
    const one = miniDiscSteps([{ x: 3, y: 4 }], [0])
    expect(one.map((s) => s.line)).toEqual([1, 7])
    expect(one[1].description).toBe('Done: smallest disc through v1 (r = 0.0), 0 tests, 0 updates')
  })

  it('lines are valid and never a heading', () => {
    for (const c of allCases)
      for (const s of miniDiscSteps(c.points, c.order)) {
        expect(Number.isInteger(s.line)).toBe(true)
        expect(s.line).toBeGreaterThanOrEqual(0)
        expect(s.line).toBeLessThan(MINIDISC_PSEUDOCODE.length)
        expect(PSEUDOCODE_HEADINGS).not.toContain(s.line)
      }
  })

  it('testing only on 4/11/18, newDisk only on 20, returned only on 14/21', () => {
    for (const c of allCases)
      for (const s of miniDiscSteps(c.points, c.order)) {
        expect(s.state.testing !== undefined).toBe([4, 11, 18].includes(s.line))
        expect(s.state.newDisk !== undefined).toBe(s.line === 20)
        expect(s.state.returned !== undefined).toBe([14, 21].includes(s.line))
      }
  })

  it('stack depth rises after a call step, drops after a return step, stays within 1..3', () => {
    for (const c of allCases) {
      const steps = miniDiscSteps(c.points, c.order)
      expect(steps[0].state.stack).toHaveLength(0)
      for (let i = 1; i < steps.length; i++) {
        const depth = steps[i].state.stack.length
        expect(depth).toBeGreaterThanOrEqual(1)
        expect(depth).toBeLessThanOrEqual(3)
        const prev = steps[i - 1]
        const before = prev.state.stack.length
        if (i === 1) continue
        if (prev.line === 6 || prev.line === 13) expect(depth).toBe(before + 1)
        else if (prev.line === 14 || prev.line === 21) expect(depth).toBe(before - 1)
        else expect(depth).toBe(before)
      }
    }
  })

  it('snapshots are independent', () => {
    const c = MINIDISC_PRESETS[0]
    const steps = miniDiscSteps(c.points, c.order)
    const i = steps.findIndex((s) => s.state.stack.length >= 2)
    const copy = structuredClone(steps)
    steps[i].state.stack[0].disk.radius = -1
    steps[i].state.stack[0].fixed.push(99)
    steps[i].state.order.reverse()
    steps[i].state.disk!.center.x = -5
    expect(steps[i + 1].state).toEqual(copy[i + 1].state)
    expect(steps[i - 1].state).toEqual(copy[i - 1].state)
  })

  it('25 random points take at most 400 steps', () => {
    const pts = randomPointSet(mulberry32(5), 25, box, 20)
    const len = miniDiscSteps(pts, defaultOrder(25, 5)).length
    expect(len).toBeLessThanOrEqual(400)
  })
})
