import { describe, expect, test } from 'vitest'
import { algorithms, findAlgorithm } from './registry'

const LEGACY_PATHS = [
  '/algorithms/convexHull',
  '/algorithms/smallestEnclosingDisk',
  '/algorithms/L-monoton',
  '/algorithms/duality/dualLine',
  '/algorithms/duality/checkStabber',
]

/** Pages added after the migration (not on the legacy site). */
const NEW_PATHS = ['/algorithms/segmentIntersection', '/algorithms/triangulation', '/algorithms/delaunay', '/algorithms/voronoi']

describe('registry', () => {
  test('paths are legacy paths', () => {
    expect(algorithms.map((a) => a.path).filter((p) => !NEW_PATHS.includes(p))).toEqual(LEGACY_PATHS)
  })

  test('Line Segment Intersection follows Convex Hull in the menu', () => {
    expect(algorithms.map((a) => a.path).slice(0, 2)).toEqual(['/algorithms/convexHull', '/algorithms/segmentIntersection'])
  })

  test('Polygon Triangulation follows Line Segment Intersection in the menu', () => {
    expect(algorithms.map((a) => a.path).slice(1, 3)).toEqual(['/algorithms/segmentIntersection', '/algorithms/triangulation'])
  })

  test('Delaunay Triangulation follows Polygon Triangulation in the menu', () => {
    expect(algorithms.map((a) => a.path).slice(2, 4)).toEqual(['/algorithms/triangulation', '/algorithms/delaunay'])
  })

  test('Voronoi Diagram follows Delaunay Triangulation in the menu', () => {
    expect(algorithms.map((a) => a.path).slice(3, 6)).toEqual([
      '/algorithms/delaunay',
      '/algorithms/voronoi',
      '/algorithms/smallestEnclosingDisk',
    ])
  })

  test('slugs unique', () => {
    const slugs = algorithms.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  test('path ends with slug and group matches', () => {
    for (const a of algorithms) {
      expect(a.path.endsWith('/' + a.slug)).toBe(true)
      expect(a.path.startsWith('/algorithms/duality/')).toBe(a.group === 'duality')
    }
  })

  test('findAlgorithm', () => {
    expect(findAlgorithm('/algorithms/nope')).toBeUndefined()
    expect(findAlgorithm('/algorithms/L-monoton')?.slug).toBe('L-monoton')
  })
})
