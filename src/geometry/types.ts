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
