import { describe, expect, it } from 'vitest'
import type { Pt } from '../../types'
import { delaunay, mulberry32 } from '../delaunay/delaunay'
import { randomPointSet } from '../delaunay/verify'
import { VORONOI_PRESETS } from './presets'
import { PSEUDOCODE_HEADINGS, VORONOI_PSEUDOCODE } from './pseudocode'
import { voronoi } from './voronoi'
import { voronoiSteps } from './voronoiSteps'

const BOX = { x0: 60, y0: 40, x1: 700, y1: 320 }
const random = (seed: number, n: number): Pt[] => randomPointSet(mulberry32(seed), n, BOX, 20)
const inputs = (): Pt[][] => [
  ...VORONOI_PRESETS.map((p) => p.points),
  ...Array.from({ length: 30 }, (_, k) => random(k + 1, 5 + (k % 10))),
]

describe('voronoiSteps', () => {
  it('pseudocode has 13 lines, heading [0]', () => {
    expect(VORONOI_PSEUDOCODE).toHaveLength(13)
    expect(PSEUDOCODE_HEADINGS).toEqual([0])
    expect(VORONOI_PSEUDOCODE[0]).toBe('VoronoiFromDelaunay(P)')
    expect(VORONOI_PSEUDOCODE[1]).toBe('    Compute the Delaunay triangulation DT(P)')
    expect(VORONOI_PSEUDOCODE[12]).toBe('    return the Voronoi diagram')
  })

  it('last step matches voronoi', () => {
    for (const pts of inputs()) {
      const r = voronoi(pts)
      const last = voronoiSteps(pts).at(-1)!
      expect(last.line).toBe(12)
      expect(last.state.phase).toBe('done')
      expect(last.state.vertices).toHaveLength(r.vertices.length)
      expect(last.state.edges).toHaveLength(r.edges.length)
      expect(last.state.cells).toHaveLength(r.cells.length)
      expect(last.state.lines).toHaveLength(r.lines.length)
      const unb = r.cells.filter((c) => c.rays).length
      expect(last.description).toBe(
        r.lines.length > 0
          ? `Done: ${r.lines.length} bisectors, ${pts.length} unbounded cells`
          : `Done: ${r.vertices.length} vertices, ${r.edges.length} edges, ${pts.length} cells (${unb} unbounded)`,
      )
    }
  })

  it('lines valid, never heading', () => {
    for (const pts of inputs())
      for (const s of voronoiSteps(pts)) {
        expect(Number.isInteger(s.line)).toBe(true)
        expect(s.line).toBeGreaterThanOrEqual(0)
        expect(s.line).toBeLessThan(VORONOI_PSEUDOCODE.length)
        expect(PSEUDOCODE_HEADINGS).not.toContain(s.line)
      }
  })

  it('newEdge only on lines 7 and 9, merged only on line 4, circle only on line 3', () => {
    for (const pts of inputs())
      for (const s of voronoiSteps(pts)) {
        if (s.state.newEdge !== undefined) expect([7, 9]).toContain(s.line)
        if (s.state.merged !== undefined) expect(s.line).toBe(4)
        if (s.state.circle !== undefined) expect([3, 4]).toContain(s.line)
        if (s.line === 4) expect(s.state.merged!.length).toBeGreaterThanOrEqual(2)
      }
  })

  it('circle only on lines 3 and 4 (vertex steps)', () => {
    const steps = voronoiSteps(VORONOI_PRESETS[0].points)
    expect(steps.filter((s) => s.state.circle).every((s) => s.state.phase === 'vertices')).toBe(true)
  })

  it('step count formula', () => {
    for (const pts of inputs()) {
      const r = voronoi(pts)
      const n = pts.length
      const steps = voronoiSteps(pts)
      if (r.lines.length > 0) expect(steps).toHaveLength(1 + (n - 1) + n + 1)
      else {
        const edgeCount = delaunay(pts).edges.length
        expect(steps).toHaveLength(1 + r.triangles.length + edgeCount + n + 1)
      }
    }
    expect(voronoiSteps([])).toHaveLength(2)
    // voronoi.ts also records the single (unbounded) cell of one site: lines 1, 11, 12
    expect(voronoiSteps([{ x: 5, y: 5 }])).toHaveLength(3)
  })

  it('showDelaunay propagates to every step', () => {
    for (const flag of [true, false])
      for (const s of voronoiSteps(VORONOI_PRESETS[0].points, flag)) expect(s.state.showDelaunay).toBe(flag)
    expect(voronoiSteps(VORONOI_PRESETS[0].points)[0].state.showDelaunay).toBe(true)
  })

  it('snapshots independent', () => {
    const steps = voronoiSteps(VORONOI_PRESETS[0].points)
    const before = JSON.stringify(steps.map((s) => s.state))
    const last = steps.at(-1)!.state
    last.vertices.push({ x: 0, y: 0 })
    last.edges.length = 0
    last.triangles[0][0] = 99
    const mid = steps[Math.floor(steps.length / 2)].state
    mid.vertices.length = 0
    const after = JSON.stringify(steps.map((s) => s.state))
    expect(after).not.toBe(before)
    // other steps unaffected: first step holds no vertices, a middle-late step keeps its own copies
    expect(steps[0].state.vertices).toHaveLength(0)
    expect(steps.at(-2)!.state.triangles[0][0]).not.toBe(99)
    expect(steps.at(-2)!.state.edges.length).toBeGreaterThan(0)
  })

  // = 147 − 2h for n = 25; h ≥ 3
  it('25 random points take at most 141 steps', () => {
    for (let seed = 1; seed <= 10; seed++) expect(voronoiSteps(random(seed, 25)).length).toBeLessThanOrEqual(141)
  })

  it('collinear steps: phases delaunay, collinear, cells, done; four line-10 steps', () => {
    const steps = voronoiSteps(VORONOI_PRESETS[5].points)
    expect(steps).toHaveLength(1 + 4 + 5 + 1)
    expect(steps.filter((s) => s.line === 10)).toHaveLength(4)
    const phases = steps.map((s) => s.state.phase).filter((p, i, a) => i === 0 || a[i - 1] !== p)
    expect(phases).toEqual(['delaunay', 'collinear', 'cells', 'done'])
    expect(steps.filter((s) => s.line === 10).map((s) => s.state.currentLine)).toEqual([0, 1, 2, 3])
  })
})
