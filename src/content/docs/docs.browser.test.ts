import { afterEach, describe, expect, test } from 'vitest'
import { createScene, type Scene } from '../../engine/scene'
import { run, type OutputLine } from '../../engine/runtime'
import { docs } from './index'

/**
 * The one output line each keyed example prints. Random examples must match on every outcome,
 * so each one runs several times.
 */
const EXAMPLE_OUTPUT: Record<string, RegExp> = {
  Vector: /^sum \(-?\d+, -?\d+\) · dot -?\d+ · cross -?\d+$/,
  getRandomInt: /^\d+ circles$/,
  convexHull: /^\d+ of \d+ points on the hull$/,
  isMonotone: /^monotone directions: .+$/,
  smallestEnclosingDisk: /^radius \d+(\.\d+)? · \d+ points inside$/,
  findStabber: /^(stabber y = .+|no stabbing line)$/,
  getTextPoint: /^found .+$/,
}
const RUNS = 5

const scenes: Scene[] = []
afterEach(() => {
  for (const s of scenes.splice(0)) s.dispose()
  document.body.innerHTML = ''
})

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/** Runs `code` in a fresh 775x360 scene and returns the run result and the output lines after 5 frames. */
async function runInFreshScene(code: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 775
  canvas.height = 360
  document.body.appendChild(canvas)
  const scene = createScene(canvas)
  scenes.push(scene)
  const lines: OutputLine[] = []
  const result = run(code, { scene, output: (l) => lines.push(l) })
  for (let i = 0; i < 5; i++) await nextFrame()
  return { result, lines }
}

/** Why the output of one run is not exactly one log line matching `pattern`, or null when it is. */
function outputProblem(result: ReturnType<typeof run>, lines: OutputLine[], pattern: RegExp): string | null {
  if (!result.ok) return 'run failed: ' + JSON.stringify(result)
  if (lines.length !== 1) return `expected exactly one output line, got ${JSON.stringify(lines)}`
  if (lines[0].kind !== 'log') return `expected a log line, got ${JSON.stringify(lines[0])}`
  if (!pattern.test(lines[0].text)) return `${JSON.stringify(lines[0].text)} does not match ${pattern}`
  return null
}

/** The problems of `code` over `RUNS` runs, each in a fresh scene (empty when every run passes). */
async function examineExample(code: string, pattern: RegExp): Promise<string[]> {
  const problems: string[] = []
  for (let i = 0; i < RUNS; i++) {
    const { result, lines } = await runInFreshScene(code)
    const p = outputProblem(result, lines, pattern)
    if (p) problems.push(`run ${i + 1}: ${p}`)
  }
  return problems
}

/** Every example gets a live preview on its page, so each one must run without errors. */
test.each(docs.filter((d) => d.example !== undefined).map((d) => [d.name, d] as const))(
  'example of %s runs without errors',
  async (_name, entry) => {
    const { result, lines } = await runInFreshScene(entry.example!)
    const clean = result.ok && lines.every((l) => l.kind !== 'error')
    expect(clean, JSON.stringify(result) + JSON.stringify(lines)).toBe(true)
  },
)

describe('example output', () => {
  test('every key of EXAMPLE_OUTPUT is an item with an example', () => {
    for (const name of Object.keys(EXAMPLE_OUTPUT)) {
      expect(docs.find((d) => d.name === name)?.example, name).toBeDefined()
    }
  })

  for (const entry of docs.filter((d) => d.example !== undefined && Object.hasOwn(EXAMPLE_OUTPUT, d.name))) {
    test(`example of ${entry.name} prints one line matching its pattern on every run`, async () => {
      expect(await examineExample(entry.example!, EXAMPLE_OUTPUT[entry.name])).toEqual([])
    })
  }

  test('the check accepts exactly one matching log line on every run', async () => {
    expect(await examineExample("console.log('7 circles')", /^\d+ circles$/)).toEqual([])
    // random output: every outcome must match
    expect(
      await examineExample("console.log(Math.random() < 0.5 ? 'no stabbing line' : 'stabber y = 1x + 2')", /^(stabber y = .+|no stabbing line)$/),
    ).toEqual([])
  })

  test('the check rejects no line, two lines, a warning, an error and a mismatch', async () => {
    const pattern = /^\d+ circles$/
    for (const code of [
      'var x = 1;',
      "console.log('1 circles'); console.log('2 circles');",
      "console.warn('1 circles')",
      "console.log('1 circles'); console.error('oops')",
      "console.log('1 circles'); nope()",
      "console.log('circles')",
    ]) {
      const problems = await examineExample(code, pattern)
      expect(problems, code).toHaveLength(RUNS)
    }
    // an example whose output differs between runs is caught on the runs that do not match
    const w = window as unknown as { __runs?: number }
    w.__runs = 0
    const alternating = "window.__runs++; console.log(window.__runs % 2 ? '3 circles' : 'no circles')"
    expect(await examineExample(alternating, pattern)).toEqual([
      'run 2: "no circles" does not match /^\\d+ circles$/',
      'run 4: "no circles" does not match /^\\d+ circles$/',
    ])
    delete w.__runs
  })

  test('the findStabber example prints both outcomes when Math.random is stubbed', async () => {
    const code = docs.find((d) => d.name === 'findStabber')!.example!
    const originalRandom = Math.random
    try {
      // every value 0.5: slope 0, intercept 180, no offset, half-length 35 -> five aligned segments around y = 180
      Math.random = () => 0.5
      const found = await runInFreshScene(code)
      expect(outputProblem(found.result, found.lines, /^stabber y = .+$/)).toBeNull()
      expect(found.lines[0].text).toBe('stabber y = 0·x + 145') // the flat line through the first end points tried

      // alternating offsets -40 / +40 with short half-lengths: segments [120,160], [200,240], [120,160], ...
      // no line can meet the first three of them, so findStabber returns null
      const draws = [0.5, 0.5]
      for (const offset of [0, 0.999, 0, 0.999, 0]) draws.push(offset, 0, 0)
      let i = 0
      Math.random = () => draws[i++] ?? 0.5
      const none = await runInFreshScene(code)
      expect(outputProblem(none.result, none.lines, /^no stabbing line$/)).toBeNull()
      expect(i).toBe(draws.length)
    } finally {
      Math.random = originalRandom
    }
  })
})
