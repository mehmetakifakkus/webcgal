import { describe, expect, it } from 'vitest'
import type { Step } from '../../steps'
import type { Pt, RangeTreeInput } from '../../types'
import { mulberry32 } from '../delaunay/delaunay'
import { bruteForceRange } from '../kdtree/verify'
import { RT_PRESETS, randomRangeTreeInput } from './presets'
import { PSEUDOCODE_HEADINGS, RT_LINE, RT_PSEUDOCODE } from './pseudocode'
import { rangeTree } from './rangeTree'
import type { RTState } from './rtState'
import { rtSteps } from './rtSteps'
import { oneDRangeQuery, rangeQuery2D } from './search'

const P = (xs: [number, number][]): Pt[] => xs.map(([x, y]) => ({ x, y }))
const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`
const num = (s: string) => Number(s)

/** n points on a 4×4 lattice: heavy ties in x and y, and duplicates. */
function latticeInput(seed: number, n: number): RangeTreeInput {
  const rng = mulberry32(seed)
  const c = () => 60 + 80 * Math.floor(rng() * 4)
  const points = Array.from({ length: n }, () => ({ x: c(), y: c() }))
  const [a, b, d, e] = [c(), c(), c(), c()]
  return { points, query: { x0: Math.min(a, b), x1: Math.max(a, b), y0: Math.min(d, e), y1: Math.max(d, e) } }
}

const inputs: { name: string; input: RangeTreeInput }[] = [
  ...RT_PRESETS.map((p) => ({ name: p.name, input: p.input })),
  ...Array.from({ length: 30 }, (_, s) => ({ name: `random ${s}`, input: randomRangeTreeInput(mulberry32(s + 1)) })),
  ...Array.from({ length: 20 }, (_, s) => ({ name: `lattice ${s}`, input: latticeInput(100 + s, 1 + (s % 16)) })),
  { name: 'two points', input: { points: P([[100, 100], [200, 300]]), query: { x0: 50, y0: 50, x1: 150, y1: 400 } } },
  { name: 'zero width', input: { points: P([[100, 100], [100, 200], [150, 150], [200, 300]]), query: { x0: 100, y0: 0, x1: 100, y1: 250 } } },
  { name: 'zero height', input: { points: P([[100, 100], [100, 200], [150, 200], [200, 300]]), query: { x0: 0, y0: 200, x1: 400, y1: 200 } } },
  { name: 'outside', input: { points: P([[100, 100], [100, 200], [150, 200], [200, 300]]), query: { x0: 250, y0: 0, x1: 300, y1: 400 } } },
  { name: 'coincident', input: { points: P([[100, 100], [100, 100], [100, 100]]), query: { x0: 100, y0: 100, x1: 100, y1: 100 } } },
]

const ASSOC = /^1DRangeQuery\(T_assoc\(([vp]\d+)\), \[(\S+) : (\S+)\]\): reports (nothing|p\d+(?:, p\d+)*)$/
const LO_QUERY = /^(v\d+): x = (\S+) ≤ (\S+), the right subtree ([vp]\d+) lies in the slab → query its associated tree$/
const LO_RIGHT = /^(v\d+): x = (\S+) > (\S+), go right$/
const HI_QUERY = /^(v\d+): x′ = (\S+) ≥ (\S+), the left subtree ([vp]\d+) lies in the slab → query its associated tree$/
const HI_LEFT = /^(v\d+): x′ = (\S+) < (\S+), go left$/
const LEAF = /^Leaf (p\d+): (inside the rectangle, reported|outside)$/

const stripMode = (steps: Step<RTState>[]) => steps.map((s) => ({ ...s, state: { ...s.state, mode: 'full' } }))

describe('RT_PSEUDOCODE', () => {
  it('has the two blocks of spec §3.1 with headings at PSEUDOCODE_HEADINGS', () => {
    expect(RT_PSEUDOCODE).toEqual([
      'Build2DRangeTree(P)',
      '    build a binary search tree T_assoc on the y-coordinates of the points in P',
      '    if P contains only one point then create a leaf v storing this point',
      '    else split P at x_mid, the median x-coordinate, into P_left (x ≤ x_mid) and P_right (x > x_mid)',
      '        v_left ← Build2DRangeTree(P_left); v_right ← Build2DRangeTree(P_right)',
      '        create a node v storing x_mid, with v_left and v_right as its children',
      '    make T_assoc the associated structure of v',
      '    return v',
      '2DRangeQuery(T, [x : x′] × [y : y′])',
      '    v_split ← FindSplitNode(T, x, x′)',
      '    if v_split is a leaf',
      '        then check if the point stored at v_split must be reported',
      '        else v ← lc(v_split)',
      '            while v is not a leaf',
      '                do if x ≤ x_v',
      '                    then T′ ← T_assoc(rc(v))',
      '                        1DRangeQuery(T′, [y : y′])',
      '                        v ← lc(v)',
      '                    else v ← rc(v)',
      '            check if the point stored at v must be reported',
      '            v ← rc(v_split)',
      '            while v is not a leaf',
      '                do if x′ ≥ x_v',
      '                    then T′ ← T_assoc(lc(v))',
      '                        1DRangeQuery(T′, [y : y′])',
      '                        v ← rc(v)',
      '                    else v ← lc(v)',
      '            check if the point stored at v must be reported',
    ])
    expect(PSEUDOCODE_HEADINGS).toEqual([0, 8])
    for (const h of PSEUDOCODE_HEADINGS) expect(RT_PSEUDOCODE[h]).not.toMatch(/^ /)
    expect(RT_PSEUDOCODE.filter((l) => !l.startsWith(' '))).toHaveLength(2)
  })
})

describe('rtSteps: build', () => {
  it('has one step per main node in pre-order, 2n − 1 in all', () => {
    for (const { name, input } of inputs) {
      const n = input.points.length
      const tree = rangeTree(input.points)
      const steps = rtSteps(input, 'build')
      expect(steps, name).toHaveLength(2 * n - 1)
      let storage = 0
      steps.forEach((s, k) => {
        const v = tree.nodes[k]
        storage += v.assoc.size
        expect(s.state.phase, name).toBe('build')
        expect(s.state.mode, name).toBe('build')
        expect(s.state.current, name).toBe(k)
        expect(s.state.assocShown, name).toBe(k)
        expect(s.state.assocPaths, name).toBeNull()
        expect(s.state.builtUpTo, name).toBe(k + 1)
        expect(s.state.nodes, name).toHaveLength(2 * n - 1)
        expect(s.state.counts.nodes, name).toBe(k + 1)
        expect(s.state.counts.storage, name).toBe(storage)
        expect(s.state.counts.assocQueries, name).toBe(0)
        if (v.kind === 'leaf') {
          expect(s.line, name).toBe(2)
          expect(s.description, name).toMatch(new RegExp(`^Leaf ${v.label}: associated tree with 1 leaf`))
        } else {
          const l = v.left!.points.length
          const r = v.right!.points.length
          expect(s.line, name).toBe(3)
          expect(s.description, name).toMatch(
            new RegExp(
              `^Node ${v.label}: ${v.points.length} points, associated tree on y with ${v.points.length} leaves; ` +
                `split at x = \\S+ \\(${l} left, ${r} right\\)`,
            ),
          )
        }
      })
      if (n) {
        const last = steps[steps.length - 1]
        expect(last.description, name).toMatch(
          new RegExp(` · main tree ${plural(2 * n - 1, 'node')}, associated trees ${plural(tree.storage, 'leaf').replace('leafs', 'leaves')}$`),
        )
        expect(last.state.counts, name).toEqual({ nodes: 2 * n - 1, storage: tree.storage, depth: tree.depth, assocQueries: 0 })
        expect(steps.slice(0, -1).every((s) => !s.description.includes(' · main tree ')), name).toBe(true)
      }
    }
  })

  it('pins the Textbook build descriptions', () => {
    const steps = rtSteps(RT_PRESETS[0].input, 'build')
    expect(steps.slice(0, 4).map((s) => s.description)).toEqual([
      'Node v1: 10 points, associated tree on y with 10 leaves; split at x = 189 (5 left, 5 right)',
      'Node v2: 5 points, associated tree on y with 5 leaves; split at x = 119 (3 left, 2 right)',
      'Node v3: 3 points, associated tree on y with 3 leaves; split at x = 88 (2 left, 1 right)',
      'Node v4: 2 points, associated tree on y with 2 leaves; split at x = 50 (1 left, 1 right)',
    ])
    expect(steps[4].description).toBe('Leaf p1: associated tree with 1 leaf')
    expect(steps.at(-1)!.description).toBe('Leaf p10: associated tree with 1 leaf · main tree 19 nodes, associated trees 44 leaves')
  })

  it('names ties at the split', () => {
    const steps = rtSteps({ points: P([[100, 300], [100, 100], [100, 200], [200, 100]]), query: { x0: 0, y0: 0, x1: 1, y1: 1 } }, 'build')
    expect(steps[0].description).toBe(
      'Node v1: 4 points, associated tree on y with 4 leaves; split at x = 100 (2 left, 2 right) — ties broken by y',
    )
    const same = rtSteps({ points: P([[100, 100], [100, 100]]), query: { x0: 0, y0: 0, x1: 1, y1: 1 } }, 'build')
    expect(same[0].description).toBe(
      'Node v1: 2 points, associated tree on y with 2 leaves; split at x = 100 (1 left, 1 right) — coincident points ordered by number',
    )
  })
})

describe('rtSteps: modes', () => {
  it('full = build steps followed by query steps, exactly', () => {
    for (const { name, input } of inputs) {
      const full = rtSteps(input, 'full')
      const build = rtSteps(input, 'build')
      const query = rtSteps(input, 'query')
      expect(stripMode(full), name).toEqual(stripMode([...build, ...query]))
      expect(full.every((s) => s.state.mode === 'full'), name).toBe(true)
      expect(query.every((s) => s.state.mode === 'query'), name).toBe(true)
      expect(rtSteps(input), name).toEqual(full)
    }
  })

  it('query mode starts from the built tree and has no build step', () => {
    for (const { name, input } of inputs) {
      const n = input.points.length
      for (const s of rtSteps(input, 'query')) {
        expect(s.state.phase, name).toBe('query')
        expect(s.state.builtUpTo, name).toBe(2 * n - 1)
        expect(s.state.nodes, name).toHaveLength(2 * n - 1)
        expect(s.line, name).toBeGreaterThan(8)
      }
    }
  })
})

describe('rtSteps: query', () => {
  it('follows rangeQuery2D: split first, path decisions, associated queries, end leaves, done', () => {
    let ties = 0
    for (const { name, input } of inputs) {
      const { points, query: R } = input
      const tree = rangeTree(points)
      const q = rangeQuery2D(points, tree, R)
      const steps = rtSteps(input, 'query')
      const label = (id: number) => tree.nodes[id].label
      const last = steps[steps.length - 1]

      if (q.split !== null) {
        expect(steps[0].line, name).toBe(9)
        expect(steps[0].state.current, name).toBe(q.split)
        expect(steps[0].state.split, name).toBe(q.split)
        expect(steps[0].description, name).toMatch(/^Split node /)
        const toSplit = q.pathLo.slice(0, q.pathLo.indexOf(q.split) + 1)
        expect(steps[0].state.pathLo, name).toEqual(toSplit)
        expect(steps[0].state.pathHi, name).toEqual(toSplit)
      }

      const assoc = steps.filter((s) => s.line === 16 || s.line === 24)
      expect(assoc, name).toHaveLength(q.assocQueries.length)
      assoc.forEach((s, k) => {
        const a = q.assocQueries[k]
        const m = ASSOC.exec(s.description)
        expect(m, `${name}: ${s.description}`).not.toBeNull()
        expect(m![1], name).toBe(label(a.node))
        expect(num(m![2]), name).toBeCloseTo(R.y0, 2)
        expect(num(m![3]), name).toBeCloseTo(R.y1, 2)
        expect(m![4], name).toBe(a.result.length ? a.result.map((i) => `p${i + 1}`).join(', ') : 'nothing')
        expect(s.state.assocShown, name).toBe(a.node)
        expect(s.state.assocPaths, name).toEqual({ node: a.node, ...oneDRangeQuery(points, tree.nodes[a.node].assoc, R.y0, R.y1) })
        expect(s.state.counts.assocQueries, name).toBe(k + 1)
      })

      // path decisions state the comparison the code makes, and the numbers agree with it
      for (const s of steps) {
        const lq = LO_QUERY.exec(s.description)
        const lr = LO_RIGHT.exec(s.description)
        const hq = HI_QUERY.exec(s.description)
        const hl = HI_LEFT.exec(s.description)
        if (lq) {
          expect(s.line, name).toBe(14)
          expect(R.x0 <= tree.nodes[s.state.current!].value!, name).toBe(true)
          expect(lq[4], name).toBe(label(tree.nodes[s.state.current!].right!.id))
          expect(s.state.canonical.at(-1), name).toBe(tree.nodes[s.state.current!].right!.id)
          if (R.x0 === tree.nodes[s.state.current!].value) ties++
        } else if (lr) {
          expect(s.line, name).toBe(18)
          expect(R.x0 > tree.nodes[s.state.current!].value!, name).toBe(true)
        } else if (hq) {
          expect(s.line, name).toBe(22)
          expect(R.x1 >= tree.nodes[s.state.current!].value!, name).toBe(true)
          expect(hq[4], name).toBe(label(tree.nodes[s.state.current!].left!.id))
          if (R.x1 === tree.nodes[s.state.current!].value) ties++
        } else if (hl) {
          expect(s.line, name).toBe(26)
          expect(R.x1 < tree.nodes[s.state.current!].value!, name).toBe(true)
        } else if (LEAF.test(s.description)) {
          expect([11, 19, 27], name).toContain(s.line)
        } else {
          expect(s === steps[0] || s === last || ASSOC.test(s.description), `${name}: ${s.description}`).toBe(true)
        }
      }
      const decisions = steps.filter((s) => [14, 18, 22, 26].includes(s.line))
      const below = q.pathLo.slice(q.pathLo.indexOf(q.split!) + 1, -1).length + q.pathHi.slice(q.pathHi.indexOf(q.split!) + 1, -1).length
      expect(decisions, name).toHaveLength(q.split === null ? 0 : below)
      const leaves = steps.filter((s) => LEAF.test(s.description))
      expect(leaves.map((s) => s.state.current).map((id) => tree.nodes[id!].point), name).toEqual(q.checkedLeaves)

      // Done repeats the line of the last end-leaf check: 11 after a split leaf, 27 otherwise
      const splitLeaf = q.split !== null && tree.nodes[q.split].kind === 'leaf'
      expect(last.line, name).toBe(splitLeaf ? RT_LINE.splitLeaf : RT_LINE.hiLeaf)
      if (steps.length > 1) expect(last.line, name).toBe(steps[steps.length - 2].line)
      expect(last.state.current, name).toBeNull()
      expect(last.description, name).toBe(`Done: ${plural(q.reported.length, 'point')} reported, ${plural(q.assocQueries.length, 'associated query').replace('querys', 'queries')}`)
      expect(last.state.reported, name).toEqual(q.reported)
      expect(last.state.reported, name).toEqual(bruteForceRange(points, R))
      expect(last.state.canonical, name).toEqual(q.canonical)
      expect(last.state.checked, name).toEqual(q.checkedLeaves)
      expect(last.state.pathLo, name).toEqual(q.pathLo)
      expect(last.state.pathHi, name).toEqual(q.pathHi)
      expect(last.state.split, name).toBe(q.split)
      expect(last.state.counts, name).toEqual({ nodes: Math.max(0, 2 * points.length - 1), storage: tree.storage, depth: tree.depth, assocQueries: q.assocQueries.length })
    }
    expect(ties).toBeGreaterThan(0)
  })

  it('pins the Textbook query steps', () => {
    const steps = rtSteps(RT_PRESETS[0].input, 'query')
    expect(steps.map((s) => [s.line, s.description])).toEqual(TEXTBOOK_QUERY)
  })

  it('a split leaf is checked directly', () => {
    const steps = rtSteps({ points: P([[100, 100], [200, 300]]), query: { x0: 150, y0: 0, x1: 250, y1: 400 } }, 'query')
    expect(steps.map((s) => [s.line, s.description])).toEqual([
      [9, 'Split node is the leaf p2'],
      [11, 'Leaf p2: inside the rectangle, reported'],
      [11, 'Done: 1 point reported, 0 associated queries'],
    ])
    expect(steps[0].state.pathLo).toEqual([0, 2])
    expect(steps[2].state.checked).toEqual([1])
  })

  it('shows an associated tree only on the steps about it', () => {
    const about: number[] = [RT_LINE.loQuery, RT_LINE.loAssoc, RT_LINE.hiQuery, RT_LINE.hiAssoc]
    let shown = 0
    for (const { name, input } of inputs) {
      for (const s of rtSteps(input, 'query')) {
        if (about.includes(s.line)) {
          shown++
          // the right child on the path to x, the left child on the path to x′
          const [left, right] = s.state.nodes.filter((c) => c.parent === s.state.current).map((c) => c.id)
          const lo = s.line === RT_LINE.loQuery || s.line === RT_LINE.loAssoc
          expect(s.state.assocShown, name).toBe(lo ? right : left)
          expect(s.state.assocShown, name).toBe(s.state.canonical.at(-1))
          if (s.line === RT_LINE.loQuery || s.line === RT_LINE.hiQuery) expect(s.state.assocPaths, name).toBeNull()
          else expect(s.state.assocPaths?.node, name).toBe(s.state.assocShown)
        } else {
          expect(s.state.assocShown, `${name}: ${s.description}`).toBeNull()
          expect(s.state.assocPaths, `${name}: ${s.description}`).toBeNull()
        }
      }
    }
    expect(shown).toBeGreaterThan(0)
  })

  it('x = x′: the split node is where x meets the split value', () => {
    const points = P([[100, 100], [100, 200], [150, 150], [200, 300], [250, 120]])
    const steps = rtSteps({ points, query: { x0: 100, y0: 150, x1: 100, y1: 250 } }, 'query')
    expect(steps.map((s) => [s.line, s.description])).toEqual([
      [9, 'Split node v2: x = x′ = 100 meets its split value 100, so the path to x goes left and the path to x′ right'],
      [14, 'v3: x = 100 ≤ 100, the right subtree p2 lies in the slab → query its associated tree'],
      [16, '1DRangeQuery(T_assoc(p2), [150 : 250]): reports p2'],
      [19, 'Leaf p1: outside'],
      [27, 'Leaf p3: outside'],
      [27, 'Done: 1 point reported, 1 associated query'],
    ])
    // x = x′ off every split value parts the paths nowhere: the split node is a leaf
    const off = rtSteps({ points, query: { x0: 120, y0: 0, x1: 120, y1: 400 } }, 'query')
    expect(off.map((s) => s.description)).toEqual(['Split node is the leaf p3', 'Leaf p3: outside', 'Done: 0 points reported, 0 associated queries'])
  })

  it('reports singular counts', () => {
    const steps = rtSteps({ points: P([[100, 100], [200, 300], [300, 200]]), query: { x0: 50, y0: 50, x1: 250, y1: 150 } }, 'query')
    expect(steps.at(-1)!.description).toBe('Done: 1 point reported, 1 associated query')
  })
})

describe('rtSteps: degenerate input', () => {
  it('n = 0: no build step and a single done step', () => {
    const input = { points: [], query: { x0: 0, y0: 0, x1: 10, y1: 10 } }
    expect(rtSteps(input, 'build')).toEqual([])
    for (const mode of ['full', 'query'] as const) {
      const steps = rtSteps(input, mode)
      expect(steps).toHaveLength(1)
      expect(steps[0].description).toBe('Done: 0 points reported, 0 associated queries')
      expect(steps[0].line).toBe(27)
      expect(steps[0].state).toMatchObject({ phase: 'query', mode, nodes: [], split: null, builtUpTo: 0, reported: [] })
      expect(steps[0].state.counts).toEqual({ nodes: 0, storage: 0, depth: 0, assocQueries: 0 })
    }
  })

  it('n = 1', () => {
    const input = { points: P([[100, 200]]), query: { x0: 50, y0: 50, x1: 150, y1: 250 } }
    expect(rtSteps(input).map((s) => [s.line, s.description])).toEqual([
      [2, 'Leaf p1: associated tree with 1 leaf · main tree 1 node, associated trees 1 leaf'],
      [9, 'Split node is the leaf p1'],
      [11, 'Leaf p1: inside the rectangle, reported'],
      [11, 'Done: 1 point reported, 0 associated queries'],
    ])
    const out = rtSteps({ ...input, query: { x0: 150, y0: 50, x1: 250, y1: 250 } }, 'query')
    expect(out[1].description).toBe('Leaf p1: outside')
    expect(out[2].description).toBe('Done: 0 points reported, 0 associated queries')
  })

  it('a zero-width rectangle, a rectangle outside all points and an inverted one', () => {
    const points = P([[100, 100], [100, 200], [150, 150], [200, 300], [250, 120]])
    const zero = rtSteps({ points, query: { x0: 100, y0: 150, x1: 100, y1: 250 } }, 'query')
    expect(zero.at(-1)!.description).toBe('Done: 1 point reported, 1 associated query')
    expect(zero.at(-1)!.state.reported).toEqual([1])
    const outside = rtSteps({ points, query: { x0: 300, y0: 0, x1: 340, y1: 400 } }, 'query')
    expect(outside.at(-1)!.description).toMatch(/^Done: 0 points reported, /)
    const inverted = rtSteps({ points, query: { x0: 300, y0: 0, x1: 100, y1: 400 } }, 'query')
    expect(inverted.map((s) => s.description)).toEqual(['Done: 0 points reported, 0 associated queries'])
  })
})

describe('rtSteps: general', () => {
  it('lines are valid and never a heading', () => {
    for (const { name, input } of inputs) {
      for (const mode of ['full', 'build', 'query'] as const) {
        for (const s of rtSteps(input, mode)) {
          expect(Number.isInteger(s.line), name).toBe(true)
          expect(s.line, name).toBeGreaterThanOrEqual(0)
          expect(s.line, name).toBeLessThan(RT_PSEUDOCODE.length)
          expect(PSEUDOCODE_HEADINGS, name).not.toContain(s.line)
        }
      }
    }
  })

  it('reported stays ascending and only grows; canonical, checked and the paths only grow', () => {
    for (const { name, input } of inputs) {
      const steps = rtSteps(input, 'query')
      for (let k = 1; k < steps.length; k++) {
        const [a, b] = [steps[k - 1].state, steps[k].state]
        expect(b.reported, name).toEqual([...b.reported].sort((x, y) => x - y))
        for (const key of ['reported', 'canonical', 'checked', 'pathLo', 'pathHi'] as const)
          expect(b[key].length, name).toBeGreaterThanOrEqual(a[key].length)
        expect(b.canonical.slice(0, a.canonical.length), name).toEqual(a.canonical)
      }
    }
  })

  it('snapshots are independent', () => {
    const { input } = RT_PRESETS[0]
    const steps = rtSteps(input)
    const copy = structuredClone(steps)
    const last = steps[steps.length - 1].state
    last.reported.push(99)
    last.nodes[0].points.push(99)
    last.points[0].x = -1
    last.query.x0 = -1
    last.assocPaths?.pathLo.push(99)
    steps[0].state.canonical.push(99)
    expect(steps.slice(1, -1)).toEqual(copy.slice(1, -1))
    expect(rtSteps(input)).toEqual(copy)
    expect(input.points[0].x).not.toBe(-1)
  })
})

// Pinned from a run and checked by hand: v6 = x(p8) = 289 = x′ shows the tie x′ ≥ x_v (the hi path reports v7).
const TEXTBOOK_QUERY: [number, string][] = [
  [9, 'Split node v1: x = 104 and x′ = 289 go different ways (x ≤ 189 ≤ x′)'],
  [14, 'v2: x = 104 ≤ 119, the right subtree v5 lies in the slab → query its associated tree'],
  [16, '1DRangeQuery(T_assoc(v5), [131 : 376]): reports nothing'],
  [18, 'v3: x = 104 > 88, go right'],
  [19, 'Leaf p3: inside the rectangle, reported'],
  [22, 'v6: x′ = 289 ≥ 289, the left subtree v7 lies in the slab → query its associated tree'],
  [24, '1DRangeQuery(T_assoc(v7), [131 : 376]): reports p6, p7, p8'],
  [26, 'v9: x′ = 289 < 320, go left'],
  [27, 'Leaf p9: outside'],
  [27, 'Done: 4 points reported, 2 associated queries'],
]
