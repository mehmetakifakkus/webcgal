import { afterEach, expect, test } from 'vitest'
import { createScene, type Scene } from '../../engine/scene'
import { run, type OutputLine } from '../../engine/runtime'
import { docs } from './index'

const scenes: Scene[] = []
afterEach(() => {
  for (const s of scenes.splice(0)) s.dispose()
  document.body.innerHTML = ''
})

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/** Every example gets a live preview on its page, so each one must run without errors. */
test.each(docs.filter((d) => d.example !== undefined).map((d) => [d.name, d] as const))(
  'example of %s runs without errors',
  async (_name, entry) => {
    const canvas = document.createElement('canvas')
    canvas.width = 775
    canvas.height = 360
    document.body.appendChild(canvas)
    const scene = createScene(canvas)
    scenes.push(scene)
    const lines: OutputLine[] = []
    const result = run(entry.example!, { scene, output: (l) => lines.push(l) })
    for (let i = 0; i < 5; i++) await nextFrame()
    const clean = result.ok && lines.every((l) => l.kind !== 'error')
    expect(clean, JSON.stringify(result) + JSON.stringify(lines)).toBe(true)
  },
)
