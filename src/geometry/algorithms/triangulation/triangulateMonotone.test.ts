import { describe, expect, it } from 'vitest'
import type { Diagonal, Polygon } from '../../types'
import { triangulateMonotone } from './triangulateMonotone'
import type { TriPatch, TriRecorderContext } from './triangulationState'
import { isValidTriangulation } from './verify'

const P = (pts: Array<[number, number]>): Polygon => pts.map(([x, y]) => ({ x, y }))
const alreadyMonotone = P([[150, 100], [620, 80], [700, 200], [600, 330], [200, 310], [100, 200]])
const sameY = P([[200, 80], [580, 80], [640, 200], [560, 300], [400, 300], [240, 300], [160, 200]])
const triangle = P([[200, 80], [580, 80], [390, 320]])
const all = (poly: Polygon) => poly.map((_, i) => i)

describe('triangulateMonotone', () => {
  it('already monotone hexagon: 3 valid diagonals', () => {
    const d = triangulateMonotone(alreadyMonotone, all(alreadyMonotone))
    expect(d.length).toBe(3)
    expect(isValidTriangulation(alreadyMonotone, d)).toEqual({ ok: true })
  })

  it('same-y vertices: 4 valid diagonals', () => {
    const d = triangulateMonotone(sameY, all(sameY))
    expect(d.length).toBe(4)
    expect(isValidTriangulation(sameY, d)).toEqual({ ok: true })
  })

  it('triangle: no diagonals', () => {
    expect(triangulateMonotone(triangle, all(triangle))).toEqual([])
  })

  it('works on a rotated sub-piece of a polygon', () => {
    // piece starting at a non-top vertex; diagonals use polygon indices
    const piece = [3, 4, 5, 0, 1, 2]
    const d = triangulateMonotone(alreadyMonotone, piece)
    expect(isValidTriangulation(alreadyMonotone, d)).toEqual({ ok: true })
    for (const [a, b] of d) expect(a < b).toBe(true)
  })

  it('collinear consecutive vertices: diagonals never run along the boundary', () => {
    const poly = P([[0, 0], [2, 0], [4, 0], [4, 4], [0, 4]])
    const d = triangulateMonotone(poly, all(poly))
    expect(isValidTriangulation(poly, d)).toEqual({ ok: true })
  })

  it('records lines 30–40 with merged order, chains, stack and reported diagonals', () => {
    const steps: { line: number; description: string; patch: TriPatch; ctx: TriRecorderContext }[] = []
    const d = triangulateMonotone(sameY, all(sameY), (line, description, patch, ctx) =>
      steps.push({ line, description, patch: structuredClone(patch), ctx: structuredClone(ctx) }),
    )
    // lexicographic: (240,300) v6, (400,300) v5, (560,300) v4, (160,200) v7, (640,200) v3, (200,80) v1, (580,80) v2
    expect(steps[0]).toMatchObject({
      line: 30,
      description: 'Merge the chains: u1 = v6, u2 = v5, u3 = v4, u4 = v7, u5 = v3, u6 = v1, u7 = v2',
    })
    expect(steps[0].ctx.merged).toEqual([5, 4, 3, 6, 2, 0, 1])
    // top v6 → CCW → v7 v1 v2 (bottom) is the left chain; v5 v4 v3 the right chain
    expect(steps[0].ctx.chain).toEqual(['left', 'right', 'right', 'left', 'right', 'left', 'left'])
    expect(steps[1]).toMatchObject({ line: 31, description: 'Push u1 = v6 and u2 = v5 onto S' })
    expect(steps[1].ctx.stack).toEqual([5, 4])
    for (const s of steps) {
      expect(s.line).toBeGreaterThanOrEqual(30)
      expect(s.line).toBeLessThanOrEqual(40)
      expect([32, 36]).not.toContain(s.line)
      expect(s.ctx.phase).toBe('triangulate')
    }
    expect(steps[2].description).toBe('u3 = v4 and the top of the stack are on the same chain')
    expect(steps[2].patch.cursor).toBe(3)
    expect(steps.some((s) => /^u\d+ = v\d+ and the top of the stack are on different chains$/.test(s.description))).toBe(true)
    const reported = steps.filter((s) => s.patch.reported).map((s) => s.patch.reported as Diagonal)
    expect(reported).toEqual(d)
    for (const s of steps.filter((s) => s.patch.reported)) {
      expect([34, 38, 40]).toContain(s.line)
      expect(s.description).toMatch(/^(Pop v\d+; add|Add) diagonal u\d+–v\d+$/)
      expect(s.ctx.triangulationDiagonals).toContainEqual(s.patch.reported)
    }
    expect(steps[steps.length - 1].line).toBe(40)
  })

  it('triangle records the merge, the stack and an empty last step', () => {
    const lines: number[] = []
    triangulateMonotone(triangle, all(triangle), (line) => lines.push(line))
    expect(lines).toEqual([30, 31, 40])
  })
})
