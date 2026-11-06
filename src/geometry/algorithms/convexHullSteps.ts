import { orientation } from '../primitives'
import type { Step } from '../steps'
import type { Pt } from '../types'

export type HullState = {
  /** Distinct points sorted by x, then y (p1…pn). */
  sorted: Pt[]
  upper: Pt[]
  lower: Pt[]
  current?: Pt
  testing?: [Pt, Pt, Pt]
  removed?: Pt
  phase: 'sort' | 'upper' | 'lower' | 'done'
}

export const CONVEX_HULL_PSEUDOCODE: string[] = [
  'Sort the points by x-coordinate, resulting in p1, …, pn',
  'Put p1 and p2 in L_upper',
  'for i ← 3 to n',
  '    Append pi to L_upper',
  '    while L_upper has > 2 points and the last three do not make a right turn',
  '        Delete the middle of the last three points from L_upper',
  'Put pn and pn−1 in L_lower',
  'for i ← n − 2 downto 1',
  '    Append pi to L_lower',
  '    while L_lower has > 2 points and the last three do not make a right turn',
  '        Delete the middle of the last three points from L_lower',
  'Remove the first and last point from L_lower',
  'Append L_lower to L_upper; return L_upper',
]

/**
 * Records every step of Andrew's monotone chain. Uses the same predicate as
 * `convexHull` (pop while `orientation(...) >= 0`), so the result is identical.
 *
 * The final `phase: "done"` step carries the untrimmed `upper` and `lower`
 * chains; the hull is `[...upper, ...lower.slice(1, -1)]` and equals
 * `convexHull(points)`. With fewer than 3 distinct points, `upper` holds them
 * as-is and `lower` is empty. Each step owns deep copies of its data.
 */
export function convexHullSteps(points: Pt[]): Step<HullState>[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const pts = sorted.filter((q, i) => i === 0 || q.x !== sorted[i - 1].x || q.y !== sorted[i - 1].y)
  const n = pts.length
  const steps: Step<HullState>[] = []

  // Working chains hold 1-based indices into `pts`.
  let upper: number[] = []
  let lower: number[] = []
  const at = (i: number) => pts[i - 1]
  const names = (idx: number[]) => idx.map((i) => `p${i}`).join(', ')

  const push = (description: string, line: number, phase: HullState['phase'], extra: Partial<HullState> = {}) => {
    const state: HullState = {
      sorted: pts,
      upper: upper.map(at),
      lower: lower.map(at),
      phase,
      ...extra,
    }
    steps.push({ description, line, state: structuredClone(state) })
  }

  push(`Sort the points by x-coordinate (${n} distinct point${n === 1 ? '' : 's'})`, 0, 'sort')

  if (n < 3) {
    upper = pts.map((_, i) => i + 1)
    push(
      n === 0 ? 'No points: the hull is empty' : `Only ${n} point${n === 1 ? '' : 's'}: the hull is ${names(upper)}`,
      12,
      'done',
    )
    return steps
  }

  const build = (
    seq: number[],
    chain: () => number[],
    phase: 'upper' | 'lower',
    lines: { append: number; test: number; del: number },
    label: string,
  ) => {
    for (const i of seq) {
      chain().push(i)
      push(`Append p${i} to ${label}`, lines.append, phase, { current: at(i) })
      for (;;) {
        const c = chain()
        if (c.length <= 2) break
        const [a, b, d] = c.slice(-3)
        const turn = orientation(at(a), at(b), at(d))
        const notRight = turn >= 0
        const name = turn > 0 ? 'left turn' : turn < 0 ? 'right turn' : 'straight line'
        push(
          `p${a}, p${b}, p${d} make a ${turn === 0 ? 'straight line' : name}: ${notRight ? `delete p${b}` : `keep p${b}`}`,
          lines.test,
          phase,
          { current: at(i), testing: [at(a), at(b), at(d)] },
        )
        if (!notRight) break
        c.splice(c.length - 2, 1)
        push(`Delete p${b} from ${label}`, lines.del, phase, { current: at(i), removed: at(b) })
      }
    }
  }

  upper = [1, 2]
  push('Put p1 and p2 in L_upper', 1, 'upper')
  build(range(3, n), () => upper, 'upper', { append: 3, test: 4, del: 5 }, 'L_upper')

  lower = [n, n - 1]
  push(`Put p${n} and p${n - 1} in L_lower`, 6, 'lower')
  build(range(n - 2, 1), () => lower, 'lower', { append: 8, test: 9, del: 10 }, 'L_lower')

  push('Remove the first and last point from L_lower', 11, 'lower')
  push('Append L_lower to L_upper: the hull is complete', 12, 'done')
  return steps
}

/** Inclusive integer range, ascending or descending. */
function range(from: number, to: number): number[] {
  const out: number[] = []
  const stepBy = from <= to ? 1 : -1
  for (let i = from; stepBy > 0 ? i <= to : i >= to; i += stepBy) out.push(i)
  return out
}
