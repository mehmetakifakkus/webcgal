import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../delaunay/delaunay'
import { PLANE_BOX } from '../kdtree/kdTree'
import { KD_PRESETS } from '../kdtree/presets'
import { bruteForceRange } from '../kdtree/verify'
import { RT_PRESETS, randomRangeTreeInput } from './presets'
import { RT_PLANE, rangeTree } from './rangeTree'
import { rangeQuery2D } from './search'
import { checkRangeTree } from './verify'

const byName = (name: string) => RT_PRESETS.find((p) => p.name === name)!
const MARGIN = 15
const MIN_GAP = 12

function insidePlane(input: (typeof RT_PRESETS)[number]['input'], name: string) {
  for (const pt of input.points) {
    expect(pt.x, name).toBeGreaterThanOrEqual(RT_PLANE.x0 + MARGIN)
    expect(pt.x, name).toBeLessThanOrEqual(RT_PLANE.x1 - MARGIN)
    expect(pt.y, name).toBeGreaterThanOrEqual(RT_PLANE.y0 + MARGIN)
    expect(pt.y, name).toBeLessThanOrEqual(RT_PLANE.y1 - MARGIN)
  }
  const q = input.query
  expect(q.x0, name).toBeGreaterThanOrEqual(RT_PLANE.x0)
  expect(q.x1, name).toBeLessThanOrEqual(RT_PLANE.x1)
  expect(q.y0, name).toBeGreaterThanOrEqual(RT_PLANE.y0)
  expect(q.y1, name).toBeLessThanOrEqual(RT_PLANE.y1)
  expect(q.x0, name).toBeLessThanOrEqual(q.x1)
  expect(q.y0, name).toBeLessThanOrEqual(q.y1)
}

describe('RT_PLANE', () => {
  it('is the plane area of the canvas', () => {
    expect(RT_PLANE).toEqual({ x0: 15, y0: 15, x1: 355, y1: 465 })
  })
})

describe('RT_PRESETS', () => {
  it('has the six presets of spec §3.5', () => {
    expect(RT_PRESETS.map((p) => p.name)).toEqual([
      'Textbook example',
      'Square grid 4×4',
      'Clusters',
      'Thin vertical strip',
      'Query covers everything',
      'Empty query',
    ])
  })

  for (const p of RT_PRESETS) {
    it(`${p.name}: the tree is valid and the pinned values hold`, () => {
      const { points, query } = p.input
      const tree = rangeTree(points)
      expect(checkRangeTree(points, tree)).toEqual({ ok: true })
      const q = rangeQuery2D(points, tree, query)
      expect(q.reported).toEqual(bruteForceRange(points, query))
      expect({
        reported: q.reported,
        canonical: q.canonical.length,
        assocQueries: q.assocQueries.length,
        nodes: tree.nodes.length,
        storage: tree.storage,
        depth: tree.depth,
      }).toEqual(p.expected)
    })

    it(`${p.name}: points lie in the plane area with a margin of ${MARGIN}, the query inside it`, () => {
      insidePlane(p.input, p.name)
    })

    it(`${p.name}: points are integers at least ${MIN_GAP} apart`, () => {
      const pts = p.input.points
      for (const pt of pts) expect(Number.isInteger(pt.x) && Number.isInteger(pt.y), p.name).toBe(true)
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++)
          expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y), `${p.name}: p${i + 1}, p${j + 1}`).toBeGreaterThanOrEqual(MIN_GAP)
    })
  }

  it("Textbook example is the kd-tree page's, mapped affinely from its plane box", () => {
    const kd = KD_PRESETS.find((p) => p.name === 'Textbook example')!.input
    const B = PLANE_BOX
    const fx = (x: number) => Math.round(RT_PLANE.x0 + ((x - B.x0) * (RT_PLANE.x1 - RT_PLANE.x0)) / (B.x1 - B.x0))
    const fy = (y: number) => Math.round(RT_PLANE.y0 + ((y - B.y0) * (RT_PLANE.y1 - RT_PLANE.y0)) / (B.y1 - B.y0))
    const { input } = byName('Textbook example')
    expect(input.points).toEqual(kd.points.map((p) => ({ x: fx(p.x), y: fy(p.y) })))
    expect(input.query).toEqual({ x0: fx(kd.query.x0), y0: fy(kd.query.y0), x1: fx(kd.query.x1), y1: fy(kd.query.y1) })
    // the same points are reported on both pages
    expect(byName('Textbook example').expected.reported).toEqual(KD_PRESETS[0].expected.reported)
  })

  it('Thin vertical strip: narrow in x, tall in y, at least 3 canonical subtrees over about 14 points', () => {
    const { input, expected } = byName('Thin vertical strip')
    expect(input.points.length).toBeGreaterThanOrEqual(12)
    expect(input.points.length).toBeLessThanOrEqual(16)
    const { x0, x1, y0, y1 } = input.query
    expect(x1 - x0).toBeLessThan((y1 - y0) / 4)
    expect(expected.canonical).toBeGreaterThanOrEqual(3)
    // at least two canonical subtrees are inner nodes, not single leaves
    const tree = rangeTree(input.points)
    const inner = rangeQuery2D(input.points, tree, input.query).canonical.filter((id) => tree.nodes[id].kind === 'split')
    expect(inner.length).toBeGreaterThanOrEqual(2)
  })

  it('Query covers everything reports every point', () => {
    const { input, expected } = byName('Query covers everything')
    expect(expected.reported).toEqual(input.points.map((_, i) => i))
  })

  it('Empty query reports nothing', () => {
    expect(byName('Empty query').expected.reported).toEqual([])
  })
})

describe('randomRangeTreeInput', () => {
  it('gives 8–16 integer points in the plane area with a margin, at least 12 apart, and a rectangle inside it', () => {
    const sizes = new Set<number>()
    for (let seed = 1; seed <= 200; seed++) {
      const input = randomRangeTreeInput(mulberry32(seed))
      sizes.add(input.points.length)
      expect(input.points.length).toBeGreaterThanOrEqual(8)
      expect(input.points.length).toBeLessThanOrEqual(16)
      insidePlane(input, `seed ${seed}`)
      const { x0, y0, x1, y1 } = input.query
      for (const v of [x0, y0, x1, y1]) expect(Number.isInteger(v)).toBe(true)
      expect(x1 - x0).toBeGreaterThan(0)
      expect(y1 - y0).toBeGreaterThan(0)
      const pts = input.points
      for (const pt of pts) expect(Number.isInteger(pt.x) && Number.isInteger(pt.y)).toBe(true)
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++)
          expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThanOrEqual(MIN_GAP)
    }
    expect(sizes.size).toBe(9)
  })

  it('defaults to Math.random', () => {
    expect(randomRangeTreeInput().points.length).toBeGreaterThanOrEqual(8)
  })
})
