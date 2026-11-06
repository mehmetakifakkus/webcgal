import { describe, expect, it } from 'vitest'
import type { Segment } from '../../types'
import { StatusStructure, compareAt } from './status'

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})
const base: Segment[] = [
  seg(0, 0, 4, 4), // s0
  seg(4, 0, 0, 4), // s1
  seg(2, -1, 2, 5), // s2
  seg(0, 2, 4, 2), // s3 horizontal
]

describe('StatusStructure', () => {
  it('order above the crossing', () => {
    const st = new StatusStructure(base)
    for (const i of [0, 1, 2]) st.insert(i, { x: 2, y: 3 })
    expect(st.toArray()).toEqual([1, 2, 0])
  })

  it('reorder at the crossing', () => {
    const st = new StatusStructure(base)
    for (const i of [0, 1, 2]) st.insert(i, { x: 2, y: 3 })
    expect(st.toArray()).toEqual([1, 2, 0])
    st.reorderAt({ x: 2, y: 2 })
    expect(st.toArray()).toEqual([0, 2, 1])
  })

  it('horizontal is rightmost at p', () => {
    const st = new StatusStructure(base)
    for (const i of [0, 1, 2, 3]) st.insert(i, { x: 2, y: 2 })
    expect(st.toArray()[3]).toBe(3)
  })

  it('findThrough returns all segments through p', () => {
    const st = new StatusStructure(base)
    for (const i of [0, 1, 2, 3]) st.insert(i, { x: 2, y: 2 })
    expect([...st.findThrough({ x: 2, y: 2 })].sort()).toEqual([0, 1, 2, 3])
  })

  it('leftOf and rightOf exclude segments through p', () => {
    const segs = [...base, seg(-3, 0, -3, 4), seg(6, 0, 6, 4)]
    const st = new StatusStructure(segs)
    const p = { x: 2, y: 2 }
    for (let i = 0; i < segs.length; i++) st.insert(i, p)
    expect(st.leftOf(p)).toBe(4)
    expect(st.rightOf(p)).toBe(5)
  })

  it('overlapping collinear by index', () => {
    const segs = [seg(0, 0, 3, 3), seg(1, 1, 4, 4)]
    const st = new StatusStructure(segs)
    st.insert(1, { x: 2, y: 2 })
    st.insert(0, { x: 2, y: 2 })
    expect(st.toArray()).toEqual([0, 1])
    expect(compareAt(segs, { x: 2, y: 2 })(0, 1)).toBeLessThan(0)
  })

  it('remove updates neighbors', () => {
    const st = new StatusStructure(base)
    for (const i of [0, 1, 2]) st.insert(i, { x: 2, y: 3 })
    expect(st.leftNeighbor(2)).toBe(1)
    expect(st.rightNeighbor(2)).toBe(0)
    expect(st.leftNeighbor(1)).toBeUndefined()
    st.remove(2)
    expect(st.rightNeighbor(1)).toBe(0)
    expect(st.leftNeighbor(0)).toBe(1)
    expect(st.toArray()).toEqual([1, 0])
  })
})
