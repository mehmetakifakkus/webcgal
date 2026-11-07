export type Pt = { x: number; y: number }
export type Circle = { center: Pt; radius: number }
/** y = slope * x + intercept */
export type Line = { slope: number; intercept: number }

export type Segment = { a: Pt; b: Pt }
/** A point where the listed segments (0-based indices) meet. */
export type IntersectionPoint = { p: Pt; segments: number[] }
/** A collinear stretch shared by two segments; `a` is the upper end. */
export type Overlap = { a: Pt; b: Pt; segments: [number, number] }
export type IntersectionResult = { points: IntersectionPoint[]; overlaps: Overlap[] }

/** Vertices in order; normalised to CCW before processing. */
export type Polygon = Pt[]
/** Vertex indices, smaller index first. */
export type Diagonal = [number, number]
export type Triangle = [number, number, number]
export type VertexType = 'start' | 'end' | 'split' | 'merge' | 'regular'
export type TriangulationResult = {
  types: VertexType[]
  partitionDiagonals: Diagonal[]
  /** y-monotone pieces as vertex indices (CCW). */
  pieces: number[][]
  triangulationDiagonals: Diagonal[]
  triangles: Triangle[]
}

export type DelaunayInput = { points: Pt[]; order: number[] }
export type DelaunayResult = {
  /** Triangles as indices into the input points. */
  triangles: Triangle[]
  edges: [number, number][]
  hull: number[]
  flips: number
}

export type VoronoiEdge = { sites: [number, number]; a: number; b: number | null; dir?: Pt }
//  b === null → ray from a along dir (dir is a unit vector)
export type VoronoiLine = { sites: [number, number]; p: Pt; dir: Pt } // collinear input only
export type VoronoiCell = { site: number; vertices: number[]; rays?: [number, number] }
//  vertices are CCW; rays = indices into edges of the two rays of an open cell (entering, leaving)
export type VoronoiResult = {
  vertices: Pt[]
  edges: VoronoiEdge[]
  lines: VoronoiLine[]
  cells: VoronoiCell[]
  triangles: Triangle[]
  vertexOfTriangle: number[]
}
export type VoronoiInput = { points: Pt[] }
