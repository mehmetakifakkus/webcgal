import { describe, expect, it } from 'vitest'
import type { Diagonal, Polygon } from '../../types'
import { makeMonotone } from './makeMonotone'
import { signedArea } from './polygon'
import { splitByDiagonals } from './split'

const P = (pts: Array<[number, number]>): Polygon => pts.map(([x, y]) => ({ x, y }))
const square = P([[0, 0], [4, 0], [4, 4], [0, 4]])
const textbook = P([
  [120, 310], [80, 180], [150, 60], [260, 150], [360, 40], [470, 160], [580, 50],
  [700, 190], [660, 320], [560, 220], [470, 330], [370, 230], [280, 320], [200, 230],
])

const key = (pieces: number[][]) => pieces.map((p) => p.join(',')).sort()

describe('splitByDiagonals', () => {
  it('square split into two CCW triangles', () => {
    expect(splitByDiagonals(square, [[0, 2]])).toEqual([[0, 1, 2], [0, 2, 3]])
  })

  it('no diagonals → whole polygon', () => {
    expect(splitByDiagonals(square, [])).toEqual([[0, 1, 2, 3]])
  })

  it('textbook polygon with makeMonotone diagonals', () => {
    const { diagonals } = makeMonotone(textbook)
    const pieces = splitByDiagonals(textbook, diagonals)
    expect(pieces.length).toBe(6)
    expect(pieces.reduce((s, p) => s + p.length, 0)).toBe(textbook.length + 2 * diagonals.length)
    for (const piece of pieces) expect(signedArea(piece.map((i) => textbook[i]))).toBeGreaterThan(0)
  })

  it('any diagonal order gives the same pieces', () => {
    const { diagonals } = makeMonotone(textbook)
    const base = key(splitByDiagonals(textbook, diagonals))
    const orders: Diagonal[][] = [
      [...diagonals].reverse(),
      [...diagonals].sort((a, b) => b[1] - a[1]),
      diagonals.map(([a, b]) => [b, a] as Diagonal),
      [diagonals[2], diagonals[0], diagonals[4], diagonals[1], diagonals[3]],
    ]
    for (const o of orders) expect(key(splitByDiagonals(textbook, o))).toEqual(base)
  })

  it('fan of a hexagon in any order', () => {
    const hex = P([[0, 0], [4, 0], [6, 3], [4, 6], [0, 6], [-2, 3]])
    const fan: Diagonal[] = [[0, 2], [0, 3], [0, 4]]
    const base = key(splitByDiagonals(hex, fan))
    expect(base).toEqual(['0,1,2', '0,2,3', '0,3,4', '0,4,5'])
    expect(key(splitByDiagonals(hex, [[0, 4], [0, 2], [0, 3]]))).toEqual(base)
    expect(key(splitByDiagonals(hex, [[3, 0], [4, 0], [2, 0]]))).toEqual(base)
  })
})
