import type { MDXModule } from '../../registry'
import polygonExample from './examples/Polygon.js?raw'
import textPointExample from './examples/TextPoint.js?raw'
import animateExample from './examples/animate.js?raw'
import createPolygonExample from './examples/createPolygon.js?raw'
import createRandomExample from './examples/createRandom.js?raw'
import createRandomPolygonExample from './examples/createRandomPolygon.js?raw'
import drawExample from './examples/draw.js?raw'
import findIntersectionsExample from './examples/findIntersections.js?raw'
import getCenterAndRadiusExample from './examples/getCenterAndRadius.js?raw'
import mouseDownExample from './examples/mouseDown.js?raw'
import triangulateExample from './examples/triangulate.js?raw'
import delaunayExample from './examples/delaunay.js?raw'

export type DocCategory = 'objects' | 'drawing_functions' | 'polygon_functions' | 'points_functions' | 'misc_functions'

export type DocEntry = {
  /** Item name, also its URL segment (case-sensitive, as in the legacy site). */
  name: string
  category: DocCategory
  content: () => Promise<MDXModule>
  /** The item's legacy example code; items without one have no "Try it" link. */
  example?: string
}

export const categories: { id: DocCategory; title: string }[] = [
  { id: 'objects', title: 'Objects' },
  { id: 'drawing_functions', title: 'Drawing functions' },
  { id: 'polygon_functions', title: 'Polygon functions' },
  { id: 'points_functions', title: 'Points functions' },
  { id: 'misc_functions', title: 'Misc functions' },
]

/** Every documentation item, in menu order. */
export const docs: DocEntry[] = [
  { name: 'Polygon', category: 'objects', content: () => import('./Polygon.mdx'), example: polygonExample },
  { name: 'TextPoint', category: 'objects', content: () => import('./TextPoint.mdx'), example: textPointExample },
  { name: 'Points', category: 'objects', content: () => import('./Points.mdx') },
  { name: 'clearScreen', category: 'drawing_functions', content: () => import('./clearScreen.mdx') },
  { name: 'clearLog', category: 'drawing_functions', content: () => import('./clearLog.mdx') },
  { name: 'draw', category: 'drawing_functions', content: () => import('./draw.mdx'), example: drawExample },
  {
    name: 'createPolygon',
    category: 'polygon_functions',
    content: () => import('./createPolygon.mdx'),
    example: createPolygonExample,
  },
  {
    name: 'createRandomPolygon',
    category: 'polygon_functions',
    content: () => import('./createRandomPolygon.mdx'),
    example: createRandomPolygonExample,
  },
  {
    name: 'createRandom',
    category: 'points_functions',
    content: () => import('./createRandom.mdx'),
    example: createRandomExample,
  },
  { name: 'sort', category: 'points_functions', content: () => import('./sort.mdx') },
  { name: 'shuffle', category: 'points_functions', content: () => import('./shuffle.mdx') },
  { name: 'animate', category: 'points_functions', content: () => import('./animate.mdx'), example: animateExample },
  {
    name: 'findIntersections',
    category: 'misc_functions',
    content: () => import('./findIntersections.mdx'),
    example: findIntersectionsExample,
  },
  {
    name: 'triangulate',
    category: 'misc_functions',
    content: () => import('./triangulate.mdx'),
    example: triangulateExample,
  },
  {
    name: 'delaunay',
    category: 'misc_functions',
    content: () => import('./delaunay.mdx'),
    example: delaunayExample,
  },
  { name: 'loop', category: 'misc_functions', content: () => import('./loop.mdx') },
  { name: 'mouseDown', category: 'misc_functions', content: () => import('./mouseDown.mdx'), example: mouseDownExample },
  {
    name: 'getCenterAndRadius',
    category: 'misc_functions',
    content: () => import('./getCenterAndRadius.mdx'),
    example: getCenterAndRadiusExample,
  },
]

const byName = new Map(docs.map((d) => [d.name, d]))

/** Exact (case-sensitive) lookup; unknown names, including `toString` or `../x`, give undefined. */
export function findDoc(name: string | null | undefined): DocEntry | undefined {
  return name == null ? undefined : byName.get(name)
}
