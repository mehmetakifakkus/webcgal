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
    points: pts([180, 250], [260, 120], [330, 300], [400, 190], [470, 90], [520, 260], [590, 170], [300, 200], [450, 300], [380, 110]),
    order: defaultOrder(10, 10),
    expected: { boundary: 2, radius: 208.9, tests: 17, updates: 4 },
  },
  {
    name: 'Two far points',
    points: pts([150, 180], [620, 180], [300, 150], [450, 220], [380, 170], [500, 140]),
    order: [2, 3, 4, 5, 0, 1],
    expected: { boundary: 2, radius: 235, tests: 21, updates: 6 },
  },
  {
    name: 'Acute triangle',
    points: pts([260, 290], [510, 280], [390, 80], [380, 200], [330, 230], [440, 220]),
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
    points: pts([150, 180], [250, 180], [400, 180], [520, 180], [640, 180]),
    order: [2, 1, 3, 0, 4],
    expected: { boundary: 2, radius: 245, tests: 16, updates: 7 },
  },
]
