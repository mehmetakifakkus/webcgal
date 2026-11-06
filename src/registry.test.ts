import { describe, expect, test } from 'vitest'
import { algorithms, findAlgorithm } from './registry'

const LEGACY_PATHS = [
  '/algorithms/convexHull',
  '/algorithms/smallestEnclosingDisk',
  '/algorithms/L-monoton',
  '/algorithms/duality/dualLine',
  '/algorithms/duality/checkStabber',
]

describe('registry', () => {
  test('paths are legacy paths', () => {
    expect(algorithms.map((a) => a.path)).toEqual(LEGACY_PATHS)
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
