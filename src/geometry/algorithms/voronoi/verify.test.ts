import { describe, expect, it } from 'vitest'
import type { Pt, VoronoiResult } from '../../types'
import { isVoronoi } from './verify'
import { voronoi } from './voronoi'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))
const square = P([[0, 0], [100, 0], [100, 100], [0, 100]])
const grid = (): Pt[] => {
  const out: Pt[] = []
  for (const y of [60, 140, 220, 300]) for (const x of [160, 320, 480, 640]) out.push({ x, y })
  return out
}
const clone = (r: VoronoiResult): VoronoiResult => structuredClone(r)

describe('isVoronoi', () => {
  it('accepts the square diagram', () => {
    expect(isVoronoi(square, voronoi(square))).toEqual({ ok: true })
  })

  it('rejects a shifted vertex', () => {
    const r = clone(voronoi(square))
    r.vertices[0] = { x: 55, y: 50 }
    const v = isVoronoi(square, r)
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/vertex/)
  })

  it('rejects a missing ray', () => {
    const r = clone(voronoi(square))
    r.edges.splice(r.edges.findIndex((e) => e.b === null), 1)
    const v = isVoronoi(square, r)
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/ray/)
  })

  it('rejects an inward ray', () => {
    const r = clone(voronoi(square))
    const e = r.edges[0]
    e.dir = { x: -e.dir!.x, y: -e.dir!.y }
    const v = isVoronoi(square, r)
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/ray/)
  })

  it('Euler relation: a missing bounded edge or bisector is rejected', () => {
    const pts = grid()
    const r = clone(voronoi(pts))
    expect(isVoronoi(pts, r)).toEqual({ ok: true })
    r.edges.splice(r.edges.findIndex((e) => e.b !== null), 1)
    const v = isVoronoi(pts, r)
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/euler/i)

    const col = P([[0, 0], [10, 0], [20, 0]])
    const rc = clone(voronoi(col))
    rc.lines.pop()
    const vc = isVoronoi(col, rc)
    expect(vc.ok).toBe(false)
    expect(vc.reason).toMatch(/euler/i)
  })

  it('rejects a broken cell', () => {
    const pts = grid()
    const r = clone(voronoi(pts))
    r.cells[5].vertices.reverse()
    const v = isVoronoi(pts, r)
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/cell/)
    const r2 = clone(voronoi(pts))
    r2.cells.pop()
    expect(isVoronoi(pts, r2).reason).toMatch(/cell/)
  })
})
