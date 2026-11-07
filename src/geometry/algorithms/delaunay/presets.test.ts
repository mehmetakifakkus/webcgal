import { describe, expect, it } from 'vitest'
import { delaunay } from './delaunay'
import { DELAUNAY_PRESETS } from './presets'
import { highestIndex } from './symbolic'
import { hullBoundaryCount, isDelaunay } from './verify'

describe('DELAUNAY_PRESETS', () => {
  it('has the five presets', () => {
    expect(DELAUNAY_PRESETS.map((p) => p.name)).toEqual([
      'Textbook example',
      'Square grid 4×4',
      'Points on a circle',
      'Two clusters',
      'Collinear plus one',
    ])
  })

  for (const p of DELAUNAY_PRESETS) {
    it(`${p.name}: order is a permutation of P \\ {p0}, counts and Delaunay property hold`, () => {
      const n = p.points.length
      const p0 = highestIndex(p.points)
      expect([...p.order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: n }, (_, i) => i).filter((i) => i !== p0),
      )
      const r = delaunay(p.points, p.order)
      expect(r.triangles).toHaveLength(p.expected.triangles)
      expect(r.flips).toBe(p.expected.flips)
      expect(isDelaunay(p.points, r.triangles)).toEqual({ ok: true })
    })
  }

  it('triangle counts follow 2n − 2 − h', () => {
    for (const p of DELAUNAY_PRESETS)
      expect(p.expected.triangles).toBe(2 * p.points.length - 2 - hullBoundaryCount(p.points))
  })

  it('p0 values from the brief', () => {
    expect(DELAUNAY_PRESETS.map((p) => highestIndex(p.points))).toEqual([1, 15, 2, 10, 4])
  })
})
