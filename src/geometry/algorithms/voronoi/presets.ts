import type { Pt } from '../../types'
import { DELAUNAY_PRESETS } from '../delaunay/presets'

const named = (name: string): Pt[] => {
  const p = DELAUNAY_PRESETS.find((d) => d.name === name)
  if (!p) throw new Error(`voronoi presets: unknown Delaunay preset ${name}`)
  return p.points
}

const collinear: Pt[] = [150, 300, 450, 600, 700].map((x) => ({ x, y: 100 }))

/** Preset inputs for a 775×360 canvas (y-up). `expected` is pinned from a run of `voronoi` (edges include rays). */
export const VORONOI_PRESETS: {
  name: string
  points: Pt[]
  expected: { vertices: number; edges: number; cells: number; unbounded: number; lines: number }
}[] = [
  { name: 'Textbook example', points: named('Textbook example'), expected: { vertices: 9, edges: 17, cells: 9, unbounded: 7, lines: 0 } },
  { name: 'Square grid 4×4', points: named('Square grid 4×4'), expected: { vertices: 9, edges: 24, cells: 16, unbounded: 12, lines: 0 } },
  { name: 'Points on a circle', points: named('Points on a circle'), expected: { vertices: 1, edges: 8, cells: 8, unbounded: 8, lines: 0 } },
  { name: 'Two clusters', points: named('Two clusters'), expected: { vertices: 15, edges: 26, cells: 12, unbounded: 7, lines: 0 } },
  { name: 'Collinear plus one', points: named('Collinear plus one'), expected: { vertices: 3, edges: 7, cells: 5, unbounded: 5, lines: 0 } },
  { name: 'Collinear', points: collinear, expected: { vertices: 0, edges: 0, cells: 5, unbounded: 5, lines: 4 } },
]
