import type { Pt } from '../geometry/types'
import { toPt } from './drawing'
import { isPointInput } from './segments'

const describe = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)

/**
 * Validates user input (`fn` names the API function in the message) and converts it:
 * an array of TextPoints (e.g. from `Points.createRandom`), paper Points, `{x, y}` or `[x, y]`.
 */
export function toPoints(input: unknown, fn: string): Pt[] {
  const prefix = `${fn}: expected an array of points`
  if (!Array.isArray(input)) throw new Error(`${prefix} (got ${describe(input)})`)
  return input.map((p: unknown, i) => {
    if (!isPointInput(p)) throw new Error(`${prefix} (item ${i + 1} is not a point)`)
    return toPt(p)
  })
}
