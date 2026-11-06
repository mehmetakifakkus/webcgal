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
    slug: 'smallestEnclosingDisk',
    path: '/algorithms/smallestEnclosingDisk',
    name: 'Smallest Enclosing Disk',
    thumbnail: '/images/smallestDisk_tn.png',
    summary: 'Finding the smallest circle that contains all of a given set of points in the Euclidean plane.',
    content: () => import('./content/algorithms/smallestEnclosingDisk/index.mdx'),
    demoCode: () => import('./content/algorithms/smallestEnclosingDisk/demo.js?raw').then(raw),
    canvases: [{ id: 'canvas-1', width: 900, height: 400, label: '' }],
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
