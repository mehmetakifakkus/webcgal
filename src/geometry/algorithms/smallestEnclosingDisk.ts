import type { Circle, Pt } from '../types'
import { minidisc } from './minidisc/minidisc'

// The circle helpers live with the MiniDisc core; re-exported here for the existing API.
export { circleFrom2, circumcircle } from './minidisc/minidisc'

/**
 * Randomized incremental smallest enclosing disk (de Berg et al., MiniDisc, section 4.7).
 * `random` draws the single permutation that all three procedures use; the input is not
 * mutated. An empty set gives the zero circle at the origin.
 */
export function smallestEnclosingDisk(points: Pt[], random: () => number = Math.random): Circle {
  const perm = points.map((_, i) => i)
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  return minidisc(points, perm).disk ?? { center: { x: 0, y: 0 }, radius: 0 }
}
