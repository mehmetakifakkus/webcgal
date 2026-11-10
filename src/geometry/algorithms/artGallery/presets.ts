import type { Pt } from '../../types'
import { TRIANGULATION_PRESETS } from '../triangulation/presets'

const poly = (...c: [number, number][]): Pt[] => c.map(([x, y]) => ({ x, y }))

/**
 * Preset rooms for a 775×360 canvas (y-up, CCW, ≥ 15 margin). `expected.cameras` is the
 * size of Fisk's camera set, `n` the vertex count.
 */
export const GALLERY_PRESETS: { name: string; polygon: Pt[]; expected: { cameras: number; n: number } }[] = [
  {
    // Four tall, narrow teeth on a thin base strip: a tooth tip is seen only from vertices of
    // its own tooth, so four teeth need four cameras (no three vertices cover the room).
    name: 'Comb',
    polygon: poly(
      [40, 20], [735, 20], [700, 345], [660, 110], [600, 110], [560, 345],
      [500, 110], [440, 110], [400, 345], [340, 110], [280, 110], [240, 345],
    ),
    expected: { cameras: 4, n: 12 },
  },
  {
    name: 'Textbook polygon',
    polygon: TRIANGULATION_PRESETS.find((p) => p.name === 'Textbook polygon')!.polygon.map((p) => ({ ...p })),
    expected: { cameras: 4, n: 14 },
  },
  {
    name: 'Convex room',
    polygon: Array.from({ length: 9 }, (_, i) => {
      const a = (2 * Math.PI * i) / 9
      return { x: 387 + 140 * Math.cos(a), y: 180 + 140 * Math.sin(a) }
    }),
    expected: { cameras: 3, n: 9 },
  },
  {
    name: 'L-shaped gallery',
    polygon: poly([100, 40], [700, 40], [700, 160], [300, 160], [300, 320], [100, 320]),
    expected: { cameras: 2, n: 6 },
  },
  {
    name: 'Star',
    polygon: poly(
      [387, 330], [351, 230], [244, 226], [328, 161], [299, 59],
      [387, 118], [475, 59], [446, 161], [530, 226], [423, 230],
    ),
    expected: { cameras: 3, n: 10 },
  },
  {
    // A rectangular corridor (36 wide, walls 54 thick) winding inwards.
    name: 'Spiral corridor',
    polygon: poly(
      [50, 32], [743, 32], [743, 328], [122, 328], [122, 122], [653, 122], [653, 243], [230, 243],
      [230, 207], [617, 207], [617, 158], [158, 158], [158, 292], [707, 292], [707, 68], [50, 68],
    ),
    expected: { cameras: 4, n: 16 },
  },
]
