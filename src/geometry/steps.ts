/** One frame of a step-by-step algorithm run: what to say, which pseudocode line to highlight, and the full state. */
export type Step<S> = { description: string; line: number; state: S }
