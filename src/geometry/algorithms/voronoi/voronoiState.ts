import type { Pt, Triangle, VoronoiCell, VoronoiEdge, VoronoiLine } from '../../types'

// Step state of the Voronoi player (spec §3.2). Types only.

export type VoronoiState = {
  phase: 'delaunay' | 'vertices' | 'edges' | 'collinear' | 'cells' | 'done'
  /** The mode; computeSteps writes it into every step. */
  showDelaunay: boolean
  /** Constant over all steps. */
  triangles: Triangle[]
  /** Constant over all steps. */
  delaunayEdges: [number, number][]
  /** Voronoi vertices created so far. */
  vertices: Pt[]
  /** Vertex index of each triangle; null until the triangle is processed. */
  vertexOfTriangle: (number | null)[]
  /** Voronoi edges and rays created so far. */
  edges: VoronoiEdge[]
  /** Bisector lines (collinear input only). */
  lines: VoronoiLine[]
  /** Filled in the cells and done phases. */
  cells: VoronoiCell[]
  currentTriangle?: number
  circle?: { center: Pt; radius: number }
  /** Triangles attached to the vertex the current triangle merged into. */
  merged?: number[]
  /** The Delaunay edge being processed. */
  currentEdge?: [number, number]
  /** Index into edges of the edge or ray created in this step. */
  newEdge?: number
  skipped?: boolean
  currentLine?: number
  currentSite?: number
}

/** Fields valid for a single recorded step only. */
export type VorPatch = Partial<
  Pick<
    VoronoiState,
    'currentTriangle' | 'circle' | 'merged' | 'currentEdge' | 'newEdge' | 'skipped' | 'currentLine' | 'currentSite'
  >
>

/** Everything except the mode and the patch fields; vertices/edges/lines/cells are copies. */
export type VorRecorderContext = Pick<
  VoronoiState,
  'phase' | 'triangles' | 'delaunayEdges' | 'vertices' | 'vertexOfTriangle' | 'edges' | 'lines' | 'cells'
>

/** `line` indexes VORONOI_PSEUDOCODE (Task 3). */
export type VorRecorder = (line: number, description: string, patch: VorPatch, ctx: VorRecorderContext) => void
