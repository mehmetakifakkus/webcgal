import type { Pt } from '../../types'
import { defaultOrder } from './minidisc'

const pts = (...c: [number, number][]): Pt[] => c.map(([x, y]) => ({ x, y }))

const circle: Pt[] = Array.from({ length: 8 }, (_, k) => ({
  x: 387 + 140 * Math.cos((k * Math.PI) / 4),
  y: 180 + 140 * Math.sin((k * Math.PI) / 4),
}))

// Spiral from the centre outwards: with order 0..9 nearly every point lands outside the disc.
const spiral: Pt[] = Array.from({ length: 10 }, (_, k) => {
  const r = 15 + 14 * k
  return { x: 387 + r * Math.cos(2.4 * k), y: 180 + r * Math.sin(2.4 * k) }
})

/** Preset inputs for a 775×360 canvas (y-up). `expected` is pinned from a run of `minidisc`. */
export const MINIDISC_PRESETS: {
  name: string
  points: Pt[]
  order: number[]
  expected: { boundary: number; radius: number; tests: number; updates: number }
}[] = [
  {
    name: 'Random example',
    points: pts([239, 209], [297, 115], [347, 245], [398, 166], [448, 94], [484, 216], [535, 151], [326, 173], [434, 245], [383, 108]),
    order: defaultOrder(10, 10),
    expected: { boundary: 2, radius: 150.8, tests: 17, updates: 4 },
  },
  {
    name: 'Two far points',
    points: pts([234, 180], [540, 180], [332, 161], [429, 206], [384, 174], [462, 154]),
    order: [2, 3, 4, 5, 0, 1],
    expected: { boundary: 2, radius: 153, tests: 21, updates: 6 },
  },
  {
    name: 'Acute triangle',
    points: pts([260, 250], [510, 240], [390, 40], [380, 160], [330, 190], [440, 180]),
    order: defaultOrder(6, 6),
    expected: { boundary: 3, radius: 140.8, tests: 18, updates: 11 },
  },
  {
    name: 'Points on a circle',
    points: circle,
    order: defaultOrder(8, 8),
    expected: { boundary: 2, radius: 140, tests: 10, updates: 3 },
  },
  {
    name: 'Bad order',
    points: spiral,
    order: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    expected: { boundary: 3, radius: 128.2, tests: 110, updates: 41 },
  },
  {
    name: 'Collinear',
    points: pts([228, 180], [293, 180], [390, 180], [468, 180], [546, 180]),
    order: [2, 1, 3, 0, 4],
    expected: { boundary: 2, radius: 159, tests: 16, updates: 7 },
  },
]
