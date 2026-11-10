import { describe, expect, it } from 'vitest'
import { PLANE_BOX, buildKdTree } from './kdTree'
import { KD_PRESETS } from './presets'
import { searchKdTree } from './search'
import { bruteForceRange, checkKdTree } from './verify'

const byName = (name: string) => KD_PRESETS.find((p) => p.name === name)!

describe('KD_PRESETS', () => {
  it('has the six presets', () => {
    expect(KD_PRESETS.map((p) => p.name)).toEqual([
      'Textbook example',
      'Square grid 4×4',
      'Clusters',
      'Points on a diagonal',
      'Query covers everything',
      'Empty query',
    ])
  })

  for (const p of KD_PRESETS) {
    it(`${p.name}: the tree is valid and the pinned counts hold`, () => {
      const { points, query } = p.input
      const tree = buildKdTree(points)
      expect(checkKdTree(points, tree)).toEqual({ ok: true })
      expect(tree.nodes).toBe(p.expected.nodes)
      expect(tree.depth).toBe(p.expected.depth)
      const r = searchKdTree(points, tree, query)
      expect(r.reported).toEqual(p.expected.reported)
      expect(r.reported).toEqual(bruteForceRange(points, query))
      expect(r.visited).toBe(p.expected.visited)
      expect(r.inside).toBe(p.expected.inside)
      expect(r.pruned).toBe(p.expected.pruned)
    })

    it(`${p.name}: points and query lie inside the plane box`, () => {
      for (const pt of p.input.points) {
        expect(pt.x).toBeGreaterThanOrEqual(PLANE_BOX.x0)
        expect(pt.x).toBeLessThanOrEqual(PLANE_BOX.x1)
        expect(pt.y).toBeGreaterThanOrEqual(PLANE_BOX.y0)
        expect(pt.y).toBeLessThanOrEqual(PLANE_BOX.y1)
      }
      const q = p.input.query
      expect(q.x0).toBeGreaterThanOrEqual(PLANE_BOX.x0)
      expect(q.x1).toBeLessThanOrEqual(PLANE_BOX.x1)
      expect(q.y0).toBeGreaterThanOrEqual(PLANE_BOX.y0)
      expect(q.y1).toBeLessThanOrEqual(PLANE_BOX.y1)
    })
  }

  it('Textbook example has a region inside R, a pruned subtree and at least 3 reported points', () => {
    const { points, query } = byName('Textbook example').input
    const r = searchKdTree(points, buildKdTree(points), query)
    expect(r.inside).toBeGreaterThanOrEqual(1)
    expect(r.pruned).toBeGreaterThanOrEqual(1)
    expect(r.reported.length).toBeGreaterThanOrEqual(3)
  })

  it('Query covers everything visits only the root and reports both children whole', () => {
    const { points, query } = byName('Query covers everything').input
    const r = searchKdTree(points, buildKdTree(points), query)
    expect(r.visited).toBe(1)
    expect(r.inside).toBe(2)
    expect(r.reported).toHaveLength(points.length)
  })

  it('Empty query reports nothing', () => {
    expect(byName('Empty query').expected.reported).toEqual([])
  })
})
