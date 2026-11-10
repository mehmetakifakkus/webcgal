import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
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
] as const
const dir = new URL('.', import.meta.url).pathname

describe('documentation entries', () => {
  test('all 15 legacy items present, in their legacy category', () => {
    expect(legacyItems).toHaveLength(15)
    for (const [name, category] of legacyItems) {
      expect(findDoc(name)?.category, name).toBe(category)
    }
    expect(docs).toHaveLength(legacyItems.length + newItems.length)
    expect(docs).toHaveLength(21)
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
    expect(files).toHaveLength(21)
    for (const f of files) expect(readFileSync(dir + f, 'utf8'), f).not.toContain('link_to(')
  })

  test('each example is shown in its MDX page', () => {
    for (const d of docs.filter((x) => x.example !== undefined)) {
      expect(readFileSync(`${dir}${d.name}.mdx`, 'utf8'), d.name).toContain(d.example!.trim())
    }
  })
})
