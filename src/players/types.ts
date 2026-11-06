import type { Scene } from '../engine/scene'
import type { Step } from '../geometry/steps'
import type { Pt } from '../geometry/types'

/** What <StepPlayer> needs from an algorithm; the player itself knows nothing algorithm-specific. */
export type PlayerModule<S> = {
  /** Records every step for the given points. */
  computeSteps(points: Pt[]): Step<S>[]
  /** Draws step `step` after clearing the scene. Pure with respect to `step` and `points`. */
  render(scene: Scene, step: Step<S>, points: Pt[]): void
  pseudocode: string[]
  /** The points a player starts with (e.g. 10 random ones). */
  initialPoints(): Pt[]
}
