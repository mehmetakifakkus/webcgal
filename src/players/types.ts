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
  /** Records every step for the given input, in `mode` (one of `modes`' ids) when the module has modes. */
  computeSteps(input: I, mode?: string): Step<S>[]
  /** Variants of the algorithm offered in the "Mode" menu; the first one is selected initially. */
  modes?: { id: string; label: string }[]
  /** Pseudocode lines (0-based) shown dimmed in `mode`, e.g. the parts that mode skips. */
  dimmedLines?(mode?: string): number[]
  /** A message when `input` cannot be run (shown as an alert; no steps are computed), else null. */
  validate?(input: I): string | null
  /** Draws an invalid input (default: the handles only) after clearing the scene. */
  renderInvalid?(scene: Scene, input: I): void
  /** Draws step `step` after clearing the scene. Pure with respect to `step` and `input`. */
  render(scene: Scene, step: Step<S>, input: I): void
  pseudocode: string[]
  /** The input a player starts with, and gets from "New random input". */
  randomInput(): I
  /** Named inputs offered in the "Preset" menu. */
  presets?: { name: string; input: I }[]
  /** The draggable points of `input`, in scene coordinates. */
  handles(input: I): Pt[]
  /**
   * A copy of `input` with handle `index` moved to `p` (in `mode`, when the module has modes);
   * `input` itself is left unchanged. Returning `input` itself means the handle stays put.
   */
  moveHandle(input: I, index: number, p: Pt, mode?: string): I
  /**
   * Called when handle `index` is clicked (pressed and released with less than 3 px of movement)
   * in `mode`, instead of dragging it: the new input, or `input` itself for no change. Modules
   * without it get no clicks, and their handles start dragging at the first movement.
   */
  clickHandle?(input: I, index: number, mode?: string): I
  /** State panels for the given step, shown under the canvas. */
  panels?(step: Step<S>, input: I): Panel[]
  /** Help line under the step description (default: drag the points, keys). */
  hint?: string
  /** Canvas size in scene units (default 775 × 360). */
  canvas?: { width: number; height: number }
}
