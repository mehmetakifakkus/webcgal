import { describe, expect, it } from 'vitest'
import type { Polygon, Segment } from '../../types'
import { compareAt } from '../sweep/status'
import { TRIANGULATION_PRESETS } from './presets'
import { PSEUDOCODE_HEADINGS, PSEUDOCODE_SECTIONS, TRIANGULATION_PSEUDOCODE } from './pseudocode'
import { above } from './polygon'
import { triangulate, runTriangulation } from './triangulate'
import { triangulationSteps } from './triangulationSteps'
import type { TriangulationMode } from './triangulationState'
import { randomStarPolygon } from './verify'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const star = (seed: number, n: number): Polygon => randomStarPolygon(mulberry32(seed), n, 387, 180, 60, 170)
const MODES: TriangulationMode[] = ['full', 'partition', 'triangulate']
const inputs = (): Polygon[] => [
  ...TRIANGULATION_PRESETS.map((p) => p.polygon),
  ...Array.from({ length: 30 }, (_, k) => star(k + 1, 5 + (k % 10))),
]
const key = (d: number[]) => d.join(',')

describe('triangulationSteps', () => {
  it('pseudocode has 41 lines, 7 headings, sections cover all lines', () => {
    expect(TRIANGULATION_PSEUDOCODE).toHaveLength(41)
    expect(PSEUDOCODE_HEADINGS).toEqual([0, 6, 8, 11, 15, 21, 29])
    for (const h of PSEUDOCODE_HEADINGS) expect(TRIANGULATION_PSEUDOCODE[h]).toMatch(/^[A-Z]\w+\(/)
    expect(PSEUDOCODE_SECTIONS.partition[0]).toBe(0)
    expect(PSEUDOCODE_SECTIONS.triangulate[1]).toBe(40)
    expect(PSEUDOCODE_SECTIONS.triangulate[0]).toBe(PSEUDOCODE_SECTIONS.partition[1] + 1)
  })

  it('first and last steps on the textbook polygon', () => {
    const poly = TRIANGULATION_PRESETS[0].polygon
    const full = triangulationSteps(poly)
    expect(full[0].state.phase).toBe('init')
    expect(full[0].line).toBe(1)
    expect(full[0].description).toBe('Classify the vertices: 4 start, 3 end, 2 split, 3 merge, 2 regular')
    expect(full[full.length - 1].line).toBe(40)
    expect(full[full.length - 1].description).toBe('Done: 11 diagonals, 12 triangles')
    const part = triangulationSteps(poly, 'partition')
    expect(part[part.length - 1].line).toBe(3)
    expect(part[part.length - 1].description).toBe('Done: 5 diagonals, 6 monotone pieces')
    const tri = triangulationSteps(poly, 'triangulate')
    expect(tri[0].line).toBe(30)
    expect(tri[0].state.partitionDiagonals).toHaveLength(5)
    expect(tri[0].state.pieces).toHaveLength(6)
    expect(tri[tri.length - 1].description).toBe('Done: 11 diagonals, 12 triangles')
  })

  it('init description for triangulate mode', () => {
    const s = triangulationSteps(TRIANGULATION_PRESETS[0].polygon, 'triangulate')[0]
    expect(s.description).toBe('Partition into monotone pieces (not shown in this mode): 5 diagonals, 6 pieces')
    expect(s.description).toContain('not shown in this mode')
  })

  it('last step matches triangulate', () => {
    for (const poly of inputs()) {
      const r = triangulate(poly)
      for (const mode of MODES) {
        const steps = triangulationSteps(poly, mode)
        const last = steps[steps.length - 1].state
        expect(last.phase).toBe('done')
        expect(last.partitionDiagonals).toEqual(r.partitionDiagonals)
        expect(last.pieces).toEqual(r.pieces)
        expect(last.types).toEqual(r.types)
        expect(last.triangulationDiagonals).toEqual(mode === 'partition' ? [] : r.triangulationDiagonals)
      }
    }
  })

  it('uses CCW indices for clockwise input', () => {
    const poly = TRIANGULATION_PRESETS[0].polygon
    const cw = [...poly].reverse()
    const steps = triangulationSteps(cw)
    const ccw = runTriangulation(cw).polygon
    expect(steps[steps.length - 1].state.partitionDiagonals).toEqual(triangulate(ccw).partitionDiagonals)
  })

  it('lines valid, never heading, never outside the mode section', () => {
    for (const poly of inputs()) {
      for (const mode of MODES) {
        const lines = triangulationSteps(poly, mode).map((s) => s.line)
        for (const l of lines) {
          expect(l).toBeGreaterThanOrEqual(0)
          expect(l).toBeLessThan(41)
          expect(PSEUDOCODE_HEADINGS).not.toContain(l)
          if (mode === 'partition') expect(l).toBeLessThanOrEqual(28)
          if (mode === 'triangulate') expect(l).toBeGreaterThanOrEqual(29)
        }
        if (mode === 'full' && poly.length > 3) {
          expect(lines.some((l) => l <= 28)).toBe(true)
          expect(lines.some((l) => l >= 29)).toBe(true)
        }
      }
    }
  })

  it('reported diagonal is in the lists', () => {
    for (const poly of inputs()) {
      for (const s of triangulationSteps(poly)) {
        const r = s.state.reported
        if (!r) continue
        const keys = [...s.state.partitionDiagonals, ...s.state.triangulationDiagonals].map(key)
        expect(keys).toContain(key(r))
      }
    }
  })

  it('current/cursor persistence and patch isolation', () => {
    for (const poly of inputs()) {
      const steps = triangulationSteps(poly)
      let prev: (typeof steps)[number] | undefined
      for (const s of steps) {
        const st = s.state
        if (s.line === 1 || (st.phase === 'done')) {
          expect(st.current).toBeUndefined()
          expect(st.cursor).toBeUndefined()
        }
        if (st.phase === 'partition' && s.line >= 4) expect(st.current).toBeDefined()
        if (st.phase === 'triangulate') {
          expect(st.current).toBeUndefined()
          expect(st.activePiece).toBeDefined()
          if (s.line >= 33) expect(st.cursor).toBeDefined()
        }
        if (st.phase !== 'triangulate') expect(st.cursor).toBeUndefined()
        // edgeLeft only on search lines (12, 18, 26)
        if (st.edgeLeft !== undefined) expect([12, 18, 26]).toContain(s.line)
        // reported only on diagonal-adding steps, never carried over
        if (st.reported && prev?.state.reported && prev !== steps[0]) {
          expect(s.description).toMatch(/diagonal/i)
        }
        if (/^(Add|Pop v\d+; add) diagonal|^Add diagonal|; add diagonal/.test(s.description)) {
          expect(st.reported).toBeDefined()
        } else if (!/diagonal/.test(s.description)) {
          expect(st.reported).toBeUndefined()
        }
        // current stays within one vertex's records: it changes only at line 4
        if (prev && prev.state.current !== undefined && st.current !== undefined && st.current !== prev.state.current) {
          expect(s.line).toBe(4)
        }
        // cursor changes only when a new u_j is announced
        if (prev && prev.state.cursor !== undefined && st.cursor !== undefined && st.cursor !== prev.state.cursor) {
          expect([33, 40]).toContain(s.line)
        }
        // activePiece changes only at a piece intro (line 30)
        if (prev && st.phase !== 'done' && prev.state.activePiece !== undefined && st.activePiece !== prev.state.activePiece) {
          expect(s.line).toBe(30)
        }
        prev = s
      }
    }
  })

  it('queue is sorted at every step', () => {
    for (const poly of inputs()) {
      const ccw = runTriangulation(poly).polygon
      for (const s of triangulationSteps(poly)) {
        const q = s.state.queue
        for (let i = 1; i < q.length; i++) expect(above(ccw[q[i]], ccw[q[i - 1]])).toBe(false)
        if (s.state.phase === 'partition' && s.state.current !== undefined) {
          expect(q).not.toContain(s.state.current)
        }
      }
    }
  })

  it('status consistent', () => {
    for (const poly of inputs()) {
      const ccw = runTriangulation(poly).polygon
      const n = ccw.length
      const edges: Segment[] = ccw.map((a, i) => ({ a, b: ccw[(i + 1) % n] }))
      let prevCur: number | undefined
      for (const s of triangulationSteps(poly, 'partition')) {
        const cur = s.state.current
        if (s.state.phase === 'partition' && cur !== undefined && s.line !== 4 && s.line !== 5 && cur === prevCur) {
          const cmp = compareAt(edges, ccw[cur])
          const st = s.state.status.map((x) => x.edge)
          for (let i = 1; i < st.length; i++) expect(cmp(st[i - 1], st[i])).toBeLessThanOrEqual(0)
        }
        prevCur = cur
      }
    }
  })

  it('snapshots are independent', () => {
    const steps = triangulationSteps(TRIANGULATION_PRESETS[0].polygon)
    const copy = structuredClone(steps)
    for (const s of steps) {
      s.state.queue.push(999)
      s.state.partitionDiagonals.push([9, 9])
      s.state.stack.push(999)
    }
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].state.queue).not.toBe(steps[i - 1].state.queue)
      expect(steps[i].state.partitionDiagonals).not.toBe(steps[i - 1].state.partitionDiagonals)
    }
    expect(copy[copy.length - 1].state.partitionDiagonals).not.toContainEqual([9, 9])
  })

  it('step count bound', () => {
    const polys = [
      ...TRIANGULATION_PRESETS.map((p) => p.polygon),
      ...Array.from({ length: 20 }, (_, k) => star(100 + k, 12)),
      ...Array.from({ length: 5 }, (_, k) => star(200 + k, 20)),
    ]
    for (const poly of polys) expect(triangulationSteps(poly).length).toBeLessThanOrEqual(600)
  })
})
