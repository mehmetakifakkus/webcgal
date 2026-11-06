import { describe, expect, it } from 'vitest'
import { cross, distance, orientation } from './primitives'

describe('primitives', () => {
  it('cross of a left turn is positive', () => {
    expect(cross({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1)
  })
  it('orientation returns 1, -1 and 0', () => {
    const o = { x: 0, y: 0 }
    expect(orientation(o, { x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1)
    expect(orientation(o, { x: 1, y: 0 }, { x: 0, y: -1 })).toBe(-1)
    expect(orientation(o, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(0)
  })
  it('distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})
