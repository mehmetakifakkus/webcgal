import type { Pt, VoronoiCell, VoronoiEdge, VoronoiLine, VoronoiResult } from '../../types'
import { circumcenter, crossVec, distance, dot, subtract } from '../../primitives'
import { delaunay } from '../delaunay/delaunay'
import type { VoronoiState, VorPatch, VorRecorder } from './voronoiState'

/** Site label, the same format as in the Delaunay module. */
export const label = (i: number) => `v${i + 1}`
/** Voronoi vertex label. */
export const vertexLabel = (k: number) => `u${k + 1}`

const edgeLabel = (i: number, j: number) => `${label(i)}–${label(j)}`
const fmt = (p: Pt) => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`

/** Diagonal of the bounding box of the points, at least 1. */
export function diagonal(points: Pt[]): number {
  if (points.length === 0) return 1
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of points) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return Math.max(1, Math.hypot(x1 - x0, y1 - y0))
}

/** Circumcenters closer than this share one Voronoi vertex. */
export const mergeTol = (points: Pt[]) => 1e-6 * diagonal(points)

const unit = (v: Pt): Pt => {
  const l = Math.hypot(v.x, v.y)
  return { x: v.x / l, y: v.y / l }
}
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
/** Unit normal of the segment a b (rotated a quarter turn counter-clockwise). */
const normal = (a: Pt, b: Pt): Pt => unit({ x: a.y - b.y, y: b.x - a.x })

const copyEdge = (e: VoronoiEdge): VoronoiEdge =>
  e.dir ? { sites: [...e.sites], a: e.a, b: e.b, dir: { ...e.dir } } : { sites: [...e.sites], a: e.a, b: e.b }
const copyLine = (l: VoronoiLine): VoronoiLine => ({ sites: [...l.sites], p: { ...l.p }, dir: { ...l.dir } })
const copyCell = (c: VoronoiCell): VoronoiCell =>
  c.rays ? { site: c.site, vertices: [...c.vertices], rays: [...c.rays] } : { site: c.site, vertices: [...c.vertices] }

/**
 * Cell of `site` from its incident edges (indices into `edges`): the vertices sorted
 * counter-clockwise around the site, each once. An unbounded cell starts at the vertex of
 * its entering ray (walked inwards, the site on its left) and ends at the vertex of its
 * leaving ray.
 */
function buildCell(points: Pt[], vertices: Pt[], edges: VoronoiEdge[], site: number, incident: number[]): VoronoiCell {
  const s = points[site]
  const ids = new Set<number>()
  for (const k of incident) {
    ids.add(edges[k].a)
    const b = edges[k].b
    if (b !== null) ids.add(b)
  }
  const angle = (v: number) => Math.atan2(vertices[v].y - s.y, vertices[v].x - s.x)
  const sorted = [...ids].sort((u, v) => angle(u) - angle(v))
  const rays = incident.filter((k) => edges[k].b === null)
  if (rays.length === 0) return { site, vertices: sorted }
  if (rays.length !== 2) throw new Error(`voronoi: the cell of ${label(site)} has ${rays.length} rays`)
  // leaving ray: traversed along dir with the site on the left
  const leaves = (k: number) => crossVec(edges[k].dir!, subtract(s, vertices[edges[k].a])) > 0
  const [entry, exit] = leaves(rays[0]) ? [rays[1], rays[0]] : [rays[0], rays[1]]
  const start = sorted.indexOf(edges[entry].a)
  return { site, vertices: [...sorted.slice(start), ...sorted.slice(0, start)], rays: [entry, exit] }
}

/**
 * Voronoi diagram as the dual of the Delaunay triangulation (de Berg et al. §7, §9.5, spec
 * §2.2): circumcenters become vertices (merged within `mergeTol`), shared Delaunay edges become
 * edges (skipped when both triangles share a vertex), hull edges become outward rays. Collinear
 * input gives the bisectors of consecutive points as `lines`. `order` is passed to `delaunay`.
 */
export function voronoi(points: Pt[], record?: VorRecorder, order?: number[]): VoronoiResult {
  const n = points.length
  const { triangles, edges: delaunayEdges } = delaunay(points, order)
  const vertices: Pt[] = []
  const vertexOfTriangle: (number | null)[] = triangles.map(() => null)
  const edges: VoronoiEdge[] = []
  const lines: VoronoiLine[] = []
  const cells: VoronoiCell[] = []
  let phase: VoronoiState['phase'] = 'delaunay'

  const emit = (line: number, description: string, patch: VorPatch = {}) => {
    if (!record) return
    record(line, description, patch, {
      phase,
      triangles,
      delaunayEdges,
      vertices: vertices.map((p) => ({ ...p })),
      vertexOfTriangle: [...vertexOfTriangle],
      edges: edges.map(copyEdge),
      lines: lines.map(copyLine),
      cells: cells.map(copyCell),
    })
  }

  if (triangles.length === 0) {
    if (n >= 2) {
      emit(1, 'Delaunay triangulation: no triangles, the points are collinear')
      phase = 'collinear'
      const along = points.map((_, i) => i).sort((i, j) => points[i].x - points[j].x || points[i].y - points[j].y)
      for (let k = 0; k + 1 < n; k++) {
        const i = along[k], j = along[k + 1]
        lines.push({ sites: [i, j], p: mid(points[i], points[j]), dir: normal(points[i], points[j]) })
        emit(10, `Points are collinear: bisector of ${edgeLabel(i, j)}`, { currentLine: k })
      }
    } else emit(1, 'Delaunay triangulation: no triangles')
    phase = 'cells'
    for (let s = 0; s < n; s++) {
      cells.push({ site: s, vertices: [] })
      emit(11, `Cell of ${label(s)} is unbounded: ∞ ∞`, { currentSite: s })
    }
    phase = 'done'
    emit(12, n >= 2 ? `Done: ${lines.length} bisectors, ${n} unbounded cells` : `Done: 0 vertices, 0 edges, ${n} cells (${n} unbounded)`)
    return { vertices, edges, lines, cells, triangles, vertexOfTriangle: [] }
  }

  emit(1, `Delaunay triangulation: ${triangles.length} triangles, ${delaunayEdges.length} edges`)

  phase = 'vertices'
  const tol = mergeTol(points)
  triangles.forEach((t, ti) => {
    const center = circumcenter(points[t[0]], points[t[1]], points[t[2]])
    if (!center) throw new Error('voronoi: degenerate Delaunay triangle')
    const circle = { center, radius: distance(center, points[t[0]]) }
    const name = `Triangle ${t.map(label).join(' ')}`
    const k = vertices.findIndex((v) => distance(v, center) <= tol)
    if (k >= 0) {
      vertexOfTriangle[ti] = k
      const merged = vertexOfTriangle.flatMap((v, i) => (v === k ? [i] : []))
      emit(4, `${name} shares its circumcenter with ${vertexLabel(k)} → merged`, { currentTriangle: ti, circle, merged })
    } else {
      vertexOfTriangle[ti] = vertices.length
      vertices.push(center)
      emit(3, `${name} → Voronoi vertex ${vertexLabel(vertices.length - 1)} at ${fmt(center)}`, { currentTriangle: ti, circle })
    }
  })
  const vot = vertexOfTriangle as number[]

  const trianglesOf = new Map<string, number[]>()
  triangles.forEach((t, ti) => {
    for (let e = 0; e < 3; e++) {
      const a = t[e], b = t[(e + 1) % 3]
      const key = a < b ? `${a},${b}` : `${b},${a}`
      const list = trianglesOf.get(key)
      if (list) list.push(ti)
      else trianglesOf.set(key, [ti])
    }
  })

  phase = 'edges'
  for (const [i, j] of delaunayEdges) {
    const ts = trianglesOf.get(`${i},${j}`) ?? []
    const currentEdge: [number, number] = [i, j]
    if (ts.length === 2) {
      const a = vot[ts[0]], b = vot[ts[1]]
      if (a === b) {
        emit(7, `Edge ${edgeLabel(i, j)}: both triangles share the vertex ${vertexLabel(a)} → no edge`, { currentEdge, skipped: true })
        continue
      }
      edges.push({ sites: [i, j], a, b })
      emit(7, `Edge ${edgeLabel(i, j)} is shared by ${vertexLabel(a)} and ${vertexLabel(b)} → Voronoi edge ${vertexLabel(a)}–${vertexLabel(b)}`, {
        currentEdge,
        newEdge: edges.length - 1,
      })
    } else if (ts.length === 1) {
      const t = triangles[ts[0]]
      const k = t.find((v) => v !== i && v !== j)!
      const m = mid(points[i], points[j])
      let dir = normal(points[i], points[j])
      if (dot(dir, subtract(points[k], m)) > 0) dir = { x: -dir.x, y: -dir.y }
      const a = vot[ts[0]]
      edges.push({ sites: [i, j], a, b: null, dir })
      emit(9, `Hull edge ${edgeLabel(i, j)} → ray from ${vertexLabel(a)} away from ${label(k)}`, {
        currentEdge,
        newEdge: edges.length - 1,
      })
    } else throw new Error(`voronoi: Delaunay edge ${edgeLabel(i, j)} is in ${ts.length} triangles`)
  }

  phase = 'cells'
  const incident: number[][] = points.map(() => [])
  edges.forEach((e, k) => {
    incident[e.sites[0]].push(k)
    incident[e.sites[1]].push(k)
  })
  for (let s = 0; s < n; s++) {
    const cell = buildCell(points, vertices, edges, s, incident[s])
    cells.push(cell)
    const names = cell.vertices.map(vertexLabel).join(' ')
    emit(11, cell.rays ? `Cell of ${label(s)} is unbounded: ∞ ${names} ∞` : `Cell of ${label(s)}: ${names}`, { currentSite: s })
  }

  phase = 'done'
  const unbounded = cells.filter((c) => c.rays).length
  emit(12, `Done: ${vertices.length} vertices, ${edges.length} edges, ${n} cells (${unbounded} unbounded)`)
  return { vertices, edges, lines, cells, triangles, vertexOfTriangle: vot }
}
