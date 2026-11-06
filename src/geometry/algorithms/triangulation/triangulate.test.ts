import { describe, expect, it } from 'vitest'
import type { Diagonal, Polygon } from '../../types'
import { isSimple, signedArea } from './polygon'
import { runTriangulation, triangulate } from './triangulate'
import type { TriRecorderContext } from './triangulationState'
import { isValidTriangulation, randomStarPolygon } from './verify'

const P = (pts: Array<[number, number]>): Polygon => pts.map(([x, y]) => ({ x, y }))
const textbook = P([
  [120, 310], [80, 180], [150, 60], [260, 150], [360, 40], [470, 160], [580, 50],
  [700, 190], [660, 320], [560, 220], [470, 330], [370, 230], [280, 320], [200, 230],
])
const presets: Record<string, Polygon> = {
  'Textbook polygon': textbook,
  'Already monotone': P([[150, 100], [620, 80], [700, 200], [600, 330], [200, 310], [100, 200]]),
  Comb: P([
    [100, 60], [700, 60], [700, 320], [640, 140], [560, 320], [500, 140], [420, 320],
    [360, 140], [280, 320], [220, 140], [160, 320],
  ]),
  'Same-y vertices': P([[200, 80], [580, 80], [640, 200], [560, 300], [400, 300], [240, 300], [160, 200]]),
  Triangle: P([[200, 80], [580, 80], [390, 320]]),
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const key = (d: Diagonal) => `${Math.min(...d)},${Math.max(...d)}`

function check(poly: Polygon, label: string) {
  const r = triangulate(poly)
  const n = poly.length
  const all = [...r.partitionDiagonals, ...r.triangulationDiagonals]
  expect(isValidTriangulation(poly, all), label).toEqual({ ok: true })
  expect(r.triangles.length, label).toBe(n - 2)
  for (const t of r.triangles) expect(signedArea(t.map((i) => poly[i])), `${label} ${t}`).toBeGreaterThan(0)
  for (const d of all) expect(d[0] < d[1], `${label} ${d}`).toBe(true)
  return r
}

describe('triangulate', () => {
  it('random star polygons: valid triangulations with n − 2 CCW triangles', () => {
    const rng = mulberry32(20261106)
    for (let k = 0; k < 200; k++) {
      const n = 5 + Math.floor(rng() * 16)
      check(randomStarPolygon(rng, n, 400, 300, 60, 260), `random #${k} n=${n}`)
    }
  })

  it('grid-snapped polygons (equal y, horizontal and collinear edges)', () => {
    const rng = mulberry32(7)
    let tested = 0
    for (let k = 0; k < 400; k++) {
      const n = 5 + Math.floor(rng() * 12)
      const poly = randomStarPolygon(rng, n, 400, 300, 60, 260).map((q) => ({
        x: Math.round(q.x / 40) * 40,
        y: Math.round(q.y / 40) * 40,
      }))
      if (!isSimple(poly)) continue
      tested++
      check(poly, `grid #${k} n=${n}`)
    }
    expect(tested).toBeGreaterThan(100)
  })

  it('presets: n − 2 triangles', () => {
    for (const [name, poly] of Object.entries(presets)) {
      const r = check(poly, name)
      expect(r.triangles.length, name).toBe(poly.length - 2)
    }
    expect(triangulate(textbook).partitionDiagonals.length).toBe(5)
  })

  it('clockwise input', () => {
    const n = textbook.length
    const ccw = triangulate(textbook)
    const cwPoly = [...textbook].reverse()
    const cw = check(cwPoly, 'cw')
    const back = (d: Diagonal) => key([n - 1 - d[0], n - 1 - d[1]])
    const ccwKeys = [...ccw.partitionDiagonals, ...ccw.triangulationDiagonals].map(key).sort()
    const cwKeys = [...cw.partitionDiagonals, ...cw.triangulationDiagonals].map(back).sort()
    expect(cwKeys).toEqual(ccwKeys)
    expect(cw.partitionDiagonals.map(back).sort()).toEqual(ccw.partitionDiagonals.map(key).sort())
    expect(cw.types).toEqual(cwPoly.map((_, i) => ccw.types[n - 1 - i]))
    for (const piece of cw.pieces) expect(signedArea(piece.map((i) => cwPoly[i]))).toBeGreaterThan(0)
  })

  it('collinear consecutive vertices', () => {
    const poly = P([[0, 0], [2, 0], [4, 0], [4, 4], [0, 4]])
    // n − 2 = 3 triangles (the brief's "2" contradicts n − 3 = 2 diagonals)
    expect(check(poly, 'collinear').triangles.length).toBe(3)
  })

  it('bowtie throws', () => {
    expect(() => triangulate(P([[0, 0], [4, 4], [4, 0], [0, 4]]))).toThrow('polygon must be simple')
  })

  it('two vertices throw', () => {
    expect(() => triangulate(P([[0, 0], [4, 4]]))).toThrow('polygon needs at least 3 vertices')
  })

  it('triangle: 1 triangle, 0 diagonals', () => {
    const r = triangulate(presets.Triangle)
    expect(r.triangles).toEqual([[0, 1, 2]])
    expect(r.partitionDiagonals).toEqual([])
    expect(r.triangulationDiagonals).toEqual([])
  })

  it('runTriangulation records by mode and exposes the triangulation context', () => {
    const run = (mode: 'full' | 'partition' | 'triangulate') => {
      const steps: { line: number; description: string; ctx: TriRecorderContext }[] = []
      const out = runTriangulation(
        textbook,
        (line, description, _p, ctx) => steps.push({ line, description, ctx: structuredClone(ctx) }),
        mode,
      )
      return { steps, out }
    }
    const full = run('full')
    const part = run('partition')
    const tri = run('triangulate')
    expect(part.steps.every((s) => s.line <= 28)).toBe(true)
    expect(tri.steps.every((s) => s.line >= 30)).toBe(true)
    expect(full.steps.length).toBe(part.steps.length + tri.steps.length)
    const result = triangulate(textbook)
    for (const r of [full, part, tri]) expect(r.out.result).toEqual(result)
    const t = tri.steps
    expect(t[0].ctx.pieces).toEqual(result.pieces)
    expect(t[0].ctx.partitionDiagonals).toEqual(result.partitionDiagonals)
    expect(t[0].ctx.types).toEqual(result.types)
    expect(t[0].ctx.activePiece).toBe(0)
    expect(t[t.length - 1].ctx.activePiece).toBe(result.pieces.length - 1)
    expect(t[t.length - 1].ctx.triangulationDiagonals).toEqual(result.triangulationDiagonals)
    const intros = t.filter((s) => s.description.startsWith('Triangulate piece'))
    expect(intros.length).toBe(result.pieces.length)
    expect(intros[0]).toMatchObject({ line: 30, description: `Triangulate piece 1 of ${result.pieces.length}: ${result.pieces[0].map((i) => `v${i + 1}`).join(' ')}` })
    for (const s of intros) expect(s.ctx.merged).toBeUndefined()
    for (const s of t.filter((s) => !intros.includes(s))) {
      expect(s.ctx.phase).toBe('triangulate')
      expect(s.ctx.merged).toBeDefined()
      expect(s.ctx.chain?.length).toBe(s.ctx.merged?.length)
    }
  })

  it('runTriangulation records in CCW indices for clockwise input', () => {
    const cwPoly = [...textbook].reverse()
    const out = runTriangulation(cwPoly)
    expect(out.reversed).toBe(true)
    expect(out.polygon).toEqual(textbook)
    expect(out.result).toEqual(triangulate(cwPoly))
  })
})
