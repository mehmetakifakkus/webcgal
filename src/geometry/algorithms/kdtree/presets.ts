import type { KdInput, Pt } from '../../types'

const pts = (...c: [number, number][]): Pt[] => c.map(([x, y]) => ({ x, y }))

const TEXTBOOK = pts(
  [60, 280], [110, 90], [150, 200], [200, 320], [240, 60],
  [280, 170], [330, 260], [370, 110], [410, 300], [430, 40],
)

const grid: Pt[] = [60, 140, 220, 300].flatMap((y) => [80, 180, 280, 380].map((x) => ({ x, y })))

const diagonal: Pt[] = Array.from({ length: 8 }, (_, k) => ({ x: 40 + 50 * k, y: 40 + 38 * k }))

/** Preset inputs for the 475×360 plane (y-up). `expected` is pinned from a run of `searchKdTree`. */
export const KD_PRESETS: {
  name: string
  input: KdInput
  expected: { reported: number[]; visited: number; inside: number; pruned: number; nodes: number; depth: number }
}[] = [
  {
    name: 'Textbook example',
    input: { points: TEXTBOOK, query: { x0: 130, y0: 100, x1: 370, y1: 280 } },
    expected: { reported: [2, 5, 6, 7], visited: 16, inside: 1, pruned: 2, nodes: 19, depth: 4 },
  },
  {
    name: 'Square grid 4×4',
    input: { points: grid, query: { x0: 150, y0: 100, x1: 330, y1: 260 } },
    expected: { reported: [5, 6, 9, 10], visited: 21, inside: 1, pruned: 5, nodes: 31, depth: 4 },
  },
  {
    name: 'Clusters',
    input: {
      points: pts(
        [80, 90], [100, 140], [120, 70], [140, 120], [90, 170], [150, 160], [130, 100],
        [340, 230], [360, 290], [390, 250], [410, 300], [350, 270], [400, 220], [380, 320],
      ),
      query: { x0: 60, y0: 50, x1: 170, y1: 190 },
    },
    expected: { reported: [0, 1, 2, 3, 4, 5, 6], visited: 17, inside: 1, pruned: 3, nodes: 27, depth: 4 },
  },
  {
    name: 'Points on a diagonal',
    input: { points: diagonal, query: { x0: 120, y0: 100, x1: 300, y1: 260 } },
    expected: { reported: [2, 3, 4, 5], visited: 11, inside: 0, pruned: 2, nodes: 15, depth: 3 },
  },
  {
    name: 'Query covers everything',
    input: { points: TEXTBOOK, query: { x0: 15, y0: 15, x1: 455, y1: 345 } },
    expected: { reported: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], visited: 1, inside: 2, pruned: 0, nodes: 19, depth: 4 },
  },
  {
    name: 'Empty query',
    input: { points: TEXTBOOK, query: { x0: 300, y0: 180, x1: 320, y1: 200 } },
    expected: { reported: [], visited: 4, inside: 0, pruned: 3, nodes: 19, depth: 4 },
  },
]
