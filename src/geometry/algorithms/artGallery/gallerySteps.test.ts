import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../delaunay/delaunay'
import { isSimple } from '../triangulation/polygon'
import { randomStarPolygon } from '../triangulation/verify'
import { fisk } from './fisk'
import { gallerySteps } from './gallerySteps'
import { GALLERY_PRESETS } from './presets'
import { GALLERY_PSEUDOCODE, PSEUDOCODE_HEADINGS } from './pseudocode'

const TEXTBOOK = GALLERY_PRESETS.find((p) => p.name === 'Textbook polygon')!.polygon
const input = (polygon = TEXTBOOK, cameras: number[] = []) => ({ polygon, cameras })

describe('GALLERY_PSEUDOCODE', () => {
  it('has the 10 lines of the spec, heading [0]', () => {
    expect(GALLERY_PSEUDOCODE).toEqual([
      'ArtGallery(P)',
      '    Triangulate P into n − 2 triangles',
      '    Build the dual tree: a node per triangle, an arc per diagonal',
      '    Colour the three vertices of a first triangle with three different colours',
      '    for each further triangle t, in depth-first order of the dual tree',
      '        two vertices of t are shared with its parent and already coloured',
      '        give the third vertex of t the colour that is missing',
      '    Let c be the colour used least often (at most ⌊n/3⌋ vertices)',
      '    Place a camera at every vertex of colour c',
      '    return the cameras',
    ])
    expect(PSEUDOCODE_HEADINGS).toEqual([0])
  })
})

describe('gallerySteps (fisk)', () => {
  it('step count is n + 3 and lines are 1,2,3,6…,7,8,9', () => {
    const steps = gallerySteps(input())
    expect(steps).toHaveLength(TEXTBOOK.length + 3)
    const n = TEXTBOOK.length
    expect(steps.map((s) => s.line)).toEqual([1, 2, 3, ...Array(n - 3).fill(6), 7, 8, 9])
  })

  it('lines are valid and never the heading', () => {
    for (const s of gallerySteps(input())) {
      expect(s.line).toBeGreaterThanOrEqual(1)
      expect(s.line).toBeLessThan(GALLERY_PSEUDOCODE.length)
      expect(PSEUDOCODE_HEADINGS).not.toContain(s.line)
    }
  })

  it('the last step matches fisk()', () => {
    const r = fisk(TEXTBOOK)
    const last = gallerySteps(input()).at(-1)!
    expect(last.state.mode).toBe('fisk')
    expect(last.state.phase).toBe('done')
    expect(last.state.cameras).toEqual(r.cameras)
    expect(last.state.colors).toEqual(r.colors)
    expect(last.state.triangles).toEqual(r.triangles)
    expect(last.state.counts).toEqual(r.counts)
    expect(last.state.chosen).toBe(r.chosen)
    expect(last.state.visibility).toHaveLength(r.cameras.length)
    expect(last.description).toBe('Done: 4 cameras for 14 vertices (⌊14/3⌋ = 4)')
  })

  it('pins the Textbook polygon texts', () => {
    const steps = gallerySteps(input())
    expect(steps[0].description).toBe('Triangulation: 12 triangles, 11 diagonals')
    expect(steps[1].description).toBe('Dual tree: 12 nodes, 11 arcs')
    expect(steps[2].description).toBe('First triangle v1 v2 v14: v1 red, v2 green, v14 blue')
    expect(steps[14].description).toBe('Colour counts: red 4, green 5, blue 5 → red')
    expect(steps[15].description).toBe('Place cameras at v1, v4, v8, v12')
  })

  it('line-6 steps colour exactly one new vertex and every triangle so far has three colours', () => {
    for (const poly of [TEXTBOOK, ...GALLERY_PRESETS.map((p) => p.polygon)]) {
      const steps = gallerySteps(input(poly))
      const seen = new Set<number>()
      const start = steps.find((x) => x.line === 3)!.state
      seen.add(start.current!)
      expect(new Set(start.triangles[start.current!].map((v) => start.colors[v])).size).toBe(3)
      for (const s of steps.filter((x) => x.line === 6)) {
        const { newlyColored, current, colors, triangles } = s.state
        expect(newlyColored).toHaveLength(1)
        expect(colors[newlyColored![0]]).not.toBeNull()
        seen.add(current!)
        const prev = steps[steps.indexOf(s) - 1].state
        expect(prev.colors[newlyColored![0]]).toBeNull()
        for (const t of seen) expect(new Set(triangles[t].map((v) => colors[v])).size).toBe(3)
      }
    }
  })

  it('newlyColored only on lines 3 and 6', () => {
    for (const s of gallerySteps(input())) {
      expect(s.state.newlyColored !== undefined).toBe(s.line === 3 || s.line === 6)
    }
  })

  it('snapshots are independent', () => {
    const steps = gallerySteps(input())
    const before = JSON.stringify(steps[0].state)
    steps[5].state.colors[0] = 2
    steps[5].state.triangles[0][0] = 99
    steps.at(-1)!.state.cameras.push(42)
    expect(JSON.stringify(steps[0].state)).toBe(before)
    expect(steps[6].state.colors[0]).toBe(0)
    expect(steps[6].state.triangles[0][0]).not.toBe(99)
    expect(steps[steps.length - 2].state.cameras).not.toContain(42)
  })

  it('random polygons give n + 3 steps ending in fisk()', () => {
    const rng = mulberry32(5)
    for (let k = 0; k < 20; k++) {
      const n = 3 + Math.floor(rng() * 20)
      const p = randomStarPolygon(rng, n, 387, 180, 30 + rng() * 60, 160)
      expect(isSimple(p)).toBe(true)
      const steps = gallerySteps(input(p))
      expect(steps).toHaveLength(n + 3)
      expect(steps.at(-1)!.state.cameras).toEqual(fisk(p).cameras)
    }
  })
})

describe('gallerySteps (sandbox)', () => {
  it('texts: none, partial, full, singular', () => {
    const none = gallerySteps(input(), 'sandbox')
    expect(none).toHaveLength(1)
    expect(none[0].line).toBe(9)
    expect(none[0].description).toBe('No cameras yet: click a corner to place one')

    const partial = gallerySteps(input(TEXTBOOK, [0, 3]), 'sandbox')[0]
    expect(partial.description).toMatch(/^2 cameras · \d+% covered$/)

    const full = gallerySteps(input(TEXTBOOK, fisk(TEXTBOOK).cameras), 'sandbox')[0]
    expect(full.description).toBe("Room covered with 4 cameras (Fisk's bound: ⌊14/3⌋ = 4)")

    const convex = GALLERY_PRESETS.find((p) => p.name === 'Convex room')!.polygon
    expect(gallerySteps(input(convex, [0]), 'sandbox')[0].description).toBe(
      "Room covered with 1 camera (Fisk's bound: ⌊9/3⌋ = 3)",
    )
    expect(gallerySteps(input(TEXTBOOK, [0]), 'sandbox')[0].description).toMatch(/^1 camera · \d+% covered$/)
  })

  it('never shows 100% while the room is not covered', () => {
    const s = gallerySteps(input(TEXTBOOK, [3, 6]), 'sandbox')[0]
    expect(s.state.coverage!.covered).toBe(false)
    expect(s.description).toBe('2 cameras · 99% covered')
  })

  it('sandbox step carries cameras, visibility and coverage', () => {
    const s = gallerySteps(input(TEXTBOOK, [0, 7]), 'sandbox')[0]
    expect(s.state.mode).toBe('sandbox')
    expect(s.state.phase).toBe('sandbox')
    expect(s.state.cameras).toEqual([0, 7])
    expect(s.state.visibility).toHaveLength(2)
    expect(s.state.coverage!.perCamera).toHaveLength(2)
    expect(s.state.coverage!.covered).toBe(false)
    expect(s.state.colors).toHaveLength(TEXTBOOK.length)
    const cams = [0, 7]
    cams.push(1)
    expect(s.state.cameras).toEqual([0, 7])
  })
})
