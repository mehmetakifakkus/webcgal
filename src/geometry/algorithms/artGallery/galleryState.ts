import type { Pt, Triangle } from '../../types'

// Step state of the art gallery player (spec §3.2). Types only.

export type GalleryMode = 'fisk' | 'sandbox'
export type Colour = 0 | 1 | 2

export type GalleryCoverage = { percent: number; covered: boolean; perCamera: number[] }

export type GalleryState = {
  mode: GalleryMode
  phase: 'triangulate' | 'dual' | 'color' | 'choose' | 'place' | 'done' | 'sandbox'
  triangles: Triangle[]
  /** Arcs of the dual tree as triangle indices, smaller first (from line 2 on). */
  dualEdges: [number, number][]
  /** Per vertex; null while uncoloured. */
  colors: (Colour | null)[]
  /** Active triangle. */
  current?: number
  newlyColored?: number[]
  counts?: [number, number, number]
  chosen?: Colour
  /** Camera vertex indices, ascending. */
  cameras: number[]
  /** Visibility polygons of the cameras, in the order of `cameras`. */
  visibility: Pt[][]
  /** Sandbox only. */
  coverage?: GalleryCoverage
}

/** Fields the recorder passes per step (current/newlyColored on 3 and 6, counts/chosen from 7 on). */
export type GalleryPatch = Partial<Pick<GalleryState, 'current' | 'newlyColored' | 'counts' | 'chosen' | 'coverage'>>

/** Everything except the patch fields; all arrays are copies. */
export type GalleryRecorderContext = Omit<GalleryState, 'current' | 'newlyColored' | 'counts' | 'chosen' | 'coverage'>

/** `line` indexes the art gallery pseudocode of spec §3.1. */
export type GalleryRecorder = (
  line: number,
  description: string,
  patch: GalleryPatch,
  ctx: GalleryRecorderContext,
) => void
