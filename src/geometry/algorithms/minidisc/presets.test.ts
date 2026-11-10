import { describe, expect, it } from 'vitest'
import { defaultOrder, minidisc } from './minidisc'
import { MINIDISC_PRESETS } from './presets'
import { isMinimalDisk } from './verify'

const byName = (name: string) => MINIDISC_PRESETS.find((p) => p.name === name)!

describe('MINIDISC_PRESETS', () => {
  it('has the six presets', () => {
    expect(MINIDISC_PRESETS.map((p) => p.name)).toEqual([
      'Random example',
      'Two far points',
      'Acute triangle',
      'Points on a circle',
      'Bad order',
      'Collinear',
    ])
  })

  for (const p of MINIDISC_PRESETS) {
    it(`${p.name}: order is a permutation and the pinned counts hold`, () => {
      expect([...p.order].sort((a, b) => a - b)).toEqual(p.points.map((_, i) => i))
      const r = minidisc(p.points, p.order)
      expect(isMinimalDisk(p.points, r.disk)).toEqual({ ok: true })
      expect(r.boundary).toHaveLength(p.expected.boundary)
      expect([...r.boundary].sort((a, b) => a - b)).toEqual(p.expected.boundaryIndices)
      expect(Number(r.disk!.radius.toFixed(1))).toBe(p.expected.radius)
      expect(r.tests).toBe(p.expected.tests)
      expect(r.updates).toBe(p.expected.updates)
    })
  }

  it('every final disc fits the 775×360 canvas with a margin of 10', () => {
    for (const p of MINIDISC_PRESETS) {
      const { center: c, radius: r } = minidisc(p.points, p.order).disk!
      expect(r, p.name).toBeLessThanOrEqual(165)
      expect(c.x - r, p.name).toBeGreaterThanOrEqual(10)
      expect(c.x + r, p.name).toBeLessThanOrEqual(775 - 10)
      expect(c.y - r, p.name).toBeGreaterThanOrEqual(10)
      expect(c.y + r, p.name).toBeLessThanOrEqual(360 - 10)
    }
  })

  it('preset shapes: boundary counts and circle radius', () => {
    expect(byName('Two far points').expected.boundary).toBe(2)
    expect(byName('Acute triangle').expected.boundary).toBe(3)
    expect(byName('Collinear').expected.boundary).toBe(2)
    expect(byName('Points on a circle').expected.radius).toBe(140.0)
  })

  it('bad order has more updates than its shuffled orders on average', () => {
    const bad = byName('Bad order')
    const total = Array.from({ length: 20 }, (_, s) => minidisc(bad.points, defaultOrder(10, 100 + s)).updates).reduce(
      (a, b) => a + b,
      0,
    )
    expect(bad.expected.updates).toBeGreaterThanOrEqual(total / 20 + 1)
  })
})
