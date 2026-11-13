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
const NEW_PATHS = ['/algorithms/segmentIntersection', '/algorithms/triangulation', '/algorithms/delaunay', '/algorithms/voronoi', '/algorithms/kdTree', '/algorithms/artGallery', '/algorithms/rangeTree']

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

  test('Art Gallery Problem follows Polygon Triangulation in the menu', () => {
    expect(algorithms.map((a) => a.path).slice(2, 5)).toEqual([
      '/algorithms/triangulation',
      '/algorithms/artGallery',
      '/algorithms/delaunay',
    ])
  })

  test('Voronoi Diagram follows Delaunay Triangulation in the menu', () => {
    expect(algorithms.map((a) => a.path).slice(4, 7)).toEqual([
      '/algorithms/delaunay',
      '/algorithms/voronoi',
      '/algorithms/smallestEnclosingDisk',
    ])
  })

  test('kd-Tree Range Search follows Smallest Enclosing Disk in the menu', () => {
    expect(algorithms.map((a) => a.path).slice(6, 9)).toEqual([
      '/algorithms/smallestEnclosingDisk',
      '/algorithms/kdTree',
      '/algorithms/rangeTree',
    ])
  })

  test('Range Tree follows kd-Tree Range Search in the menu', () => {
    expect(algorithms.map((a) => a.path).slice(7, 10)).toEqual([
      '/algorithms/kdTree',
      '/algorithms/rangeTree',
      '/algorithms/L-monoton',
    ])
  })

  test('the kd-tree page has a step player and one 775x360 canvas', () => {
    const a = findAlgorithm('/algorithms/kdTree')
    expect(a).toMatchObject({
      slug: 'kdTree',
      name: 'kd-Tree Range Search',
      thumbnail: '/images/kdTree_tn.png',
      summary: 'Build a kd-tree by alternating median splits and answer a rectangular range query, step by step.',
      canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
    })
    expect(a?.player).toBeTypeOf('function')
  })

  test('the range tree page has a step player and one 775x480 canvas', () => {
    const a = findAlgorithm('/algorithms/rangeTree')
    expect(a).toMatchObject({
      slug: 'rangeTree',
      name: 'Range Tree',
      thumbnail: '/images/rangeTree_tn.png',
      summary:
        'Build a 2-D range tree (a tree on x with an associated tree on y at every node) and answer a rectangular range query in O(log² n + k), step by step.',
      canvases: [{ id: 'canvas-1', width: 775, height: 480, label: '' }],
    })
    expect(a?.player).toBeTypeOf('function')
  })

  test('the art gallery page has a step player and one 775x360 canvas', () => {
    const a = findAlgorithm('/algorithms/artGallery')
    expect(a).toMatchObject({
      slug: 'artGallery',
      name: 'Art Gallery Problem',
      thumbnail: '/images/artGallery_tn.png',
      summary: 'Guard any simple polygon with at most ⌊n/3⌋ cameras: triangulate, 3-colour the vertices, and use the smallest colour class.',
      canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
    })
    expect(a?.player).toBeTypeOf('function')
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
