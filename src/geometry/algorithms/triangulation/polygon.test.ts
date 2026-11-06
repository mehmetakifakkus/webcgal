import { describe, expect, it } from 'vitest'
import type { Polygon, VertexType } from '../../types'
import {
  above,
  ensureCCW,
  interiorToRight,
  isReflex,
  isSimple,
  lexicographicOrder,
  signedArea,
  vertexType,
  vertexTypes,
} from './polygon'

const P = (pts: Array<[number, number]>): Polygon => pts.map(([x, y]) => ({ x, y }))
const square = P([[0, 0], [4, 0], [4, 4], [0, 4]])
const textbook = P([
  [120, 310], [80, 180], [150, 60], [260, 150], [360, 40], [470, 160], [580, 50],
  [700, 190], [660, 320], [560, 220], [470, 330], [370, 230], [280, 320], [200, 230],
])

describe('polygon helpers', () => {
  it('signedArea', () => {
    expect(signedArea(square)).toBe(16)
    expect(signedArea([...square].reverse())).toBe(-16)
  })

  it('ensureCCW', () => {
    const cw = [...square].reverse()
    const r = ensureCCW(cw)
    expect(r.reversed).toBe(true)
    expect(signedArea(r.polygon)).toBe(16)
    const s = ensureCCW(square)
    expect(s.reversed).toBe(false)
    expect(s.polygon).toEqual(square)
  })

  it('isSimple', () => {
    expect(isSimple(square)).toBe(true)
    expect(isSimple(P([[0, 0], [4, 4], [4, 0], [0, 4]]))).toBe(false)
    expect(isSimple(P([[0, 0], [4, 0], [4, 0], [4, 4]]))).toBe(false)
    expect(isSimple(P([[0, 0], [4, 0]]))).toBe(false)
    expect(isSimple(P([[0, 0], [4, 0], [4, 4], [2, 0], [0, 4]]))).toBe(false)
    expect(isSimple(textbook)).toBe(true)
  })

  it('isSimple rejects repeated vertex', () => {
    expect(isSimple(P([[0, 0], [4, 0], [4, 4], [0, 0], [0, 4]]))).toBe(false)
  })

  it('above', () => {
    expect(above({ x: 1, y: 5 }, { x: 3, y: 2 })).toBe(true)
    expect(above({ x: 3, y: 5 }, { x: 1, y: 5 })).toBe(false)
    expect(above({ x: 1, y: 5 }, { x: 3, y: 5 })).toBe(true)
  })

  it('lexicographicOrder', () => {
    expect(lexicographicOrder(P([[0, 0], [4, 0], [4, 4], [0, 4]]))).toEqual([3, 2, 0, 1])
  })

  it('isReflex', () => {
    const l = P([[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]])
    expect(isReflex(l, 3)).toBe(true)
    expect(isReflex(l, 0)).toBe(false)
    expect(isReflex(P([[0, 0], [2, 0], [4, 0], [4, 4]]), 1)).toBe(false)
  })

  it('vertexType on the textbook polygon', () => {
    const expected: Record<VertexType, number[]> = {
      start: [1, 9, 11, 13],
      end: [3, 5, 7],
      split: [4, 6],
      merge: [10, 12, 14],
      regular: [2, 8],
    }
    const types = vertexTypes(textbook)
    for (const [t, vs] of Object.entries(expected)) {
      for (const v of vs) expect(types[v - 1], `v${v}`).toBe(t)
    }
    expect(vertexType(textbook, 3)).toBe('split')
  })

  it('interiorToRight', () => {
    expect(interiorToRight(textbook, 1)).toBe(true)
    expect(interiorToRight(textbook, 7)).toBe(false)
  })
})
