import type { Pt, RangeTreeInput } from '../../types'
import type { Box } from '../voronoi/clip'
import { randomPointSet } from '../delaunay/verify'
import { PLANE_BOX } from '../kdtree/kdTree'
import { KD_PRESETS } from '../kdtree/presets'
import { RT_PLANE } from './rangeTree'

const pts = (...c: [number, number][]): Pt[] => c.map(([x, y]) => ({ x, y }))

/** The affine map of the kd-tree page's plane box onto this page's plane area, rounded to integers. */
const fromKd = {
  x: (x: number) => Math.round(RT_PLANE.x0 + ((x - PLANE_BOX.x0) * (RT_PLANE.x1 - RT_PLANE.x0)) / (PLANE_BOX.x1 - PLANE_BOX.x0)),
  y: (y: number) => Math.round(RT_PLANE.y0 + ((y - PLANE_BOX.y0) * (RT_PLANE.y1 - RT_PLANE.y0)) / (PLANE_BOX.y1 - PLANE_BOX.y0)),
}
const KD_TEXTBOOK = KD_PRESETS[0].input
const TEXTBOOK = KD_TEXTBOOK.points.map((p) => ({ x: fromKd.x(p.x), y: fromKd.y(p.y) }))
const TEXTBOOK_QUERY: Box = {
  x0: fromKd.x(KD_TEXTBOOK.query.x0),
  y0: fromKd.y(KD_TEXTBOOK.query.y0),
  x1: fromKd.x(KD_TEXTBOOK.query.x1),
  y1: fromKd.y(KD_TEXTBOOK.query.y1),
}

const grid: Pt[] = [75, 185, 295, 405].flatMap((y) => [65, 145, 225, 305].map((x) => ({ x, y })))

const clusters = pts(
  [60, 90], [95, 70], [120, 115], [75, 150], [140, 80], [105, 175], [150, 145],
  [230, 330], [265, 300], [300, 345], [250, 390], [320, 410], [285, 435], [215, 420],
)

const strip = pts(
  [40, 300], [70, 120], [100, 420], [125, 220],
  [158, 60], [166, 390], [174, 170], [182, 300], [190, 440], [198, 110],
  [240, 250], [270, 380], [300, 90], [330, 200],
)

export type RTPreset = {
  name: string
  input: RangeTreeInput
  expected: { reported: number[]; canonical: number; assocQueries: number; nodes: number; storage: number; depth: number }
}

/** Preset inputs for the plane area 15–355 × 15–465 (y-up). `expected` is pinned from a run of `rangeQuery2D`. */
export const RT_PRESETS: RTPreset[] = [
  {
    name: 'Textbook example',
    input: { points: TEXTBOOK, query: TEXTBOOK_QUERY },
    expected: { reported: [2, 5, 6, 7], canonical: 2, assocQueries: 2, nodes: 19, storage: 44, depth: 4 },
  },
  {
    name: 'Square grid 4×4',
    input: { points: grid, query: { x0: 100, y0: 130, x1: 270, y1: 350 } },
    expected: { reported: [5, 6, 9, 10], canonical: 3, assocQueries: 3, nodes: 31, storage: 80, depth: 4 },
  },
  {
    name: 'Clusters',
    input: { points: clusters, query: { x0: 40, y0: 50, x1: 170, y1: 200 } },
    expected: { reported: [0, 1, 2, 3, 4, 5, 6], canonical: 3, assocQueries: 3, nodes: 27, storage: 68, depth: 4 },
  },
  {
    name: 'Thin vertical strip',
    input: { points: strip, query: { x0: 150, y0: 30, x1: 205, y1: 450 } },
    expected: { reported: [4, 5, 6, 7, 8, 9], canonical: 4, assocQueries: 4, nodes: 27, storage: 68, depth: 4 },
  },
  {
    name: 'Query covers everything',
    input: { points: TEXTBOOK, query: { ...RT_PLANE } },
    expected: { reported: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], canonical: 5, assocQueries: 5, nodes: 19, storage: 44, depth: 4 },
  },
  {
    name: 'Empty query',
    // the slab holds p3…p8, but no point of it lies between y = 285 and 335
    input: { points: TEXTBOOK, query: { x0: 100, y0: 285, x1: 300, y1: 335 } },
    expected: { reported: [], canonical: 2, assocQueries: 2, nodes: 19, storage: 44, depth: 4 },
  },
]

/**
 * 8–16 integer points in the plane area (margin 15, at least about 18.6 apart after rounding)
 * and an integer rectangle covering 20–40% of the plane area.
 */
export function randomRangeTreeInput(random: () => number = Math.random): RangeTreeInput {
  const B = RT_PLANE
  const n = 8 + Math.floor(random() * 9)
  const points = randomPointSet(random, n, { x0: B.x0 + 15, y0: B.y0 + 15, x1: B.x1 - 15, y1: B.y1 - 15 }, 20).map((p) => ({
    x: Math.round(p.x),
    y: Math.round(p.y),
  }))
  const W = B.x1 - B.x0
  const H = B.y1 - B.y0
  const area = (0.2 + random() * 0.2) * W * H
  const aspect = 0.5 + random() * 1.0 // width / height; keeps w ≤ W and h ≤ H for these areas
  const w = Math.min(W, Math.sqrt(area * aspect))
  const h = Math.min(H, area / w)
  const x0 = Math.round(B.x0 + random() * (W - w))
  const y0 = Math.round(B.y0 + random() * (H - h))
  return { points, query: { x0, y0, x1: Math.min(B.x1, Math.round(x0 + w)), y1: Math.min(B.y1, Math.round(y0 + h)) } }
}
