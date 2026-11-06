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
const dir = new URL('.', import.meta.url).pathname

describe('documentation entries', () => {
  test('all 15 legacy items present, in their legacy category', () => {
    expect(legacyItems).toHaveLength(15)
    for (const [name, category] of legacyItems) {
      expect(findDoc(name)?.category, name).toBe(category)
    }
    expect(docs).toHaveLength(15)
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
    expect(files).toHaveLength(15)
    for (const f of files) expect(readFileSync(dir + f, 'utf8'), f).not.toContain('link_to(')
  })

  test('each example is shown in its MDX page', () => {
    for (const d of docs.filter((x) => x.example !== undefined)) {
      expect(readFileSync(`${dir}${d.name}.mdx`, 'utf8'), d.name).toContain(d.example!.trim())
    }
  })
})
