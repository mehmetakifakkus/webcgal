import type { Pt } from './types'

export const EPS = 1e-9

export function subtract(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function dot(u: Pt, v: Pt): number {
  return u.x * v.x + u.y * v.y
}

export function crossVec(u: Pt, v: Pt): number {
  return u.x * v.y - u.y * v.x
}

export function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** (a - o) x (b - o). Positive when o -> a -> b turns left (y axis points up). */
export function cross(o: Pt, a: Pt, b: Pt): number {
  return crossVec(subtract(a, o), subtract(b, o))
}

export function orientation(o: Pt, a: Pt, b: Pt): -1 | 0 | 1 {
  const c = cross(o, a, b)
  if (c > EPS) return 1
  if (c < -EPS) return -1
  return 0
}
