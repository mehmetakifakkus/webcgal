import { describe, expect, it } from 'vitest'
import { DELAUNAY_PRESETS } from '../delaunay/presets'
import { VORONOI_PRESETS } from './presets'
import { voronoi } from './voronoi'
import { isVoronoi } from './verify'

describe('VORONOI_PRESETS', () => {
  it('has the six presets, the first five sharing the Delaunay points', () => {
    expect(VORONOI_PRESETS.map((p) => p.name)).toEqual([
      'Textbook example',
      'Square grid 4×4',
      'Points on a circle',
      'Two clusters',
      'Collinear plus one',
      'Collinear',
    ])
    VORONOI_PRESETS.slice(0, 5).forEach((p, i) => expect(p.points).toBe(DELAUNAY_PRESETS[i].points))
    expect(VORONOI_PRESETS[5].points).toEqual([
      { x: 150, y: 100 }, { x: 300, y: 100 }, { x: 450, y: 100 }, { x: 600, y: 100 }, { x: 700, y: 100 },
    ])
  })

  for (const p of VORONOI_PRESETS) {
    it(`${p.name}: counts match and isVoronoi holds`, () => {
      const r = voronoi(p.points)
      expect({
        vertices: r.vertices.length,
        edges: r.edges.length,
        cells: r.cells.length,
        unbounded: r.lines.length > 0 ? r.cells.length : r.cells.filter((c) => c.rays).length,
        lines: r.lines.length,
      }).toEqual(p.expected)
      expect(isVoronoi(p.points, r)).toEqual({ ok: true })
    })
  }

  it('brief expectations hold', () => {
    const by = (n: string) => VORONOI_PRESETS.find((p) => p.name === n)!.expected
    expect(by('Square grid 4×4').vertices).toBe(9)
    expect(by('Points on a circle')).toMatchObject({ vertices: 1, edges: 8 })
    expect(by('Collinear')).toMatchObject({ vertices: 0, edges: 0, lines: 4 })
  })
})
