import type { ComponentType } from 'react';
import type { PlayerModule } from './players/types';

/** A compiled MDX document (lazy-loaded). */
export type MDXModule = { default: ComponentType<Record<string, unknown>> };

/** Step-by-step player of an algorithm (added by the algorithms that have one). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlayerImport = { default: PlayerModule<any, any> };

export type CanvasSpec = { id: string; width: number; height: number; label: string };

export type AlgorithmEntry = {
  slug: string;
  path: string;
  name: string;
  group?: 'duality';
  thumbnail: string;
  summary: string;
  content: () => Promise<MDXModule>;
  demoCode: () => Promise<string>;
  player?: () => Promise<PlayerImport>;
  /**
   * Canvases of demos that draw on two canvases: the first is the main scene,
   * the others are plain canvases reached with `document.getElementById(id)`.
   * Without it the demo gets one 775x360 canvas.
   */
  canvases?: CanvasSpec[];
};

const raw = (m: { default: string }) => m.default;

/** Every algorithm page, in menu order. The list, menu and routes are built from it. */
export const algorithms: AlgorithmEntry[] = [
  {
    slug: 'convexHull',
    path: '/algorithms/convexHull',
    name: 'Convex Hull',
    thumbnail: '/images/convexHull_tn.png',
    summary: 'The well-known convex hull problem, a very basic algorithm in computational geometry.',
    content: () => import('./content/algorithms/convexHull/index.mdx'),
    demoCode: () => import('./content/algorithms/convexHull/demo.js?raw').then(raw),
    player: () => import('./players/convexHullPlayer'),
    canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
  },
  {
    slug: 'segmentIntersection',
    path: '/algorithms/segmentIntersection',
    name: 'Line Segment Intersection',
    thumbnail: '/images/segmentIntersection_tn.png',
    summary: 'Find all intersections of n line segments with a sweep line in O((n + k) log n) time.',
    content: () => import('./content/algorithms/segmentIntersection/index.mdx'),
    demoCode: () => import('./content/algorithms/segmentIntersection/demo.js?raw').then(raw),
    player: () => import('./players/sweepLinePlayer'),
    canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
  },
  {
    slug: 'triangulation',
    path: '/algorithms/triangulation',
    name: 'Polygon Triangulation',
    thumbnail: '/images/triangulation_tn.png',
    summary: 'Partition a simple polygon into y-monotone pieces with a sweep, then triangulate each piece in linear time.',
    content: () => import('./content/algorithms/triangulation/index.mdx'),
    demoCode: () => import('./content/algorithms/triangulation/demo.js?raw').then(raw),
    player: () => import('./players/triangulationPlayer'),
    canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
  },
  {
    slug: 'artGallery',
    path: '/algorithms/artGallery',
    name: 'Art Gallery Problem',
    thumbnail: '/images/artGallery_tn.png',
    summary: 'Guard any simple polygon with at most ⌊n/3⌋ cameras: triangulate, 3-colour the vertices, and use the smallest colour class.',
    content: () => import('./content/algorithms/artGallery/index.mdx'),
    demoCode: () => import('./content/algorithms/artGallery/demo.js?raw').then(raw),
    player: () => import('./players/artGalleryPlayer'),
    canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
  },
  {
    slug: 'delaunay',
    path: '/algorithms/delaunay',
    name: 'Delaunay Triangulation',
    thumbnail: '/images/delaunay_tn.png',
    summary: 'Build the Delaunay triangulation of a point set by random incremental insertion and edge flips.',
    content: () => import('./content/algorithms/delaunay/index.mdx'),
    demoCode: () => import('./content/algorithms/delaunay/demo.js?raw').then(raw),
    player: () => import('./players/delaunayPlayer'),
    canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
  },
  {
    slug: 'voronoi',
    path: '/algorithms/voronoi',
    name: 'Voronoi Diagram',
    thumbnail: '/images/voronoi_tn.png',
    summary: 'Build the Voronoi diagram of a point set from its Delaunay triangulation: circumcenters become vertices, dual edges become edges.',
    content: () => import('./content/algorithms/voronoi/index.mdx'),
    demoCode: () => import('./content/algorithms/voronoi/demo.js?raw').then(raw),
    player: () => import('./players/voronoiPlayer'),
    canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
  },
  {
    slug: 'smallestEnclosingDisk',
    path: '/algorithms/smallestEnclosingDisk',
    name: 'Smallest Enclosing Disk',
    thumbnail: '/images/smallestDisk_tn.png',
    summary: 'Find the smallest disc containing a point set by randomized incremental construction, step by step.',
    content: () => import('./content/algorithms/smallestEnclosingDisk/index.mdx'),
    demoCode: () => import('./content/algorithms/smallestEnclosingDisk/demo.js?raw').then(raw),
    player: () => import('./players/miniDiscPlayer'),
    canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
  },
  {
    slug: 'kdTree',
    path: '/algorithms/kdTree',
    name: 'kd-Tree Range Search',
    thumbnail: '/images/kdTree_tn.png',
    summary: 'Build a kd-tree by alternating median splits and answer a rectangular range query, step by step.',
    content: () => import('./content/algorithms/kdTree/index.mdx'),
    demoCode: () => import('./content/algorithms/kdTree/demo.js?raw').then(raw),
    player: () => import('./players/kdTreePlayer'),
    canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }],
  },
  {
    slug: 'L-monoton',
    path: '/algorithms/L-monoton',
    name: 'L-monotone Polygon',
    thumbnail: '/images/lmonoton_tn.png',
    summary: 'A polygon P in the plane is called monotone with respect to a straight line L. What is this L?',
    content: () => import('./content/algorithms/L-monoton/index.mdx'),
    demoCode: () => import('./content/algorithms/L-monoton/demo.js?raw').then(raw),
    canvases: [
      { id: 'canvas-1', width: 380, height: 480, label: 'Polygon Points for L-monoton' },
      { id: 'canvas-2', width: 380, height: 480, label: 'Available line direction' },
    ],
  },
  {
    slug: 'dualLine',
    path: '/algorithms/duality/dualLine',
    name: 'Dual Line',
    group: 'duality',
    thumbnail: '/images/dualLine_tn.png',
    summary: 'The dual of a 2D point as a line in the xy-coordinate system.',
    content: () => import('./content/algorithms/dualLine/index.mdx'),
    demoCode: () => import('./content/algorithms/dualLine/demo.js?raw').then(raw),
    canvases: [
      { id: 'canvas-1', width: 360, height: 480, label: 'Points on the coordinate system' },
      { id: 'canvas-2', width: 360, height: 480, label: 'Corresponding dual line' },
    ],
  },
  {
    slug: 'checkStabber',
    path: '/algorithms/duality/checkStabber',
    name: 'Check Stabber',
    group: 'duality',
    thumbnail: '/images/stabber_tn.png',
    summary: 'Is there a stabber? If the wedges intersect, there is a line that intersects all line segments.',
    content: () => import('./content/algorithms/checkStabber/index.mdx'),
    demoCode: () => import('./content/algorithms/checkStabber/demo.js?raw').then(raw),
    canvases: [
      { id: 'canvas-1', width: 360, height: 480, label: 'Line segment on the coordinate system' },
      { id: 'canvas-2', width: 360, height: 480, label: 'Corresponding Wedge' },
    ],
  },
];

/** Algorithm groups with their own index page. */
export const groups = {
  duality: { name: 'Duality', path: '/algorithms/duality' },
} as const;

export function findAlgorithm(path: string): AlgorithmEntry | undefined {
  return algorithms.find((a) => a.path === path);
}
