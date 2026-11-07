import type { Pt } from '../../types'
import { defaultOrder } from './delaunay'
import { highestIndex } from './symbolic'

const pts = (...c: [number, number][]): Pt[] => c.map(([x, y]) => ({ x, y }))

const grid: Pt[] = []
for (const y of [60, 140, 220, 300]) for (const x of [160, 320, 480, 640]) grid.push({ x, y })

const circle: Pt[] = Array.from({ length: 8 }, (_, k) => ({
  x: 387 + 130 * Math.cos((k * Math.PI) / 4),
  y: 180 + 130 * Math.sin((k * Math.PI) / 4),
}))

const clusters = pts(
  [150, 120], [210, 80], [240, 160], [170, 200], [120, 250], [260, 230],
  [560, 120], [620, 80], [650, 160], [580, 200], [530, 250], [670, 230],
)

/** Preset inputs for a 775×360 canvas (y-up). `order` excludes p₀; `flips` is pinned from a run of `delaunay`. */
export const DELAUNAY_PRESETS: {
  name: string
  points: Pt[]
  order: number[]
  expected: { triangles: number; flips: number }
}[] = [
  {
    name: 'Textbook example',
    points: pts([120, 300], [300, 320], [520, 290], [680, 230], [600, 80], [380, 50], [160, 90], [330, 180], [500, 170]),
    order: [7, 4, 0, 8, 2, 6, 3, 5],
    expected: { triangles: 9, flips: 9 },
  },
  {
    name: 'Square grid 4×4',
    points: grid,
    order: defaultOrder(16, 15, 16),
    expected: { triangles: 18, flips: 14 },
  },
  {
    name: 'Points on a circle',
    points: circle,
    order: [5, 0, 7, 3, 1, 6, 4],
    expected: { triangles: 6, flips: 1 },
  },
  {
    name: 'Two clusters',
    points: clusters,
    order: defaultOrder(12, highestIndex(clusters), 12),
    expected: { triangles: 15, flips: 10 },
  },
  {
    name: 'Collinear plus one',
    points: pts([150, 100], [300, 100], [450, 100], [600, 100], [380, 280]),
    order: [0, 3, 1, 2],
    expected: { triangles: 3, flips: 0 },
  },
]
