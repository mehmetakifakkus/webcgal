import { describe, expect, it } from 'vitest'
import { TRIANGULATION_PRESETS } from './presets'
import { isSimple, signedArea, vertexTypes } from './polygon'
import { makeMonotone } from './makeMonotone'
import { triangulate } from './triangulate'
import { isValidTriangulation } from './verify'

describe('triangulation presets', () => {
  it('has five presets', () => {
    expect(TRIANGULATION_PRESETS.map((p) => p.name)).toEqual([
      'Textbook polygon',
      'Already monotone',
      'Comb',
      'Same-y vertices',
      'Triangle',
    ])
  })

  for (const preset of TRIANGULATION_PRESETS) {
    describe(preset.name, () => {
      const { polygon, expected } = preset
      it('is simple and counter-clockwise', () => {
        expect(isSimple(polygon)).toBe(true)
        expect(signedArea(polygon)).toBeGreaterThan(0)
      })
      it('has the expected vertex types', () => {
        const count: Record<string, number> = { start: 0, end: 0, split: 0, merge: 0, regular: 0 }
        for (const t of vertexTypes(polygon)) count[t]++
        expect(count).toEqual(expected.types)
      })
      it('has the expected partition diagonals', () => {
        expect(makeMonotone(polygon).diagonals).toHaveLength(expected.partitionDiagonals)
      })
      it('has the expected triangles and a valid triangulation', () => {
        const r = triangulate(polygon)
        expect(r.triangles).toHaveLength(expected.triangles)
        expect(r.triangles).toHaveLength(polygon.length - 2)
        expect(isValidTriangulation(polygon, [...r.partitionDiagonals, ...r.triangulationDiagonals]).ok).toBe(true)
      })
    })
  }
})
