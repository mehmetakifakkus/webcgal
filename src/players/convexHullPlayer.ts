import { CONVEX_HULL_PSEUDOCODE, convexHullSteps, type HullState } from '../geometry/algorithms/convexHullSteps'
import type { Pt } from '../geometry/types'
import type { PlayerModule } from './types'

export const WIDTH = 775
export const HEIGHT = 360
const POINT_COUNT = 10
const RADIUS = 6

const cssColor = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** `count` random points inside the canvas, keeping a 10% margin. */
export function randomPoints(count = POINT_COUNT, width = WIDTH, height = HEIGHT): Pt[] {
  const mx = width * 0.1
  const my = height * 0.1
  return Array.from({ length: count }, () => ({
    x: mx + Math.random() * (width - 2 * mx),
    y: my + Math.random() * (height - 2 * my),
  }))
}

const convexHullPlayer: PlayerModule<HullState> = {
  computeSteps: convexHullSteps,
  pseudocode: CONVEX_HULL_PSEUDOCODE,
  initialPoints: () => randomPoints(),
  render(scene, step, points) {
    const P = scene.paper
    P.activate()
    scene.clear()
    const s = step.state
    const colors = {
      current: cssColor('--hull-current', '#e66100'),
      testing: cssColor('--hull-testing', '#9141ac'),
      upper: cssColor('--hull-upper', '#1a5fb4'),
      lower: cssColor('--hull-lower', '#26a269'),
      removed: cssColor('--hull-removed', '#c01c28'),
      point: cssColor('--canvas-ink', '#1c1e21'),
    }
    const pt = (q: Pt) => new P.Point(q.x, q.y)
    const chain = (list: Pt[], color: string, width: number, closed = false) => {
      if (list.length < 2) return
      new P.Path({ segments: list.map(pt), strokeColor: color, strokeWidth: width, strokeCap: 'round', strokeJoin: 'round', closed })
    }

    if (s.phase === 'done') {
      const hull = [...s.upper, ...s.lower.slice(1, -1)]
      if (hull.length >= 3)
        new P.Path({
          segments: hull.map(pt),
          closed: true,
          fillColor: new P.Color(colors.upper),
          strokeColor: colors.upper,
          strokeWidth: 2,
          opacity: 1,
          strokeJoin: 'round',
        }).fillColor!.alpha = 0.12
      else chain(hull, colors.upper, 2)
    } else {
      chain(s.upper, colors.upper, 2)
      chain(s.lower, colors.lower, 2)
    }

    if (s.testing) chain(s.testing, colors.testing, 4)

    const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y
    for (const q of points) {
      const idx = s.sorted.findIndex((r) => same(r, q))
      let fill = colors.point
      if (s.current && same(s.current, q)) fill = colors.current
      else if (s.testing?.some((t) => same(t, q))) fill = colors.testing
      new P.Path.Circle({ center: pt(q), radius: RADIUS, fillColor: fill, strokeColor: colors.point, strokeWidth: 1 })
      if (idx >= 0)
        // the layer is y-flipped: flip the label back so that it reads upright
        new P.PointText({
          matrix: new P.Matrix(1, 0, 0, -1, q.x + 8, q.y + 14),
          content: `p${idx + 1}`,
          fontSize: 14,
          fillColor: colors.point,
        })
    }

    if (s.removed) {
      const { x, y } = s.removed
      const d = RADIUS + 3
      new P.Path({ segments: [new P.Point(x - d, y - d), new P.Point(x + d, y + d)], strokeColor: colors.removed, strokeWidth: 3 })
      new P.Path({ segments: [new P.Point(x - d, y + d), new P.Point(x + d, y - d)], strokeColor: colors.removed, strokeWidth: 3 })
    }
  },
}

export default convexHullPlayer
