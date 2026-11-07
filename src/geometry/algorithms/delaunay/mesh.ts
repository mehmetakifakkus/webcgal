import type { Pt } from '../../types'
import { isSymbolic, orient, pointInTriangle } from './symbolic'

type Idx3 = [number, number, number]

/** `n[e]` is the neighbor across the edge opposite `v[e]`, i.e. `v[(e+1)%3]`-`v[(e+2)%3]`; -1 if none. */
export type Tri = { v: Idx3; n: Idx3; alive: boolean }

/** Triangle mesh with two-way adjacency. Vertices are indices into `points` (negative = symbolic). */
export class TriangleMesh {
  tris: Tri[] = []

  constructor(private points: Pt[]) {}

  /** Creates the initial CCW triangle [p0, pm1, pm2] and returns its index. */
  init(p0: number, pm1: number, pm2: number): number {
    return this.add([p0, pm1, pm2], [-1, -1, -1])
  }

  /** Finds the alive triangle containing point `p`; `edge` is set when p lies on a real edge. */
  locate(p: number): { t: number; edge?: 0 | 1 | 2 } {
    for (let t = 0; t < this.tris.length; t++) {
      if (!this.tris[t].alive) continue
      const r = pointInTriangle(this.points, this.tris[t].v, p)
      if (r.inside) return r.edge === undefined ? { t } : { t, edge: r.edge }
    }
    throw new Error('point is outside every triangle')
  }

  /** Splits `t` = [a,b,c] into [a,b,p], [b,c,p], [c,a,p] (returned in that order). */
  split3(t: number, p: number): [number, number, number] {
    const { v, n } = this.tris[t]
    const [a, b, c] = v
    const base = this.tris.length
    const [t0, t1, t2] = [base, base + 1, base + 2]
    this.kill(t)
    this.add([a, b, p], [t1, t2, n[2]])
    this.add([b, c, p], [t2, t0, n[0]])
    this.add([c, a, p], [t0, t1, n[1]])
    for (const x of [t0, t1, t2]) this.link(x)
    return [t0, t1, t2]
  }

  /**
   * Splits `t` and its neighbor across edge `edge` (p lies on that edge). With a = v[edge],
   * b = v[edge+1], c = the third vertex of `t` and d = the far vertex of the neighbor, returns
   * [[a,p,c], [p,b,c], [b,p,d], [p,a,d]].
   */
  split4(t: number, edge: number, p: number): [number, number, number, number] {
    const T = this.tris[t]
    const a = T.v[edge], b = T.v[(edge + 1) % 3], c = T.v[(edge + 2) % 3]
    const o = this.opposite(t, (edge + 2) % 3)
    if (!o) throw new Error('split4: edge has no neighbor')
    const u = this.tris[o.tri]
    const d = o.vertex
    const f = u.v.indexOf(d)
    const base = this.tris.length
    const [t1, t2, u1, u2] = [base, base + 1, base + 2, base + 3]
    const tn = T.n, un = u.n
    this.kill(t)
    this.kill(o.tri)
    this.add([a, p, c], [t2, tn[(edge + 1) % 3], u2])
    this.add([p, b, c], [tn[edge], t1, u1])
    this.add([b, p, d], [u2, un[(f + 2) % 3], t2])
    this.add([p, a, d], [un[(f + 1) % 3], u1, t1])
    for (const x of [t1, t2, u1, u2]) this.link(x)
    return [t1, t2, u1, u2]
  }

  /**
   * Flips the edge of `t` opposite r = v[edge] (shared with n[edge]). With t = [r,b,c] and k the
   * far vertex of the neighbor, the new triangles are a = [r,b,k] and b = [r,k,c]; `newEdge` is
   * [r, k]. Both have r at index 0, so the two edges to legalize are the edges opposite r:
   * edge 0 of `a` (b-k) and edge 0 of `b` (k-c). The quad must be strictly convex.
   */
  flip(t: number, edge: number): { a: number; b: number; newEdge: [number, number] } {
    const o = this.opposite(t, edge)
    if (!o) throw new Error('flip: edge has no neighbor')
    const T = this.tris[t]
    const u = this.tris[o.tri]
    const r = T.v[edge], b = T.v[(edge + 1) % 3], c = T.v[(edge + 2) % 3]
    const k = o.vertex
    const f = u.v.indexOf(k)
    const a = this.tris.length
    const tn = T.n, un = u.n
    this.kill(t)
    this.kill(o.tri)
    this.add([r, b, k], [un[(f + 1) % 3], a + 1, tn[(edge + 2) % 3]])
    this.add([r, k, c], [un[(f + 2) % 3], tn[(edge + 1) % 3], a])
    this.link(a)
    this.link(a + 1)
    return { a, b: a + 1, newEdge: [r, k] }
  }

  /** Neighbor across `edge` of `t` and its vertex opposite that shared edge; null on the boundary. */
  opposite(t: number, edge: number): { tri: number; vertex: number } | null {
    const nb = this.tris[t].n[edge]
    if (nb < 0) return null
    const f = this.sharedEdge(nb, t, edge)
    return { tri: nb, vertex: this.tris[nb].v[f] }
  }

  alive(): number[] {
    const out: number[] = []
    this.tris.forEach((t, i) => t.alive && out.push(i))
    return out
  }

  /** Alive triangles without a symbolic vertex. */
  realTriangles(): Idx3[] {
    return this.alive()
      .map((t) => this.tris[t].v)
      .filter((v) => !v.some(isSymbolic))
      .map((v) => [...v] as Idx3)
  }

  /** Each undirected edge of the alive triangles once, as [min, max] (symbolic endpoints included). */
  edges(): [number, number][] {
    const seen = new Map<string, [number, number]>()
    for (const t of this.alive()) {
      const { v } = this.tris[t]
      for (let e = 0; e < 3; e++) {
        const a = v[e], b = v[(e + 1) % 3]
        const key = a < b ? `${a},${b}` : `${b},${a}`
        if (!seen.has(key)) seen.set(key, a < b ? [a, b] : [b, a])
      }
    }
    return [...seen.values()]
  }

  snapshot(): { v: Idx3; alive: boolean }[] {
    return this.tris.map((t) => ({ v: [...t.v] as Idx3, alive: t.alive }))
  }

  /** Describes the first inconsistency among alive triangles (orientation, mutual adjacency), else null. */
  checkAdjacency(): string | null {
    for (const t of this.alive()) {
      const { v, n } = this.tris[t]
      if (orient(this.points, v[0], v[1], v[2]) !== 1) return `triangle ${t} is not CCW`
      for (let e = 0; e < 3; e++) {
        const nb = n[e]
        if (nb < 0) continue
        if (!this.tris[nb]?.alive) return `triangle ${t} edge ${e} points to dead/missing triangle ${nb}`
        const u = this.tris[nb]
        const f = u.n.indexOf(t)
        if (f < 0) return `triangle ${nb} does not point back to ${t}`
        if (u.v[(f + 1) % 3] !== v[(e + 2) % 3] || u.v[(f + 2) % 3] !== v[(e + 1) % 3])
          return `triangles ${t} and ${nb} disagree on the shared edge`
      }
    }
    return null
  }

  private add(v: Idx3, n: Idx3): number {
    this.tris.push({ v, n, alive: true })
    return this.tris.length - 1
  }

  private kill(t: number) {
    this.tris[t].alive = false
  }

  /** Index f in `tri` of the edge shared with `other` across edge `e` of `other` (matched by vertices). */
  private sharedEdge(tri: number, other: number, e: number): number {
    const ov = this.tris[other].v
    const u = this.tris[tri].v
    for (let f = 0; f < 3; f++)
      if (u[(f + 1) % 3] === ov[(e + 2) % 3] && u[(f + 2) % 3] === ov[(e + 1) % 3]) return f
    throw new Error(`triangles ${tri} and ${other} share no edge`)
  }

  /** Makes every neighbor of new triangle `t` point back to it. */
  private link(t: number) {
    for (let e = 0; e < 3; e++) {
      const nb = this.tris[t].n[e]
      if (nb >= 0) this.tris[nb].n[this.sharedEdge(nb, t, e)] = t
    }
  }
}
