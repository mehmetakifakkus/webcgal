import type { Polygon, VertexType } from '../../types'

const poly = (...c: [number, number][]): Polygon => c.map(([x, y]) => ({ x, y }))

/** Preset inputs for a 775×360 canvas (y-up, CCW). */
export const TRIANGULATION_PRESETS: {
  name: string
  polygon: Polygon
  expected: { types: Record<VertexType, number>; partitionDiagonals: number; triangles: number }
}[] = [
  {
    name: 'Textbook polygon',
    polygon: poly(
      [120, 310], [80, 180], [150, 60], [260, 150], [360, 40], [470, 160], [580, 50],
      [700, 190], [660, 320], [560, 220], [470, 330], [370, 230], [280, 320], [200, 230],
    ),
    expected: { types: { start: 4, end: 3, split: 2, merge: 3, regular: 2 }, partitionDiagonals: 5, triangles: 12 },
  },
  {
    name: 'Already monotone',
    polygon: poly([150, 100], [620, 80], [700, 200], [600, 330], [200, 310], [100, 200]),
    expected: { types: { start: 1, end: 1, split: 0, merge: 0, regular: 4 }, partitionDiagonals: 0, triangles: 4 },
  },
  {
    name: 'Comb',
    polygon: poly(
      [100, 60], [700, 60], [700, 320], [640, 140], [560, 320], [500, 140],
      [420, 320], [360, 140], [280, 320], [220, 140], [160, 320],
    ),
    expected: { types: { start: 5, end: 1, split: 0, merge: 4, regular: 1 }, partitionDiagonals: 4, triangles: 9 },
  },
  {
    name: 'Same-y vertices',
    polygon: poly([200, 80], [580, 80], [640, 200], [560, 300], [400, 300], [240, 300], [160, 200]),
    expected: { types: { start: 1, end: 1, split: 0, merge: 0, regular: 5 }, partitionDiagonals: 0, triangles: 5 },
  },
  {
    name: 'Triangle',
    polygon: poly([200, 80], [580, 80], [390, 320]),
    expected: { types: { start: 1, end: 1, split: 0, merge: 0, regular: 1 }, partitionDiagonals: 0, triangles: 1 },
  },
]
