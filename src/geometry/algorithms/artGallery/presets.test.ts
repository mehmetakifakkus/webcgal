import { describe, expect, it } from 'vitest'
import { isSimple } from '../triangulation/polygon'
import { TRIANGULATION_PRESETS } from '../triangulation/presets'
import { fisk } from './fisk'
import { GALLERY_PRESETS } from './presets'
import { coverage } from './visibility'

const byName = (name: string) => GALLERY_PRESETS.find((p) => p.name === name)!

describe('GALLERY_PRESETS', () => {
  it('has the six presets', () => {
    expect(GALLERY_PRESETS.map((p) => p.name)).toEqual([
      'Comb', 'Textbook polygon', 'Convex room', 'L-shaped gallery', 'Star', 'Spiral corridor',
    ])
  })

  for (const p of GALLERY_PRESETS) {
    it(`${p.name}: simple, inside the canvas, pinned counts`, () => {
      expect(p.polygon).toHaveLength(p.expected.n)
      expect(isSimple(p.polygon)).toBe(true)
      for (const [i, a] of p.polygon.entries()) {
        const b = p.polygon[(i + 1) % p.polygon.length]
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${p.name} edge ${i}`).toBeGreaterThanOrEqual(1e-3)
        expect(a.x).toBeGreaterThanOrEqual(15)
        expect(a.x).toBeLessThanOrEqual(775 - 15)
        expect(a.y).toBeGreaterThanOrEqual(15)
        expect(a.y).toBeLessThanOrEqual(360 - 15)
      }
      const r = fisk(p.polygon)
      expect(r.cameras).toHaveLength(p.expected.cameras)
      expect(r.cameras.length).toBeLessThanOrEqual(Math.floor(p.expected.n / 3))
      expect(coverage(p.polygon, r.cameras).covered).toBe(true)
      // a real sample grid, not the "no samples" fallback
      expect(coverage(p.polygon, []).percent).toBe(0)
    })
  }

  it('Textbook polygon is the triangulation preset', () => {
    expect(byName('Textbook polygon').polygon).toEqual(
      TRIANGULATION_PRESETS.find((p) => p.name === 'Textbook polygon')!.polygon,
    )
  })

  it('comb needs four: no three vertex cameras cover it', () => {
    const { polygon } = byName('Comb')
    expect(fisk(polygon).cameras).toHaveLength(4)
    let triples = 0
    for (let a = 0; a < 12; a++)
      for (let b = a + 1; b < 12; b++)
        for (let c = b + 1; c < 12; c++) {
          triples++
          expect(coverage(polygon, [a, b, c]).covered, `${a},${b},${c}`).toBe(false)
        }
    expect(triples).toBe(220)
  }, 120_000)

  it('convex room is covered by one camera', () => {
    const { polygon } = byName('Convex room')
    for (let v = 0; v < polygon.length; v++) expect(coverage(polygon, [v]).covered).toBe(true)
  })

  it('Spiral corridor pins', () => {
    expect(fisk(byName('Spiral corridor').polygon).cameras).toEqual([4, 6, 12, 14])
  })

  it('Textbook polygon pins', () => {
    const r = fisk(byName('Textbook polygon').polygon)
    expect(r.triangles[0]).toEqual([0, 1, 13])
    expect(r.counts).toEqual([4, 5, 5])
    expect(r.chosen).toBe(0)
    expect(r.cameras).toEqual([0, 3, 7, 11])
  })
})
