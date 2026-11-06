import { EPS } from '../primitives'
import type { Pt } from '../types'

const RAD = Math.PI / 180

/**
 * Is `polygon` monotone with respect to the line L at `angleDeg`
 * (counter-clockwise from +x)? Every line perpendicular to L must meet the
 * polygon in a connected set; equivalently, the cyclic sequence of vertex
 * projections onto L has exactly one local maximum and one local minimum.
 * Equal consecutive projections (plateaus) are merged first. Vertex order
 * (cw or ccw) is irrelevant.
 */
export function isMonotone(polygon: Pt[], angleDeg: number): boolean {
  const ux = Math.cos(angleDeg * RAD)
  const uy = Math.sin(angleDeg * RAD)
  const vals: number[] = []
  for (const q of polygon) {
    const v = q.x * ux + q.y * uy
    if (vals.length === 0 || Math.abs(v - vals[vals.length - 1]) > EPS) vals.push(v)
  }
  while (vals.length > 1 && Math.abs(vals[vals.length - 1] - vals[0]) <= EPS) vals.pop()
  const m = vals.length
  if (m < 3) return true
  let maxima = 0
  let minima = 0
  for (let i = 0; i < m; i++) {
    const prev = vals[(i + m - 1) % m]
    const next = vals[(i + 1) % m]
    if (vals[i] > prev && vals[i] > next) maxima++
    else if (vals[i] < prev && vals[i] < next) minima++
  }
  return maxima === 1 && minima === 1
}

/**
 * Angle ranges (degrees, within [0, 180], sorted) for which `polygon` is
 * monotone. Critical angles are the directions perpendicular to the edges
 * (plus 0). The midpoint of each open interval between consecutive critical
 * angles is tested, as is each critical angle itself. A critical angle joins
 * two adjacent valid intervals only if the polygon is monotone at that exact
 * angle; a valid critical angle with no valid neighbouring interval is
 * returned as an isolated `[a, a]`. Range endpoints are the critical angles
 * bounding the valid intervals, so a boundary where monotonicity fails
 * exactly at the edge direction is reported as the range end but is not
 * itself part of a merged run. 180 is the same line as 0 and is not merged
 * across.
 */
export function monotoneDirections(polygon: Pt[]): Array<[number, number]> {
  const n = polygon.length
  const raw: number[] = [0]
  for (let i = 0; i < n; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % n]
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.hypot(dx, dy) <= EPS) continue
    let ang = (Math.atan2(dy, dx) / RAD + 90) % 180
    if (ang < 0) ang += 180
    if (180 - ang < 1e-9) ang = 0
    raw.push(ang)
  }
  raw.sort((x, y) => x - y)
  const crit: number[] = []
  for (const a of raw) if (crit.length === 0 || a - crit[crit.length - 1] > 1e-9) crit.push(a)

  const k = crit.length
  const intervalOk: boolean[] = []
  const critOk: boolean[] = []
  for (let i = 0; i < k; i++) {
    const end = i + 1 < k ? crit[i + 1] : 180
    intervalOk.push(isMonotone(polygon, (crit[i] + end) / 2))
    critOk.push(isMonotone(polygon, crit[i]))
  }

  const result: Array<[number, number]> = []
  let start: number | null = null
  for (let i = 0; i < k; i++) {
    const end = i + 1 < k ? crit[i + 1] : 180
    if (intervalOk[i]) {
      if (start === null) start = crit[i]
      // continue the run across the next critical angle only if it is valid too
      const mergeNext = i + 1 < k && critOk[i + 1] && intervalOk[i + 1]
      if (!mergeNext) {
        result.push([start, end])
        start = null
      }
    } else if (critOk[i] && !(i > 0 && intervalOk[i - 1])) {
      result.push([crit[i], crit[i]])
    }
  }
  return result
}
