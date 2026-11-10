import type { Pt } from '../../types'
import type { Box } from '../voronoi/clip'
import { copyView, kdNodeViews, label, plural, type KdNode, type KdTree } from './kdTree'
import type { KdPatch, KdRecorder, KdState } from './kdState'

export type KdSearchResult = {
  /** Point indices in R, ascending. */
  reported: number[]
  /** Number of SearchKdTree calls (root included). */
  visited: number
  /** Number of ReportSubtree calls. */
  inside: number
  /** Number of subtrees skipped because their region misses R. */
  pruned: number
}

type Relation = 'inside' | 'intersects' | 'disjoint'

/** Closed point-in-rectangle test. */
export const inRect = (p: Pt, R: Box) => p.x >= R.x0 && p.x <= R.x1 && p.y >= R.y0 && p.y <= R.y1

/** How the closed region `b` relates to the closed rectangle R. */
export function relate(b: Box, R: Box): Relation {
  if (b.x0 >= R.x0 && b.x1 <= R.x1 && b.y0 >= R.y0 && b.y1 <= R.y1) return 'inside'
  if (b.x0 <= R.x1 && R.x0 <= b.x1 && b.y0 <= R.y1 && R.y0 <= b.y1) return 'intersects'
  return 'disjoint'
}

function subtreePoints(v: KdNode, out: number[] = []): number[] {
  if (v.kind === 'leaf') out.push(v.point)
  else {
    subtreePoints(v.left, out)
    subtreePoints(v.right, out)
  }
  return out
}

const ascending = (a: number, b: number) => a - b

/**
 * SearchKdTree of de Berg et al. §5.2 on a tree from `buildKdTree(points)`: a leaf reports its
 * point if it lies in R; otherwise each child whose region lies in R is reported whole
 * (ReportSubtree), a child whose region intersects R is searched, and a child whose region
 * misses R is skipped. R and the regions are closed.
 *
 * `record` gets, per call: line 12 for a leaf (reported or outside R); for each child
 * line 14 / 18 (reported whole), 16 / 20 (descend) or 15 / 19 (skipped); and a final line 20 "Done".
 */
export function searchKdTree(points: Pt[], tree: KdTree, R: Box, record?: KdRecorder): KdSearchResult {
  const nodes = record ? kdNodeViews(tree) : []
  let phase: KdState['phase'] = 'query'
  const visited: number[] = []
  const reported: number[] = []
  const inside: number[] = []
  const pruned: number[] = []

  const emit = (line: number, description: string, patch: KdPatch = {}) => {
    if (!record) return
    record(line, description, patch, {
      phase,
      nodes: nodes.map(copyView),
      visited: [...visited],
      reported: [...reported],
      inside: [...inside],
      pruned: [...pruned],
      counts: { visited: visited.length, inside: inside.length, pruned: pruned.length },
    })
  }
  const report = (ids: number[]) => {
    reported.push(...ids)
    reported.sort(ascending)
  }

  /** Lines 13–16 (lc) or 17–20 (rc) for child `c` of `v`. */
  const child = (v: KdNode, c: KdNode, name: 'lc' | 'rc') => {
    const base = name === 'lc' ? 13 : 17
    const relation = relate(c.region, R)
    const test = { child: c.id, relation }
    if (relation === 'inside') {
      const pts = subtreePoints(c).sort(ascending)
      inside.push(c.id)
      report(pts)
      emit(base + 1, `region(${name}) lies in R → report its ${plural(pts.length, 'point')}`, {
        current: v.id,
        test,
        newlyReported: pts,
      })
    } else if (relation === 'intersects') {
      emit(base + 3, `region(${name}) intersects R → descend`, { current: v.id, test })
      search(c)
    } else {
      pruned.push(c.id)
      emit(base + 2, `region(${name}) is disjoint from R → skip`, { current: v.id, test })
    }
  }

  const search = (v: KdNode) => {
    visited.push(v.id)
    if (v.kind === 'leaf') {
      if (inRect(points[v.point], R)) {
        report([v.point])
        emit(12, `Leaf ${label(v.point)} lies in R → report`, { current: v.id, newlyReported: [v.point] })
      } else emit(12, `Leaf ${label(v.point)} lies outside R`, { current: v.id })
      return
    }
    child(v, v.left, 'lc')
    child(v, v.right, 'rc')
  }

  if (tree.root) search(tree.root)
  phase = 'done'
  emit(
    20,
    `Done: ${plural(reported.length, 'point')} reported, ${plural(visited.length, 'node')} visited, ` +
      `${plural(inside.length, 'subtree')} reported whole, ${plural(pruned.length, 'subtree')} skipped`,
  )
  return { reported: [...reported], visited: visited.length, inside: inside.length, pruned: pruned.length }
}
