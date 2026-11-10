import type { Step } from '../../steps'
import type { ArtGalleryInput } from '../../types'
import { fisk } from './fisk'
import type { GalleryState } from './galleryState'
import { coverage, visibilityPolygon } from './visibility'

const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`

/**
 * Steps of the art gallery player. 'fisk': the recorder calls of `fisk` (n + 3 steps, each
 * state is `{ ...ctx, ...patch }`, deep-cloned). 'sandbox': one step on line 9 with the
 * cameras of `input.cameras`, their visibility polygons and the sampled coverage.
 */
export function gallerySteps(input: ArtGalleryInput, mode: 'fisk' | 'sandbox' = 'fisk'): Step<GalleryState>[] {
  const polygon = input.polygon
  if (mode === 'fisk') {
    const steps: Step<GalleryState>[] = []
    fisk(polygon, (line, description, patch, ctx) => {
      steps.push({ description, line, state: structuredClone({ ...ctx, ...patch }) })
    })
    return steps
  }
  const cameras = [...input.cameras]
  const cov = coverage(polygon, cameras)
  const n = polygon.length
  const description =
    cameras.length === 0
      ? 'No cameras yet: click a corner to place one'
      : cov.covered
        ? `Room covered with ${plural(cameras.length, 'camera')} (Fisk's bound: ⌊${n}/3⌋ = ${Math.floor(n / 3)})`
        : `${plural(cameras.length, 'camera')} · ${cov.percent}% covered`
  const state: GalleryState = {
    mode: 'sandbox',
    phase: 'sandbox',
    triangles: [],
    dualEdges: [],
    colors: polygon.map(() => null),
    cameras,
    visibility: cameras.map((c) => visibilityPolygon(polygon, c)),
    coverage: cov,
  }
  return [{ description, line: 9, state: structuredClone(state) }]
}
