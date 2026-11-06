import { describe, expect, it } from 'vitest'
import type { Segment } from '../../types'
import { findIntersections } from './findIntersections'
import { findIntersectionsSteps } from './findIntersectionsSteps'
import { bruteForceIntersections } from './bruteForceIntersections'
import { sameResult } from './sameResult'
import { compareAt } from './status'
import { PSEUDOCODE_HEADINGS, SEGMENT_INTERSECTION_PSEUDOCODE } from './pseudocode'
import { SWEEP_PRESETS } from './presets'

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomSegments(seed: number, n: number): Segment[] {
  const rnd = mulberry32(seed)
  const int = (k: number) => Math.floor(rnd() * k)
  return Array.from({ length: n }, () => seg(int(701), int(701), int(701), int(701)))
}

const sample = randomSegments(7, 6)

describe('findIntersectionsSteps', () => {
  it('pseudocode has 23 lines and three headings', () => {
    expect(SEGMENT_INTERSECTION_PSEUDOCODE).toHaveLength(23)
    expect(PSEUDOCODE_HEADINGS).toEqual([0, 6, 18])
  })

  it('first and last steps', () => {
    const steps = findIntersectionsSteps(sample)
    expect(steps[0].state.phase).toBe('init')
    expect(steps[0].line).toBe(1)
    expect(steps[0].description).toBe('Insert all endpoints into the event queue')
    const last = steps[steps.length - 1]
    expect(last.state.phase).toBe('done')
    expect(last.line).toBe(3)
    expect(last.description).toMatch(
      /^The queue is empty: done\. Found \d+ intersection point\(s\) and \d+ overlap\(s\)$/,
    )
  })

  it('last step equals findIntersections', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const segs = randomSegments(seed, 2 + (seed % 9))
      const steps = findIntersectionsSteps(segs)
      const { points, overlaps } = steps[steps.length - 1].state
      expect(sameResult({ points, overlaps }, findIntersections(segs))).toBe(true)
    }
  })

  it('every line is valid and never a heading', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const s of findIntersectionsSteps(randomSegments(seed, 7))) {
        expect(s.line).toBeGreaterThanOrEqual(0)
        expect(s.line).toBeLessThan(23)
        expect(PSEUDOCODE_HEADINGS).not.toContain(s.line)
      }
    }
  })

  it('queue is sorted and status is consistent in every step', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const segs = randomSegments(seed, 7)
      const steps = findIntersectionsSteps(segs)
      let cur: { x: number; y: number } | undefined
      for (const s of steps) {
        cur = s.state.current ?? cur
        const q = s.state.queue
        for (let i = 1; i < q.length; i++) {
          const a = q[i - 1].p
          const b = q[i].p
          expect(a.y > b.y || (a.y === b.y && a.x <= b.x)).toBe(true)
        }
        // Before line 11 the segments through p are still ordered as just above p.
        const beforeReorder = [4, 7, 8, 10].includes(s.line)
        if (s.state.sweepY !== null && cur && !beforeReorder) {
          const cmp = compareAt(segs, { x: cur.x, y: s.state.sweepY })
          const st = s.state.status
          for (let i = 1; i < st.length; i++) {
            expect(cmp(st[i - 1], st[i])).toBeLessThanOrEqual(0)
          }
        }
      }
    }
  })

  it('test step precedes a new event', () => {
    let seen = 0
    for (let seed = 1; seed <= 20; seed++) {
      const steps = findIntersectionsSteps(randomSegments(seed, 7))
      steps.forEach((s, i) => {
        if (!s.state.newEvent) return
        seen++
        expect(s.line).toBe(20)
        expect(steps[i - 1].line).toBe(19)
        expect(steps[i - 1].state.testing).toBeDefined()
      })
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('reported point is in the found list', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const s of findIntersectionsSteps(randomSegments(seed, 7))) {
        const r = s.state.reported
        if (r && 'p' in r) {
          expect(s.state.points.some((p) => p.p.x === r.p.x && p.p.y === r.p.y)).toBe(true)
        }
      }
    }
  })

  it('patch fields are not carried between steps, current persists within an event', () => {
    const steps = findIntersectionsSteps(sample)
    expect(steps[0].state.current).toBeUndefined()
    steps.forEach((s, i) => {
      if (s.line === 4) expect(s.state.testing).toBeUndefined()
      if (s.line >= 7 && s.line <= 22) expect(s.state.current).toBeDefined()
      if (i > 0 && s.line !== 19 && s.line !== 20 && s.line !== 21 && s.line !== 22) {
        expect(s.state.testing).toBeUndefined()
      }
    })
    expect(steps[steps.length - 1].state.current).toBeUndefined()
  })

  it('snapshots are independent', () => {
    const steps = findIntersectionsSteps(sample)
    const before = steps.map((s) => [...s.state.status])
    steps[3].state.status.push(99)
    steps.forEach((s, i) => {
      if (i !== 3) expect(s.state.status).toEqual(before[i])
    })
  })

  it('steps for zero-length segment', () => {
    const steps = findIntersectionsSteps([seg(1, 1, 1, 1)])
    expect(steps.length).toBeGreaterThanOrEqual(2)
    expect(steps[0].state.phase).toBe('init')
    expect(steps[steps.length - 1].state.phase).toBe('done')
  })

  it('presets have expected counts', () => {
    expect(SWEEP_PRESETS).toHaveLength(6)
    for (const p of SWEEP_PRESETS) {
      const r = findIntersections(p.segments)
      expect({ points: r.points.length, overlaps: r.overlaps.length }, p.name).toEqual(p.expected)
      expect(sameResult(r, bruteForceIntersections(p.segments)), p.name).toBe(true)
    }
  })

  it('step count bound', () => {
    for (const p of SWEEP_PRESETS) {
      expect(findIntersectionsSteps(p.segments).length, p.name).toBeLessThanOrEqual(500)
    }
    for (let seed = 1; seed <= 20; seed++) {
      expect(findIntersectionsSteps(randomSegments(seed, 7)).length).toBeLessThanOrEqual(500)
    }
  })
})
