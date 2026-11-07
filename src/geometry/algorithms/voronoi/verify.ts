import type { Pt, VoronoiResult } from '../../types'
import { crossVec, distance, dot, subtract } from '../../primitives'
import { hullBoundaryCount } from '../delaunay/verify'
import { diagonal, label, vertexLabel } from './voronoi'

type Verdict = { ok: boolean; reason?: string }
const fail = (reason: string): Verdict => ({ ok: false, reason })
const isIndex = (k: unknown, n: number) => Number.isInteger(k) && (k as number) >= 0 && (k as number) < n

/** Reason when some site is closer to q than r (beyond tol), else null. */
function closerSite(points: Pt[], q: Pt, r: number, tol: number): number | null {
  for (let i = 0; i < points.length; i++) if (distance(points[i], q) < r - tol) return i
  return null
}

/**
 * Checks a Voronoi diagram (spec §2.4), tolerance 1e-6 · D: vertices equidistant from the sites
 * of their triangles and no site closer; every edge, ray and bisector line on the bisector of its
 * two sites with no site closer at its midpoint (a + dir · D for a ray); rays outward from the
 * hull; one cell per site, n − h closed, each listing the vertices of its edges CCW; and the
 * Euler relation V − E + n = 1 (n − 1 bisectors for collinear input).
 */
export function isVoronoi(points: Pt[], result: VoronoiResult): Verdict {
  const n = points.length
  const D = diagonal(points)
  const tol = 1e-6 * D
  const { vertices, edges, lines, cells, triangles, vertexOfTriangle } = result
  const collinear = triangles.length === 0

  // vertices
  if (collinear && vertices.length > 0) return fail('vertex: collinear input has no Voronoi vertices')
  if (vertexOfTriangle.length !== triangles.length)
    return fail(`vertex: ${vertexOfTriangle.length} vertex indices for ${triangles.length} triangles`)
  const sitesOf: Set<number>[] = vertices.map(() => new Set())
  for (let t = 0; t < triangles.length; t++) {
    const k = vertexOfTriangle[t]
    if (!isIndex(k, vertices.length)) return fail(`vertex: triangle ${t + 1} has an invalid vertex index`)
    for (const s of triangles[t]) sitesOf[k].add(s)
  }
  for (let k = 0; k < vertices.length; k++) {
    const u = vertices[k]
    const sites = [...sitesOf[k]]
    if (sites.length === 0) return fail(`vertex ${vertexLabel(k)} belongs to no triangle`)
    const r = distance(u, points[sites[0]])
    for (const s of sites)
      if (Math.abs(distance(u, points[s]) - r) > tol)
        return fail(`vertex ${vertexLabel(k)} is not equidistant from the sites of its triangles (${label(s)})`)
    const c = closerSite(points, u, r, tol)
    if (c !== null) return fail(`vertex ${vertexLabel(k)}: ${label(c)} is closer than the sites of its triangles`)
  }

  // edges and rays
  if (collinear && edges.length > 0) return fail('edge: collinear input has no Voronoi edges')
  const pairs = new Set<string>()
  let rayCount = 0
  for (let e = 0; e < edges.length; e++) {
    const { sites, a, b, dir } = edges[e]
    const [i, j] = sites
    if (!isIndex(i, n) || !isIndex(j, n) || i === j) return fail(`edge ${e + 1} has invalid sites`)
    const key = i < j ? `${i},${j}` : `${j},${i}`
    if (pairs.has(key)) return fail(`edge ${label(i)}–${label(j)} is listed twice`)
    pairs.add(key)
    const name = `${b === null ? 'ray' : 'edge'} ${label(i)}–${label(j)}`
    if (!isIndex(a, vertices.length) || (b !== null && !isIndex(b, vertices.length)))
      return fail(`${name} has an invalid vertex index`)
    for (const v of b === null ? [a] : [a, b])
      if (Math.abs(distance(vertices[v], points[i]) - distance(vertices[v], points[j])) > tol)
        return fail(`${name}: vertex ${vertexLabel(v)} is not on the bisector`)
    let m: Pt
    if (b === null) {
      rayCount++
      if (!dir || Math.abs(Math.hypot(dir.x, dir.y) - 1) > 1e-9) return fail(`${name} has no unit direction`)
      const pq = subtract(points[j], points[i])
      if (Math.abs(dot(dir, pq)) > 1e-9 * Math.hypot(pq.x, pq.y))
        return fail(`${name} is not along the perpendicular bisector`)
      for (let s = 0; s < n; s++)
        if (dot(dir, subtract(points[s], points[i])) > tol) return fail(`${name} does not point out of the hull`)
      m = { x: vertices[a].x + dir.x * D, y: vertices[a].y + dir.y * D }
    } else {
      if (a === b) return fail(`${name} has zero length`)
      m = { x: (vertices[a].x + vertices[b].x) / 2, y: (vertices[a].y + vertices[b].y) / 2 }
    }
    const r = distance(m, points[i])
    if (Math.abs(distance(m, points[j]) - r) > tol) return fail(`${name}: its midpoint is not equidistant from its sites`)
    const c = closerSite(points, m, r, tol)
    if (c !== null) return fail(`${name}: ${label(c)} is closer to its midpoint than its sites`)
  }
  if (!collinear && rayCount !== hullBoundaryCount(points))
    return fail(`ray count ${rayCount}, expected one per hull edge (${hullBoundaryCount(points)})`)

  // collinear bisector lines
  if (!collinear && lines.length > 0) return fail('edge: bisector lines only occur for collinear input')
  for (let k = 0; k < lines.length; k++) {
    const { sites, p, dir } = lines[k]
    const [i, j] = sites
    if (!isIndex(i, n) || !isIndex(j, n) || i === j) return fail(`edge: bisector ${k + 1} has invalid sites`)
    const name = `bisector edge ${label(i)}–${label(j)}`
    if (Math.abs(Math.hypot(dir.x, dir.y) - 1) > 1e-9) return fail(`${name} has no unit direction`)
    const pq = subtract(points[j], points[i])
    if (Math.abs(dot(dir, pq)) > 1e-9 * Math.hypot(pq.x, pq.y)) return fail(`${name} is not perpendicular`)
    const r = distance(p, points[i])
    if (Math.abs(distance(p, points[j]) - r) > tol) return fail(`${name}: p is not equidistant from its sites`)
    const c = closerSite(points, p, r, tol)
    if (c !== null) return fail(`${name}: ${label(c)} is closer to p than its sites`)
  }

  // Euler
  if (collinear) {
    const expected = Math.max(0, n - 1)
    if (lines.length !== expected) return fail(`Euler relation: ${lines.length} bisectors, expected ${expected}`)
  } else if (vertices.length - edges.length + n !== 1)
    return fail(`Euler relation: V − E + F = ${vertices.length - edges.length + n}, expected 1`)

  // cells
  if (cells.length !== n) return fail(`cell count ${cells.length}, expected ${n}`)
  const seen = new Set<number>()
  for (const cell of cells) {
    if (!isIndex(cell.site, n) || seen.has(cell.site)) return fail(`cell with invalid or repeated site ${cell.site}`)
    seen.add(cell.site)
    if (collinear) {
      if (cell.vertices.length > 0 || cell.rays) return fail(`cell of ${label(cell.site)} must be an empty open cell`)
      continue
    }
    const r = checkCell(points, result, cell.site, cell.vertices, cell.rays)
    if (r) return fail(r)
  }
  if (!collinear) {
    const closed = cells.filter((c) => !c.rays).length
    const expected = n - hullBoundaryCount(points)
    if (closed !== expected) return fail(`closed cell count ${closed}, expected ${expected}`)
  }
  return { ok: true }
}

/** Reason when the cell of `site` is not its incident vertices in CCW order, else null. */
function checkCell(
  points: Pt[],
  { vertices, edges }: VoronoiResult,
  site: number,
  vs: number[],
  rays: [number, number] | undefined,
): string | null {
  const name = `cell of ${label(site)}`
  const expected = new Set<number>()
  const incidentRays: number[] = []
  edges.forEach((e, k) => {
    if (!e.sites.includes(site)) return
    expected.add(e.a)
    if (e.b === null) incidentRays.push(k)
    else expected.add(e.b)
  })
  if (new Set(vs).size !== vs.length) return `${name} lists a vertex twice`
  if (vs.length !== expected.size || vs.some((v) => !expected.has(v)))
    return `${name} does not list exactly the vertices of its edges`
  const s = points[site]
  const at = (v: number) => subtract(vertices[v], s)
  if (rays) {
    if (incidentRays.length !== 2 || !rays.every((k) => incidentRays.includes(k)) || rays[0] === rays[1])
      return `${name}: rays are not its two incident rays`
    const [entry, exit] = rays.map((k) => edges[k])
    if (crossVec(entry.dir!, subtract(s, vertices[entry.a])) >= 0) return `${name}: the entering ray is not first`
    if (vs[0] !== entry.a || vs[vs.length - 1] !== exit.a) return `${name} does not run from its entering to its leaving ray`
    for (let k = 0; k + 1 < vs.length; k++)
      if (crossVec(at(vs[k]), at(vs[k + 1])) <= 0) return `${name} is not counter-clockwise`
    return null
  }
  if (incidentRays.length > 0) return `${name} has rays but is listed as closed`
  if (vs.length < 3) return `${name} is closed with fewer than three vertices`
  let turn = 0
  for (let k = 0; k < vs.length; k++) {
    const p = at(vs[k]), q = at(vs[(k + 1) % vs.length])
    const c = crossVec(p, q)
    if (c <= 0) return `${name} is not counter-clockwise`
    turn += Math.atan2(c, dot(p, q))
  }
  if (Math.abs(turn - 2 * Math.PI) > 1e-6) return `${name} does not wind once around its site`
  return null
}
