import type { Segment } from '../../types'

const s = (ax: number, ay: number, bx: number, by: number): Segment => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})

/** Preset inputs for a 775×360 canvas (y-up). */
export const SWEEP_PRESETS: {
  name: string
  segments: Segment[]
  expected: { points: number; overlaps: number }
}[] = [
  {
    name: 'Three segments through one point',
    segments: [s(200, 60, 574, 300), s(200, 300, 574, 60), s(387, 40, 387, 320)],
    expected: { points: 1, overlaps: 0 },
  },
  {
    name: 'Vertical and horizontal segments',
    segments: [
      s(150, 180, 620, 180),
      s(300, 60, 300, 300),
      s(500, 60, 500, 300),
      s(150, 60, 620, 300),
    ],
    expected: { points: 5, overlaps: 0 },
  },
  {
    name: 'Shared endpoint',
    segments: [
      s(200, 80, 400, 280),
      s(400, 280, 600, 80),
      s(400, 280, 400, 60),
      s(250, 200, 550, 200),
    ],
    expected: { points: 4, overlaps: 0 },
  },
  {
    name: 'Endpoint on a segment',
    segments: [s(150, 100, 650, 260), s(400, 180, 300, 320), s(550, 300, 550, 100)],
    expected: { points: 2, overlaps: 0 },
  },
  {
    name: 'Overlapping segments',
    segments: [s(150, 120, 450, 240), s(300, 180, 600, 300), s(350, 80, 350, 300)],
    expected: { points: 3, overlaps: 1 },
  },
  {
    name: 'Grid of six segments',
    segments: [
      s(120, 100, 655, 120),
      s(120, 180, 655, 200),
      s(120, 260, 655, 280),
      s(250, 40, 270, 320),
      s(390, 40, 400, 320),
      s(520, 40, 530, 320),
    ],
    expected: { points: 9, overlaps: 0 },
  },
]
