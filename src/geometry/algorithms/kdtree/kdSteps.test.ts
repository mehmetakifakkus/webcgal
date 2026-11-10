import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../delaunay/delaunay'
import { randomPointSet } from '../delaunay/verify'
import type { KdInput } from '../../types'
import { KD_PRESETS } from './presets'
import { kdSteps } from './kdSteps'
import { PLANE_BOX, buildKdTree } from './kdTree'
import { KD_PSEUDOCODE, PSEUDOCODE_HEADINGS } from './pseudocode'
import { searchKdTree } from './search'

const randomInput = (seed: number, n: number): KdInput => {
  const rng = mulberry32(seed)
  const points = randomPointSet(rng, n, PLANE_BOX, 20)
  const xs = [15 + rng() * 440, 15 + rng() * 440].sort((a, b) => a - b)
  const ys = [15 + rng() * 330, 15 + rng() * 330].sort((a, b) => a - b)
  return { points, query: { x0: xs[0], y0: ys[0], x1: xs[1], y1: ys[1] } }
}

const inputs: { name: string; input: KdInput }[] = [
  ...KD_PRESETS.map((p) => ({ name: p.name, input: p.input })),
  ...Array.from({ length: 30 }, (_, s) => ({ name: `random ${s}`, input: randomInput(s + 1, 5 + (s % 20)) })),
]

describe('KD_PSEUDOCODE', () => {
  it('has the 21 lines of the spec and headings [0, 10]', () => {
    expect(KD_PSEUDOCODE).toEqual([
      'BuildKdTree(P, depth)',
      '    if P contains only one point',
      '        then return a leaf storing this point',
      '    else if depth is even',
      '        then split P with a vertical line ℓ through the median x-coordinate into P_1 (left of or on ℓ) and P_2 (right of ℓ)',
      '        else split P with a horizontal line ℓ through the median y-coordinate into P_1 (below or on ℓ) and P_2 (above ℓ)',
      '    v_left ← BuildKdTree(P_1, depth + 1)',
      '    v_right ← BuildKdTree(P_2, depth + 1)',
      '    create a node v storing ℓ, with v_left and v_right as its children',
      '    return v',
      'SearchKdTree(v, R)',
      '    if v is a leaf',
      '        then report the point stored at v if it lies in R',
      '    else if region(lc(v)) is fully contained in R',
      '        then ReportSubtree(lc(v))',
      '    else if region(lc(v)) intersects R',
      '        then SearchKdTree(lc(v), R)',
      '    if region(rc(v)) is fully contained in R',
      '        then ReportSubtree(rc(v))',
      '    else if region(rc(v)) intersects R',
      '        then SearchKdTree(rc(v), R)',
    ])
    expect(KD_PSEUDOCODE).toHaveLength(21)
    expect(PSEUDOCODE_HEADINGS).toEqual([0, 10])
  })
})

describe('kdSteps', () => {
  it('the last step matches searchKdTree', () => {
    for (const { name, input } of inputs) {
      const steps = kdSteps(input)
      const r = searchKdTree(input.points, buildKdTree(input.points), input.query)
      const last = steps[steps.length - 1]
      expect(last.state.phase, name).toBe('done')
      expect(last.state.reported, name).toEqual(r.reported)
      expect(last.state.counts, name).toEqual({ visited: r.visited, inside: r.inside, pruned: r.pruned })
      expect(last.line, name).toBe(20)
      expect(last.description, name).toBe(
        `Done: ${r.reported.length} point${r.reported.length === 1 ? '' : 's'} reported, ` +
          `${r.visited} node${r.visited === 1 ? '' : 's'} visited, ` +
          `${r.inside} subtree${r.inside === 1 ? '' : 's'} reported whole, ` +
          `${r.pruned} subtree${r.pruned === 1 ? '' : 's'} skipped`,
      )
    }
  })

  it('build mode ends with "kd-tree ready" and has no query step', () => {
    for (const { name, input } of inputs) {
      const steps = kdSteps(input, 'build')
      const last = steps[steps.length - 1]
      expect(last.line, name).toBe(9)
      expect(last.description, name).toMatch(/^kd-tree ready: \d+ nodes?, depth \d+$/)
      expect(steps.every((s) => s.state.phase === 'build' && s.line <= 9), name).toBe(true)
    }
  })

  it('query mode starts with the complete tree on line 9 and then only has lines 11–20', () => {
    for (const { name, input } of inputs) {
      const n = input.points.length
      const steps = kdSteps(input, 'query')
      expect(steps[0].line, name).toBe(9)
      expect(steps[0].description, name).toMatch(/^kd-tree ready: /)
      expect(steps[0].state.nodes, name).toHaveLength(2 * n - 1)
      for (const s of steps.slice(1)) {
        expect(s.line, name).toBeGreaterThanOrEqual(11)
        expect(s.line, name).toBeLessThanOrEqual(20)
        expect(s.state.nodes, name).toHaveLength(2 * n - 1)
      }
    }
  })

  it('full = build steps + query steps (minus the duplicated ready step)', () => {
    for (const { name, input } of inputs) {
      const full = kdSteps(input, 'full')
      const build = kdSteps(input, 'build')
      const query = kdSteps(input, 'query')
      expect(full, name).toEqual([...build, ...query.slice(1)])
      expect(full.length, name).toBe(build.length + query.length - 1)
    }
  })

  it('lines are valid and never a heading', () => {
    for (const { name, input } of inputs) {
      for (const mode of ['full', 'build', 'query'] as const) {
        for (const s of kdSteps(input, mode)) {
          expect(Number.isInteger(s.line), name).toBe(true)
          expect(s.line, name).toBeGreaterThanOrEqual(0)
          expect(s.line, name).toBeLessThan(KD_PSEUDOCODE.length)
          expect(PSEUDOCODE_HEADINGS, name).not.toContain(s.line)
        }
      }
    }
  })

  it('test is only set on lines 13–20', () => {
    for (const { name, input } of inputs) {
      for (const s of kdSteps(input)) {
        if (s.state.test) {
          expect(s.line, name).toBeGreaterThanOrEqual(13)
          expect(s.line, name).toBeLessThanOrEqual(20)
        }
      }
    }
  })

  it('newlyReported is only set on lines 12, 14 and 18', () => {
    for (const { name, input } of inputs) {
      for (const s of kdSteps(input)) {
        if (s.state.newlyReported) expect([12, 14, 18], name).toContain(s.line)
      }
    }
  })

  it('snapshots are independent', () => {
    const { input } = KD_PRESETS[0]
    const steps = kdSteps(input)
    const copy = structuredClone(steps)
    steps[steps.length - 1].state.reported.push(99)
    steps[steps.length - 1].state.nodes[0].region.x0 = -1
    steps[0].state.nodes.push(steps[steps.length - 1].state.nodes[0])
    expect(steps.slice(1, -1)).toEqual(copy.slice(1, -1))
    expect(kdSteps(input)).toEqual(copy)
  })

  it('without points there is a single done step', () => {
    for (const mode of ['full', 'build', 'query'] as const) {
      const steps = kdSteps({ points: [], query: { x0: 0, y0: 0, x1: 10, y1: 10 } }, mode)
      expect(steps).toHaveLength(1)
      expect(steps[0].state.phase).toBe('done')
    }
  })

  it('Query covers everything: visited 1 and both children reported whole', () => {
    const last = kdSteps(KD_PRESETS.find((p) => p.name === 'Query covers everything')!.input).at(-1)!
    expect(last.state.counts.visited).toBe(1)
    expect(last.state.counts.inside).toBe(2)
  })

  it('Empty query reports nothing', () => {
    const last = kdSteps(KD_PRESETS.find((p) => p.name === 'Empty query')!.input).at(-1)!
    expect(last.state.reported).toEqual([])
  })

  it('step counts stay bounded over 20 seeds', () => {
    let max16 = 0
    let max30 = 0
    for (let seed = 1; seed <= 20; seed++) {
      max16 = Math.max(max16, kdSteps(randomInput(seed, 16)).length)
      max30 = Math.max(max30, kdSteps(randomInput(seed, 30)).length)
    }
    expect(max16).toBeLessThanOrEqual(80)
    expect(max30).toBeLessThanOrEqual(150)
  })
})
