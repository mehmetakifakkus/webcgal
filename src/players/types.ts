import type { Scene } from '../engine/scene'
import type { Step } from '../geometry/steps'
import type { Pt } from '../geometry/types'

/** A state panel under the canvas (e.g. an event queue); its content comes entirely from the module. */
export type Panel = {
  title: string
  rows: { text: string; highlight?: 'active' | 'testing' | 'new' }[]
  /** Shown when there are no rows (default "Empty"). */
  empty?: string
}

/**
 * What <StepPlayer> needs from an algorithm; the player itself knows nothing algorithm-specific.
 * `S` is the state recorded in each step, `I` the input (points, segments, …).
 */
export type PlayerModule<S, I> = {
  /** Records every step for the given input. */
  computeSteps(input: I): Step<S>[]
  /** Draws step `step` after clearing the scene. Pure with respect to `step` and `input`. */
  render(scene: Scene, step: Step<S>, input: I): void
  pseudocode: string[]
  /** The input a player starts with, and gets from "New random input". */
  randomInput(): I
  /** Named inputs offered in the "Preset" menu. */
  presets?: { name: string; input: I }[]
  /** The draggable points of `input`, in scene coordinates. */
  handles(input: I): Pt[]
  /** A copy of `input` with handle `index` moved to `p`; `input` itself is left unchanged. */
  moveHandle(input: I, index: number, p: Pt): I
  /** State panels for the given step, shown under the canvas. */
  panels?(step: Step<S>, input: I): Panel[]
  /** Help line under the step description (default: drag the points, keys). */
  hint?: string
  /** Canvas size in scene units (default 775 × 360). */
  canvas?: { width: number; height: number }
}
