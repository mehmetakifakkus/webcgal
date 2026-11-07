import type { Pt, VoronoiCell, VoronoiResult } from '../../types'
import { GEOM_TOL } from '../../primitives'
import { type Box, clipPolygonToBox } from './clip'

/** Sutherland–Hodgman step: the part of `poly` where value(p) >= 0. */
function clipHalfPlane(poly: Pt[], value: (p: Pt) => number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]
    const prev = poly[(i + poly.length - 1) % poly.length]
    const vc = value(cur)
    const vp = value(prev)
    if ((vc >= 0) !== (vp >= 0)) {
      const t = vp / (vp - vc)
      out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) })
    }
    if (vc >= 0) out.push(cur)
  }
  return out
}

function dedupe(poly: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of poly) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > GEOM_TOL) out.push(p)
  }
  while (out.length > 1) {
    const f = out[0], l = out[out.length - 1]
    if (Math.hypot(f.x - l.x, f.y - l.y) > GEOM_TOL) break
    out.pop()
  }
  return out.length < 3 ? [] : out
}

/** The box (CCW) intersected with the half-planes closer to `site` than to each neighbour. */
function boxNearerThan(points: Pt[], site: number, neighbours: number[], box: Box): Pt[] {
  let poly: Pt[] = [
    { x: box.x0, y: box.y0 },
    { x: box.x1, y: box.y0 },
    { x: box.x1, y: box.y1 },
    { x: box.x0, y: box.y1 },
  ]
  const s = points[site]
  for (const q of neighbours) {
    const o = points[q]
    const m = { x: (s.x + o.x) / 2, y: (s.y + o.y) / 2 }
    const d = { x: o.x - s.x, y: o.y - s.y }
    poly = clipHalfPlane(poly, (p) => (m.x - p.x) * d.x + (m.y - p.y) * d.y)
    if (poly.length === 0) return []
  }
  return dedupe(poly)
}

const other = (sites: [number, number], site: number) => (sites[0] === site ? sites[1] : sites[0])

/** Cell of `site` for collinear input: the box cut by the bisectors next to the site (one or two). */
export function collinearCellPolygon(points: Pt[], result: VoronoiResult, site: number, box: Box): Pt[] {
  const neighbours = result.lines.filter((l) => l.sites.includes(site)).map((l) => other(l.sites, site))
  return boxNearerThan(points, site, neighbours, box)
}

/**
 * The cell clipped to `box`, CCW (spec §2.3). A bounded cell clips its vertex polygon. An
 * unbounded cell is the box cut by the bisector half-planes of its edges and rays: far points
 * at a fixed distance along the rays would miss box corners when the rays diverge widely (one
 * vertex with all rays, as for points on a circle). Collinear input uses `collinearCellPolygon`.
 */
export function cellPolygon(points: Pt[], result: VoronoiResult, cell: VoronoiCell, box: Box): Pt[] {
  if (!cell.rays && cell.vertices.length >= 3)
    return clipPolygonToBox(cell.vertices.map((k) => result.vertices[k]), box)
  if (result.lines.length > 0) return collinearCellPolygon(points, result, cell.site, box)
  const neighbours = result.edges.filter((e) => e.sites.includes(cell.site)).map((e) => other(e.sites, cell.site))
  return boxNearerThan(points, cell.site, neighbours, box)
}
