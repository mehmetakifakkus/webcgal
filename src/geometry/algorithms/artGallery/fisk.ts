import type { Polygon, Pt, Triangle } from '../../types'
import { ensureCCW } from '../triangulation/polygon'
import { triangulate } from '../triangulation/triangulate'
import type { Colour, GalleryPatch, GalleryRecorder, GalleryRecorderContext, GalleryState } from './galleryState'
import { visibilityPolygon } from './visibility'

// Fisk's proof of the art gallery theorem (de Berg et al. §3.1): triangulate, 3-colour the
// vertices along the dual tree, put a camera at every vertex of the smallest colour class.

export type FiskResult = {
  /** As `triangulate` returns them for the CCW polygon, in input indices. */
  triangles: Triangle[]
  colors: Colour[]
  /** Triangle indices in depth-first visiting order. */
  order: number[]
  counts: [number, number, number]
  chosen: Colour
  /** Vertices of colour `chosen`, ascending. */
  cameras: number[]
}

export const label = (i: number) => `v${i + 1}`

const COLOUR_NAMES = ['red', 'green', 'blue'] as const
export const colorName = (c: Colour): 'red' | 'green' | 'blue' => COLOUR_NAMES[c]

const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`

/**
 * The dual graph of a triangulation: a node per triangle, an arc between two triangles
 * that share two vertices (a diagonal). For a triangulated simple polygon it is a tree
 * with n − 2 nodes. `adjacency` lists are ascending; `shared` maps "i-j" (i < j, in
 * ascending order of (i, j)) to the two shared vertices, ascending.
 */
export function dualTree(triangles: Triangle[]): { adjacency: number[][]; shared: Map<string, [number, number]> } {
  const adjacency: number[][] = triangles.map(() => [])
  const byEdge = new Map<string, number>()
  const arcs: { i: number; j: number; pair: [number, number] }[] = []
  triangles.forEach((t, j) => {
    for (let k = 0; k < 3; k++) {
      const a = Math.min(t[k], t[(k + 1) % 3])
      const b = Math.max(t[k], t[(k + 1) % 3])
      const key = `${a}-${b}`
      const i = byEdge.get(key)
      if (i === undefined) {
        byEdge.set(key, j)
      } else {
        adjacency[i].push(j)
        adjacency[j].push(i)
        arcs.push({ i: Math.min(i, j), j: Math.max(i, j), pair: [a, b] })
      }
    }
  })
  for (const list of adjacency) list.sort((a, b) => a - b)
  arcs.sort((s, t) => s.i - t.i || s.j - t.j)
  return { adjacency, shared: new Map(arcs.map(({ i, j, pair }) => [`${i}-${j}`, pair])) }
}

/**
 * Fisk's construction. Runs on the CCW version of the polygon (`ensureCCW`) and reports
 * everything in the indices of the input. The first triangle is the lowest-index triangle
 * containing the lowest-index (CCW) vertex; its vertices get colours 0, 1, 2 in ascending
 * CCW index. A depth-first walk of the dual tree (neighbours in ascending triangle index)
 * gives each newly reached triangle's third vertex the missing colour. The cameras are the
 * vertices of the colour used least often (ties → the lower colour). Throws on a polygon
 * that is not simple.
 *
 * `record` receives lines 1, 2, 3, one line 6 per further triangle, 7, 8 and 9 of the
 * pseudocode of spec §3.1 (n + 3 steps).
 */
export function fisk(input: Polygon, record?: GalleryRecorder): FiskResult {
  const n = input.length
  const { polygon, reversed } = ensureCCW(input)
  const f = (i: number) => (reversed ? n - 1 - i : i)
  const ccwTriangles = triangulate(polygon).triangles
  const triangles = ccwTriangles.map((t) => t.map(f) as Triangle)
  const m = triangles.length
  const { adjacency, shared } = dualTree(triangles)
  const arcs = [...shared.keys()].map((k) => k.split('-').map(Number) as [number, number])

  const colors: (Colour | null)[] = input.map(() => null)
  let cameras: number[] = []
  let visibility: Pt[][] = []
  let dualShown = false

  const emit = (line: number, description: string, phase: GalleryState['phase'], patch: GalleryPatch = {}) => {
    if (!record) return
    const ctx: GalleryRecorderContext = {
      mode: 'fisk',
      phase,
      triangles: triangles.map((t) => [...t] as Triangle),
      dualEdges: dualShown ? arcs.map((a) => [...a] as [number, number]) : [],
      colors: [...colors],
      cameras: [...cameras],
      visibility: visibility.map((poly) => poly.map((p) => ({ ...p }))),
    }
    record(line, description, patch, ctx)
  }
  const triangleName = (t: number) => triangles[t].map(label).join(' ')

  emit(1, `Triangulation: ${plural(m, 'triangle')}, ${plural(m - 1, 'diagonal')}`, 'triangulate')
  dualShown = true
  emit(2, `Dual tree: ${plural(m, 'node')}, ${plural(m - 1, 'arc')}`, 'dual')

  const start = ccwTriangles.findIndex((t) => t.includes(0))
  const first = [...ccwTriangles[start]].sort((a, b) => a - b).map(f)
  first.forEach((v, c) => (colors[v] = c as Colour))
  emit(
    3,
    `First triangle ${triangleName(start)}: ${first.map((v, c) => `${label(v)} ${colorName(c as Colour)}`).join(', ')}`,
    'color',
    { current: start, newlyColored: [...first] },
  )

  // Depth-first walk; an explicit stack keeps the recursive visiting order.
  const order = [start]
  const visited = triangles.map((_, t) => t === start)
  const stack: { t: number; next: number }[] = [{ t: start, next: 0 }]
  while (stack.length) {
    const top = stack[stack.length - 1]
    if (top.next >= adjacency[top.t].length) {
      stack.pop()
      continue
    }
    const u = adjacency[top.t][top.next++]
    if (visited[u]) continue
    visited[u] = true
    order.push(u)
    // The two vertices shared with the parent are coloured; the third one never is.
    const third = triangles[u].find((v) => colors[v] === null)
    if (third === undefined) throw new Error(`internal error: triangle ${u} has no uncoloured vertex`)
    const used = triangles[u].reduce<number>((s, v) => s + (colors[v] ?? 0), 0)
    const missing = (3 - used) as Colour
    colors[third] = missing
    emit(6, `Triangle ${triangleName(u)}: ${label(third)} gets ${colorName(missing)}`, 'color', {
      current: u,
      newlyColored: [third],
    })
    stack.push({ t: u, next: 0 })
  }

  const final = colors as Colour[]
  const counts: [number, number, number] = [0, 0, 0]
  for (const c of final) counts[c]++
  const chosen = counts.indexOf(Math.min(...counts)) as Colour
  const choice = () => ({ counts: [...counts] as [number, number, number], chosen })
  emit(
    7,
    `Colour counts: ${counts.map((k, c) => `${colorName(c as Colour)} ${k}`).join(', ')} → ${colorName(chosen)}`,
    'choose',
    choice(),
  )

  cameras = final.flatMap((c, i) => (c === chosen ? [i] : []))
  if (record) visibility = cameras.map((c) => visibilityPolygon(input, c))
  emit(
    8,
    cameras.length === 1 ? `Place a camera at ${label(cameras[0])}` : `Place cameras at ${cameras.map(label).join(', ')}`,
    'place',
    choice(),
  )
  emit(9, `Done: ${plural(cameras.length, 'camera')} for ${n} vertices (⌊${n}/3⌋ = ${Math.floor(n / 3)})`, 'done', choice())

  return { triangles, colors: [...final], order, counts, chosen, cameras: [...cameras] }
}
