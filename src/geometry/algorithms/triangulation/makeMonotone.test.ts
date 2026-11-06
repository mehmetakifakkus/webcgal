import { describe, expect, it } from 'vitest'
import type { Polygon, VertexType } from '../../types'
import { isMonotone } from '../monotone'
import { makeMonotone } from './makeMonotone'
import { splitByDiagonals } from './split'
import type { TriRecorderContext } from './triangulationState'
import { isSimple } from './polygon'
import { diagonalInside, diagonalsCross, randomStarPolygon } from './verify'

const P = (pts: Array<[number, number]>): Polygon => pts.map(([x, y]) => ({ x, y }))
const textbook = P([
  [120, 310], [80, 180], [150, 60], [260, 150], [360, 40], [470, 160], [580, 50],
  [700, 190], [660, 320], [560, 220], [470, 330], [370, 230], [280, 320], [200, 230],
])
const alreadyMonotone = P([[150, 100], [620, 80], [700, 200], [600, 330], [200, 310], [100, 200]])
const comb = P([
  [100, 60], [700, 60], [700, 320], [640, 140], [560, 320], [500, 140], [420, 320],
  [360, 140], [280, 320], [220, 140], [160, 320],
])
const sameY = P([[200, 80], [580, 80], [640, 200], [560, 300], [400, 300], [240, 300], [160, 200]])

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function checkPartition(poly: Polygon, label: string) {
  const { diagonals } = makeMonotone(poly)
  const n = poly.length
  const keys = new Set<string>()
  for (const d of diagonals) {
    expect(d[0] < d[1], `${label} ${d} ordered`).toBe(true)
    expect(diagonalInside(poly, d), `${label} ${d} inside`).toBe(true)
    expect((d[0] + 1) % n === d[1] || (d[1] + 1) % n === d[0], `${label} ${d} not an edge`).toBe(false)
    keys.add(d.join(','))
  }
  expect(keys.size, `${label} no duplicates`).toBe(diagonals.length)
  for (let a = 0; a < diagonals.length; a++)
    for (let b = a + 1; b < diagonals.length; b++)
      expect(diagonalsCross(poly, diagonals[a], diagonals[b]), `${label} ${diagonals[a]} x ${diagonals[b]}`).toBe(false)
  const pieces = splitByDiagonals(poly, diagonals)
  expect(pieces.length).toBe(diagonals.length + 1)
  for (const piece of pieces)
    expect(isMonotone(piece.map((i) => poly[i]), 90), `${label} piece ${piece}`).toBe(true)
  return diagonals
}

describe('makeMonotone', () => {
  it('textbook polygon: types and 5 diagonals', () => {
    const expected: Record<VertexType, number[]> = {
      start: [1, 9, 11, 13],
      end: [3, 5, 7],
      split: [4, 6],
      merge: [10, 12, 14],
      regular: [2, 8],
    }
    const { types, diagonals } = makeMonotone(textbook)
    for (const [t, vs] of Object.entries(expected))
      for (const v of vs) expect(types[v - 1], `v${v}`).toBe(t)
    expect(diagonals.length).toBe(5)
    for (const d of diagonals) expect(diagonalInside(textbook, d), `${d}`).toBe(true)
    checkPartition(textbook, 'textbook')
  })

  it('already monotone hexagon: no diagonals', () => {
    expect(makeMonotone(alreadyMonotone).diagonals).toEqual([])
  })

  it('comb: 4 diagonals', () => {
    expect(checkPartition(comb, 'comb').length).toBe(4)
  })

  it('same-y vertices: no diagonals', () => {
    expect(makeMonotone(sameY).diagonals).toEqual([])
  })

  it('collinear consecutive vertices are regular and need no diagonal', () => {
    const poly = P([[0, 0], [2, 0], [4, 0], [4, 4], [0, 4]])
    const { types, diagonals } = makeMonotone(poly)
    expect(diagonals).toEqual([])
    expect(types.filter((t) => t === 'split' || t === 'merge')).toEqual([])
  })

  it('random star polygons: valid diagonals and monotone pieces', () => {
    const rng = mulberry32(20261106)
    for (let k = 0; k < 200; k++) {
      const n = 5 + Math.floor(rng() * 16)
      const poly = randomStarPolygon(rng, n, 400, 300, 60, 260)
      checkPartition(poly, `random #${k} n=${n}`)
    }
  })

  it('grid-snapped polygons (equal y, horizontal edges)', () => {
    const rng = mulberry32(7)
    let tested = 0
    for (let k = 0; k < 400; k++) {
      const n = 5 + Math.floor(rng() * 12)
      const poly = randomStarPolygon(rng, n, 400, 300, 60, 260).map((q) => ({
        x: Math.round(q.x / 40) * 40,
        y: Math.round(q.y / 40) * 40,
      }))
      if (!isSimple(poly)) continue
      tested++
      checkPartition(poly, `grid #${k} n=${n}`)
    }
    expect(tested).toBeGreaterThan(100)
  })

  it('records lines and descriptions', () => {
    const steps: { line: number; description: string; edgeLeft?: number; reported?: [number, number]; ctx: TriRecorderContext }[] = []
    const { diagonals } = makeMonotone(textbook, (line, description, patch, ctx) =>
      steps.push({ line, description, edgeLeft: patch.edgeLeft, reported: patch.reported, ctx: structuredClone(ctx) }),
    )
    expect(steps[0].line).toBe(1)
    expect(steps[1].line).toBe(2)
    expect(steps.filter((s) => s.line === 4).length).toBe(14)
    expect(steps[2].description).toBe('Next vertex v11 (start)')
    expect(steps[3].description).toBe('v11 is a start vertex → HandleStartVertex')
    expect(steps[4]).toMatchObject({ line: 7, description: 'Insert e11 into T with helper v11' })
    expect(steps[4].ctx.status).toEqual([{ edge: 10, helper: 10 }])
    const reported = steps.filter((s) => s.reported).map((s) => s.reported)
    expect(reported).toEqual(diagonals)
    for (const s of steps.filter((s) => s.reported))
      expect([9, 13, 16, 19, 23, 27]).toContain(s.line)
    for (const s of steps.filter((s) => s.edgeLeft !== undefined)) {
      expect([12, 18, 26]).toContain(s.line)
      expect(s.description).toMatch(/^Edge directly left of v\d+: e\d+$/)
    }
    expect(steps.some((s) => /^Interior of P lies to the right of v2$/.test(s.description))).toBe(true)
    expect(steps.some((s) => /^Interior of P lies to the left of v8$/.test(s.description))).toBe(true)
    expect(steps.some((s) => /is not a merge vertex$/.test(s.description))).toBe(true)
    expect(steps.some((s) => /^Set helper\(e\d+\) = v\d+$/.test(s.description))).toBe(true)
    expect(steps.some((s) => /^Delete e\d+ from T$/.test(s.description))).toBe(true)
    const last = steps[steps.length - 1]
    expect(last.ctx.status).toEqual([])
    expect(last.ctx.queue).toEqual([])
    expect(last.ctx.partitionDiagonals).toEqual(diagonals)
  })
})
