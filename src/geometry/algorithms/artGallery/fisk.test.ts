import { describe, expect, it } from 'vitest'
import type { Pt, Triangle } from '../../types'
import { mulberry32 } from '../delaunay/delaunay'
import { isSimple } from '../triangulation/polygon'
import { TRIANGULATION_PRESETS } from '../triangulation/presets'
import { triangulate } from '../triangulation/triangulate'
import { randomStarPolygon } from '../triangulation/verify'
import { colorName, dualTree, fisk, label, type FiskResult } from './fisk'
import type { GalleryPatch, GalleryRecorderContext } from './galleryState'
import { coverage } from './visibility'

const P = (...c: [number, number][]): Pt[] => c.map(([x, y]) => ({ x, y }))

const TRIANGLE = P([200, 80], [580, 80], [390, 320])
const SQUARE = P([0, 0], [100, 0], [100, 100], [0, 100])
// triangles [0,1,2], [0,2,4], [0,4,5], [2,3,4]
const HEXAGON = P([100, 40], [300, 20], [380, 140], [300, 260], [200, 150], [80, 220])
const TEXTBOOK = TRIANGULATION_PRESETS.find((p) => p.name === 'Textbook polygon')!.polygon

function randomPolygons(count: number, seed: number, nMin = 3, nMax = 30): Pt[][] {
  const rng = mulberry32(seed)
  const out: Pt[][] = []
  while (out.length < count) {
    const n = nMin + Math.floor(rng() * (nMax - nMin + 1))
    const p = randomStarPolygon(rng, n, 387, 180, 30 + rng() * 60, 160)
    if (isSimple(p)) out.push(p)
  }
  return out
}

/** Checks the invariants of Fisk's construction on any polygon. */
function checkFisk(polygon: Pt[], r: FiskResult) {
  const n = polygon.length
  expect(r.triangles).toHaveLength(n - 2)
  expect(r.colors).toHaveLength(n)
  for (const t of r.triangles) expect(new Set(t.map((v) => r.colors[v])).size).toBe(3)
  expect([...r.order].sort((a, b) => a - b)).toEqual(r.triangles.map((_, i) => i))
  const counts = [0, 1, 2].map((c) => r.colors.filter((x) => x === c).length)
  expect(r.counts).toEqual(counts)
  expect(r.counts[r.chosen]).toBe(Math.min(...counts))
  expect(counts.findIndex((k) => k === Math.min(...counts))).toBe(r.chosen)
  expect(r.cameras).toEqual(r.colors.flatMap((c, i) => (c === r.chosen ? [i] : [])))
  expect(r.cameras.length).toBeLessThanOrEqual(Math.floor(n / 3))
  for (const t of r.triangles) expect(t.some((v) => r.cameras.includes(v))).toBe(true)
}

function record() {
  const steps: { line: number; description: string; patch: GalleryPatch; ctx: GalleryRecorderContext }[] = []
  const rec = (line: number, description: string, patch: GalleryPatch, ctx: GalleryRecorderContext) =>
    steps.push({ line, description, patch, ctx })
  return { steps, rec }
}

describe('labels', () => {
  it('label is 1-based, colours are red, green, blue', () => {
    expect(label(0)).toBe('v1')
    expect(label(13)).toBe('v14')
    expect([0, 1, 2].map((c) => colorName(c as 0 | 1 | 2))).toEqual(['red', 'green', 'blue'])
  })
})

describe('dualTree', () => {
  const check = (triangles: Triangle[]) => {
    const m = triangles.length
    const { adjacency, shared } = dualTree(triangles)
    expect(adjacency).toHaveLength(m)
    const arcs = adjacency.reduce((s, a) => s + a.length, 0) / 2
    expect(arcs).toBe(m - 1)
    expect(shared.size).toBe(m - 1)
    for (let i = 0; i < m; i++) {
      expect(adjacency[i]).toEqual([...adjacency[i]].sort((a, b) => a - b))
      for (const j of adjacency[i]) {
        expect(adjacency[j]).toContain(i)
        const pair = shared.get(`${Math.min(i, j)}-${Math.max(i, j)}`)!
        expect(pair).toEqual(triangles[i].filter((v) => triangles[j].includes(v)).sort((a, b) => a - b))
      }
    }
    // connected: a tree with m − 1 arcs that reaches every node
    const seen = new Set([0])
    const stack = [0]
    while (stack.length) for (const j of adjacency[stack.pop()!]) if (!seen.has(j)) seen.add(j), stack.push(j)
    expect(seen.size).toBe(m)
  }

  it('hexagon: known arcs', () => {
    const { adjacency, shared } = dualTree(triangulate(HEXAGON).triangles)
    expect(adjacency).toEqual([[1], [0, 2, 3], [1], [1]])
    expect([...shared.entries()]).toEqual([['0-1', [0, 2]], ['1-2', [0, 4]], ['1-3', [2, 4]]])
  })

  it('n − 2 nodes, n − 3 arcs, connected (presets and random polygons)', () => {
    for (const p of TRIANGULATION_PRESETS) check(triangulate(p.polygon).triangles)
    for (const p of randomPolygons(50, 7)) check(triangulate(p).triangles)
  })

  it('single triangle: one node, no arcs', () => {
    expect(dualTree([[0, 1, 2]])).toEqual({ adjacency: [[]], shared: new Map() })
  })
})

describe('fisk', () => {
  it('triangle: one camera at v1', () => {
    const r = fisk(TRIANGLE)
    expect(r).toEqual({
      triangles: [[0, 1, 2]],
      colors: [0, 1, 2],
      order: [0],
      counts: [1, 1, 1],
      chosen: 0,
      cameras: [0],
    })
  })

  it('square: one camera', () => {
    const r = fisk(SQUARE)
    checkFisk(SQUARE, r)
    expect(r.colors).toEqual([0, 1, 2, 1])
    expect(r.counts).toEqual([1, 2, 1])
    expect(r.chosen).toBe(0)
    expect(r.cameras).toEqual([0])
  })

  it('hexagon: depth-first order and colours', () => {
    const r = fisk(HEXAGON)
    checkFisk(HEXAGON, r)
    expect(r.order).toEqual([0, 1, 2, 3])
    expect(r.colors).toEqual([0, 1, 2, 0, 1, 2])
    expect(r.chosen).toBe(0)
    expect(r.cameras).toEqual([0, 3])
  })

  it('Textbook polygon: depth-first (not breadth-first) order, 4 cameras', () => {
    const r = fisk(TEXTBOOK)
    checkFisk(TEXTBOOK, r)
    expect(r.triangles).toEqual(triangulate(TEXTBOOK).triangles)
    expect(r.order).toEqual([0, 4, 3, 2, 1, 5, 6, 8, 7, 10, 9, 11])
    expect(r.colors).toEqual([0, 1, 2, 0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2])
    expect(r.counts).toEqual([4, 5, 5])
    expect(r.chosen).toBe(0)
    expect(r.cameras).toEqual([0, 3, 7, 11])
    expect(coverage(TEXTBOOK, r.cameras)).toMatchObject({ percent: 100, covered: true })
  })

  it('200 random simple polygons: valid 3-colouring, at most ⌊n/3⌋ cameras, every triangle guarded', () => {
    const polys = randomPolygons(200, 2026)
    expect(new Set(polys.map((p) => p.length)).size).toBeGreaterThan(20)
    for (const p of polys) checkFisk(p, fisk(p))
  })

  it('Fisk cameras cover random polygons', () => {
    for (const p of randomPolygons(15, 99, 6, 24)) {
      const r = fisk(p)
      expect(coverage(p, r.cameras)).toMatchObject({ percent: 100, covered: true })
    }
  })

  it('CW input: the same cameras in input indices', () => {
    for (const p of [HEXAGON, TEXTBOOK, ...randomPolygons(30, 5)]) {
      const n = p.length
      const a = fisk(p)
      const b = fisk([...p].reverse())
      const f = (i: number) => n - 1 - i
      expect(b.cameras).toEqual(a.cameras.map(f).sort((x, y) => x - y))
      expect(b.colors).toEqual(a.colors.map((_, i) => a.colors[f(i)]))
      expect(b.order).toEqual(a.order)
      expect(b.triangles).toEqual(a.triangles.map((t) => t.map(f)))
      expect(b.counts).toEqual(a.counts)
      expect(b.chosen).toBe(a.chosen)
      checkFisk([...p].reverse(), b)
    }
  })

  it('deterministic', () => {
    for (const p of [TEXTBOOK, ...randomPolygons(10, 11)]) expect(fisk(p)).toEqual(fisk(p))
  })

  it('throws on a non-simple polygon', () => {
    expect(() => fisk(P([0, 0], [100, 100], [100, 0], [0, 100]))).toThrow()
  })
})

describe('fisk recorder', () => {
  it('recorder lines and descriptions', () => {
    const { steps, rec } = record()
    const r = fisk(HEXAGON, rec)
    expect(steps.map((s) => s.line)).toEqual([1, 2, 3, 6, 6, 6, 7, 8, 9])
    expect(steps.map((s) => s.description)).toEqual([
      'Triangulation: 4 triangles, 3 diagonals',
      'Dual tree: 4 nodes, 3 arcs',
      'First triangle v1 v2 v3: v1 red, v2 green, v3 blue',
      'Triangle v1 v3 v5: v5 gets green',
      'Triangle v1 v5 v6: v6 gets blue',
      'Triangle v3 v4 v5: v4 gets red',
      'Colour counts: red 2, green 2, blue 2 → red',
      'Place cameras at v1, v4',
      'Done: 2 cameras for 6 vertices (⌊6/3⌋ = 2)',
    ])
    expect(steps.map((s) => s.ctx.phase)).toEqual([
      'triangulate', 'dual', 'color', 'color', 'color', 'color', 'choose', 'place', 'done',
    ])
    expect(steps.every((s) => s.ctx.mode === 'fisk')).toBe(true)
    expect(steps.length).toBe(HEXAGON.length + 3)
    const last = steps[steps.length - 1]
    expect(last.ctx.colors).toEqual(r.colors)
    expect(last.ctx.cameras).toEqual(r.cameras)
    expect(last.ctx.triangles).toEqual(r.triangles)
  })

  it('patch and context fields per line', () => {
    const { steps, rec } = record()
    fisk(HEXAGON, rec)
    const [s1, s2, s3, s6a, s6b, s6c, s7, s8, s9] = steps
    expect(s1.patch).toEqual({})
    expect(s1.ctx.dualEdges).toEqual([])
    expect(s1.ctx.colors).toEqual([null, null, null, null, null, null])
    expect(s1.ctx.triangles).toEqual(triangulate(HEXAGON).triangles)
    expect(s2.patch).toEqual({})
    expect(s2.ctx.dualEdges).toEqual([[0, 1], [1, 2], [1, 3]])
    expect(s3.patch).toEqual({ current: 0, newlyColored: [0, 1, 2] })
    expect(s3.ctx.colors).toEqual([0, 1, 2, null, null, null])
    expect(s6a.patch).toEqual({ current: 1, newlyColored: [4] })
    expect(s6a.ctx.colors).toEqual([0, 1, 2, null, 1, null])
    expect(s6b.patch).toEqual({ current: 2, newlyColored: [5] })
    expect(s6c.patch).toEqual({ current: 3, newlyColored: [3] })
    expect(s6c.ctx.colors).toEqual([0, 1, 2, 0, 1, 2])
    for (const s of [s1, s2, s3, s6a, s6b, s6c, s7]) {
      expect(s.ctx.cameras).toEqual([])
      expect(s.ctx.visibility).toEqual([])
    }
    expect(s7.patch).toEqual({ counts: [2, 2, 2], chosen: 0 })
    for (const s of [s8, s9]) {
      expect(s.patch).toEqual({ counts: [2, 2, 2], chosen: 0 })
      expect(s.ctx.cameras).toEqual([0, 3])
      expect(s.ctx.visibility).toHaveLength(2)
      expect(s.ctx.visibility[0][0]).toEqual(HEXAGON[0])
      expect(s.ctx.visibility[1][0]).toEqual(HEXAGON[3])
    }
  })

  it('context arrays are copies', () => {
    const { steps, rec } = record()
    fisk(HEXAGON, rec)
    steps[2].ctx.colors[5] = 2
    steps[2].ctx.triangles[0][0] = 99
    steps[1].ctx.dualEdges.push([7, 8])
    expect(steps[3].ctx.colors[5]).toBeNull()
    expect(steps[3].ctx.triangles[0][0]).toBe(0)
    expect(steps[3].ctx.dualEdges).toHaveLength(3)
  })

  it('singular wording for one camera', () => {
    const { steps, rec } = record()
    fisk(TRIANGLE, rec)
    expect(steps.map((s) => [s.line, s.description])).toEqual([
      [1, 'Triangulation: 1 triangle, 0 diagonals'],
      [2, 'Dual tree: 1 node, 0 arcs'],
      [3, 'First triangle v1 v2 v3: v1 red, v2 green, v3 blue'],
      [7, 'Colour counts: red 1, green 1, blue 1 → red'],
      [8, 'Place a camera at v1'],
      [9, 'Done: 1 camera for 3 vertices (⌊3/3⌋ = 1)'],
    ])
    const sq = record()
    fisk(SQUARE, sq.rec)
    expect(sq.steps.map((s) => s.description).slice(-4)).toEqual([
      'Triangle v1 v3 v4: v4 gets green',
      'Colour counts: red 1, green 2, blue 1 → red',
      'Place a camera at v1',
      'Done: 1 camera for 4 vertices (⌊4/3⌋ = 1)',
    ])
  })

  it('Textbook polygon: n + 3 steps, depth-first descriptions', () => {
    const { steps, rec } = record()
    fisk(TEXTBOOK, rec)
    expect(steps).toHaveLength(17)
    expect(steps.map((s) => s.description)).toEqual([
      'Triangulation: 12 triangles, 11 diagonals',
      'Dual tree: 12 nodes, 11 arcs',
      'First triangle v1 v2 v14: v1 red, v2 green, v14 blue',
      'Triangle v2 v8 v14: v8 gets red',
      'Triangle v2 v6 v8: v6 gets blue',
      'Triangle v2 v4 v6: v4 gets red',
      'Triangle v2 v3 v4: v3 gets blue',
      'Triangle v4 v5 v6: v5 gets green',
      'Triangle v6 v7 v8: v7 gets green',
      'Triangle v8 v10 v14: v10 gets green',
      'Triangle v8 v9 v10: v9 gets blue',
      'Triangle v10 v12 v14: v12 gets red',
      'Triangle v10 v11 v12: v11 gets blue',
      'Triangle v12 v13 v14: v13 gets green',
      'Colour counts: red 4, green 5, blue 5 → red',
      'Place cameras at v1, v4, v8, v12',
      'Done: 4 cameras for 14 vertices (⌊14/3⌋ = 4)',
    ])
  })

  it('CW input: descriptions in input labels', () => {
    const { steps, rec } = record()
    fisk([...HEXAGON].reverse(), rec)
    expect(steps.map((s) => s.description)).toEqual([
      'Triangulation: 4 triangles, 3 diagonals',
      'Dual tree: 4 nodes, 3 arcs',
      'First triangle v6 v5 v4: v6 red, v5 green, v4 blue',
      'Triangle v6 v4 v2: v2 gets green',
      'Triangle v6 v2 v1: v1 gets blue',
      'Triangle v4 v3 v2: v3 gets red',
      'Colour counts: red 2, green 2, blue 2 → red',
      'Place cameras at v3, v6',
      'Done: 2 cameras for 6 vertices (⌊6/3⌋ = 2)',
    ])
    expect(steps[2].patch.newlyColored).toEqual([5, 4, 3])
    expect(steps[7].ctx.visibility[0][0]).toEqual(HEXAGON[3])
  })
})
