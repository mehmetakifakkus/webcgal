import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { API_NAMES, PAPER_CLASSES } from '../../engine/api'
import { categories, docs, findDoc } from './index'

/** The 15 items of the legacy documentation, with their legacy categories. */
const legacyItems = [
  ['Polygon', 'objects'],
  ['TextPoint', 'objects'],
  ['Points', 'objects'],
  ['clearScreen', 'drawing_functions'],
  ['clearLog', 'drawing_functions'],
  ['draw', 'drawing_functions'],
  ['createPolygon', 'polygon_functions'],
  ['createRandomPolygon', 'polygon_functions'],
  ['createRandom', 'points_functions'],
  ['sort', 'points_functions'],
  ['shuffle', 'points_functions'],
  ['animate', 'points_functions'],
  ['loop', 'misc_functions'],
  ['mouseDown', 'misc_functions'],
  ['getCenterAndRadius', 'misc_functions'],
] as const
/** Items added after the legacy site. */
const newItems = [
  { name: 'findIntersections', category: 'misc_functions' },
  { name: 'triangulate', category: 'misc_functions' },
  { name: 'delaunay', category: 'misc_functions' },
  { name: 'voronoi', category: 'misc_functions' },
  { name: 'kdTree', category: 'misc_functions' },
  { name: 'artGallery', category: 'misc_functions' },
  { name: 'Vector', category: 'objects' },
  { name: 'getRandomInt', category: 'points_functions' },
  { name: 'isMonotone', category: 'polygon_functions' },
  { name: 'convexHull', category: 'misc_functions' },
  { name: 'smallestEnclosingDisk', category: 'misc_functions' },
] as const
const dir = new URL('.', import.meta.url).pathname

describe('documentation entries', () => {
  test('all 15 legacy items present, in their legacy category', () => {
    expect(legacyItems).toHaveLength(15)
    for (const [name, category] of legacyItems) {
      expect(findDoc(name)?.category, name).toBe(category)
    }
    expect(docs).toHaveLength(legacyItems.length + newItems.length)
    expect(docs).toHaveLength(26)
  })

  test('findIntersections is documented with an example', () => {
    const entry = findDoc('findIntersections')
    expect(entry?.category).toBe('misc_functions')
    expect(entry?.example?.trim().length).toBeGreaterThan(0)
    expect(readFileSync(`${dir}findIntersections.mdx`, 'utf8')).toContain(entry!.example!.trim())
  })

  test('triangulate is documented with an example', () => {
    const entry = findDoc('triangulate')
    expect(entry?.category).toBe('misc_functions')
    expect(entry?.example?.trim().length).toBeGreaterThan(0)
    expect(readFileSync(`${dir}triangulate.mdx`, 'utf8')).toContain(entry!.example!.trim())
  })

  test('delaunay is documented with an example', () => {
    const entry = findDoc('delaunay')
    expect(entry?.category).toBe('misc_functions')
    expect(entry?.example?.trim().length).toBeGreaterThan(0)
    expect(readFileSync(`${dir}delaunay.mdx`, 'utf8')).toContain(entry!.example!.trim())
  })

  test('voronoi is documented with an example', () => {
    const entry = findDoc('voronoi')
    expect(entry?.category).toBe('misc_functions')
    expect(entry?.example?.trim().length).toBeGreaterThan(0)
    expect(readFileSync(`${dir}voronoi.mdx`, 'utf8')).toContain(entry!.example!.trim())
  })

  test('kdTree is documented with an example', () => {
    const entry = findDoc('kdTree')
    expect(entry?.category).toBe('misc_functions')
    expect(entry?.example?.trim().length).toBeGreaterThan(0)
    expect(readFileSync(`${dir}kdTree.mdx`, 'utf8')).toContain(entry!.example!.trim())
  })

  test('artGallery is documented with an example', () => {
    const entry = findDoc('artGallery')
    expect(entry?.category).toBe('misc_functions')
    expect(entry?.example?.trim().length).toBeGreaterThan(0)
    expect(readFileSync(`${dir}artGallery.mdx`, 'utf8')).toContain(entry!.example!.trim())
  })

  test('Vector and getRandomInt are documented with an example', () => {
    for (const [name, category] of [
      ['Vector', 'objects'],
      ['getRandomInt', 'points_functions'],
    ] as const) {
      const entry = findDoc(name)
      expect(entry?.category, name).toBe(category)
      expect(entry?.example?.trim().length, name).toBeGreaterThan(0)
      expect(readFileSync(`${dir}${name}.mdx`, 'utf8'), name).toContain(entry!.example!.trim())
    }
    const names = docs.map((d) => d.name)
    expect(names.indexOf('Vector')).toBe(names.indexOf('Points') + 1)
    expect(names.indexOf('getRandomInt')).toBe(names.indexOf('shuffle') + 1)
  })

  test('isMonotone, convexHull and smallestEnclosingDisk are documented with an example', () => {
    for (const [name, category] of [
      ['isMonotone', 'polygon_functions'],
      ['convexHull', 'misc_functions'],
      ['smallestEnclosingDisk', 'misc_functions'],
    ] as const) {
      const entry = findDoc(name)
      expect(entry?.category, name).toBe(category)
      expect(entry?.example?.trim().length, name).toBeGreaterThan(0)
      expect(readFileSync(`${dir}${name}.mdx`, 'utf8'), name).toContain(entry!.example!.trim())
    }
    const names = docs.map((d) => d.name)
    expect(names.indexOf('isMonotone')).toBe(names.indexOf('createRandomPolygon') + 1)
    expect(names.indexOf('convexHull')).toBe(names.indexOf('findIntersections') - 1)
    expect(names.indexOf('convexHull')).toBe(names.findIndex((n) => docs.find((d) => d.name === n)?.category === 'misc_functions'))
    expect(names.indexOf('smallestEnclosingDisk')).toBe(names.indexOf('getCenterAndRadius') - 1)
    expect(names.indexOf('smallestEnclosingDisk')).toBe(names.indexOf('mouseDown') + 1)
  })

  test('names are unique and case-sensitive', () => {
    expect(new Set(docs.map((d) => d.name)).size).toBe(docs.length)
    expect(findDoc('polygon')).toBeUndefined()
    expect(findDoc('Polygon')?.name).toBe('Polygon')
    expect(findDoc('../../x')).toBeUndefined()
  })

  test('every category has a title and items', () => {
    expect(categories.map((c) => c.title)).toEqual([
      'Objects',
      'Drawing functions',
      'Polygon functions',
      'Points functions',
      'Misc functions',
    ])
    for (const c of categories) expect(docs.some((d) => d.category === c.id), c.id).toBe(true)
  })

  test('no link_to left in any MDX file', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.mdx'))
    expect(files).toHaveLength(26)
    for (const f of files) expect(readFileSync(dir + f, 'utf8'), f).not.toContain('link_to(')
  })

  test('each example is shown in its MDX page', () => {
    for (const d of docs.filter((x) => x.example !== undefined)) {
      expect(readFileSync(`${dir}${d.name}.mdx`, 'utf8'), d.name).toContain(d.example!.trim())
    }
  })
})

/** API names that need no documentation item: paper.js, the environment, and legacy globals. */
const ALLOWED_UNDOCUMENTED: readonly string[] = [
  ...PAPER_CLASSES,
  'project',
  'view',
  'tool',
  'paper',
  'console',
  'document',
  'polygon',
  'colors',
]
/** Names not documented yet; the task that documents a name removes it here. */
const PENDING: string[] = [
  'dualPoint',
  'dualLine',
  'findStabber',
  'getTextPoint',
  'origin',
  'drawables',
  'convertToRealCoord',
]
/** Names that are values, not functions: inline code (`origin`) documents them. */
const VALUE_NAMES = ['origin', 'drawables']

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The MDX text without the lines of fenced code blocks (fences included). */
function proseLines(mdx: string): string[] {
  const out: string[] = []
  let fence: { char: string; length: number } | null = null
  for (const line of mdx.split('\n')) {
    const m = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence === null) {
      if (m) fence = { char: m[1][0], length: m[1].length }
      else out.push(line)
    } else if (m && m[1][0] === fence.char && m[1].length >= fence.length && /^\s*[`~]+\s*$/.test(line)) {
      fence = null
    }
  }
  return out
}

/**
 * True when `mdx` has a definition line for `name`: a heading, list item or paragraph that starts
 * with `name(` or `name.` (optionally in inline code), as the documentation items do. `Object.name(`
 * documents `Object`, not a global `name`: `### Points.drawLine(p1, p2)` does not document `drawLine`.
 * For the values `origin` and `drawables`, inline code anywhere outside code blocks counts too.
 */
function isDocumentedIn(name: string, mdx: string): boolean {
  const n = escapeRegExp(name)
  const definition = new RegExp(`^(#{1,6} +|- +)?\`?(${n}\\(|${n}\\.[A-Za-z_$])`)
  const lines = proseLines(mdx)
  if (lines.some((l) => definition.test(l))) return true
  return VALUE_NAMES.includes(name) && lines.some((l) => l.includes(`\`${name}\``))
}

const mdxTexts = readdirSync(dir)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => readFileSync(dir + f, 'utf8'))
const isDocumented = (name: string) => findDoc(name) !== undefined || mdxTexts.some((t) => isDocumentedIn(name, t))

describe('API coverage', () => {
  test('every API name is documented', () => {
    const undocumented = API_NAMES.filter(
      (n) => !ALLOWED_UNDOCUMENTED.includes(n) && !PENDING.includes(n) && !isDocumented(n),
    )
    expect(undocumented, 'undocumented API names: ' + undocumented.join(', ')).toEqual([])
  })

  test('pending names are really undocumented', () => {
    for (const n of PENDING) expect(API_NAMES as readonly string[], n).toContain(n)
    expect(PENDING.filter(isDocumented), 'documented, remove from PENDING').toEqual([])
  })

  test('a prose or code-block mention does not count', () => {
    expect(isDocumentedIn('drawLine', 'We call drawLine(a, b) here.')).toBe(false)
    expect(isDocumentedIn('drawLine', '```js\ndrawLine(a, b);\n```')).toBe(false)
    expect(isDocumentedIn('drawLine', '### drawLine(p1, p2)')).toBe(true)
    expect(isDocumentedIn('rangeQuery', '- `rangeQuery(points, tree, rect)` returns')).toBe(true)
    expect(isDocumentedIn('Segments', '- `Segments.createRandom(n)` creates')).toBe(true)
    // Object.name( documents Object only, not a global function of the same name
    expect(isDocumentedIn('drawLine', '### Points.drawLine(p1, p2)')).toBe(false)
    expect(isDocumentedIn('drawLines', '### Points.drawLines(points)')).toBe(false)
    expect(isDocumentedIn('createRandom', '- `Segments.createRandom(n)` creates')).toBe(false)
    // a code block closes only on a fence of the same character, at least as long
    expect(isDocumentedIn('drawLine', '```js\n~~~\n### drawLine(a)\n```')).toBe(false)
    expect(isDocumentedIn('drawLine', '````js\n```\n### drawLine(a)\n````')).toBe(false)
    expect(isDocumentedIn('drawLine', '```js\nx\n```\n### drawLine(a)')).toBe(true)
    // prose that merely ends a sentence with the name is not a definition
    expect(isDocumentedIn('add', 'add. This adds two points.')).toBe(false)
    expect(isDocumentedIn('add', '- `add.apply(null, args)` calls it')).toBe(true)
    // a longer name with the same prefix is not a definition
    expect(isDocumentedIn('drawLine', '### drawLines(points)')).toBe(false)
    // values: inline code counts, prose and code blocks do not
    expect(isDocumentedIn('origin', 'The `origin` is the point (0, 0).')).toBe(true)
    expect(isDocumentedIn('origin', 'Draws a dot at the origin.')).toBe(false)
    expect(isDocumentedIn('origin', '```js\nprint(`origin`)\n```')).toBe(false)
    expect(isDocumentedIn('drawLine', 'Use `drawLine`.')).toBe(false)
  })
})
