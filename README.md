# WebCgal

WebCgal is a small teaching site for computational geometry. Each algorithm
(convex hull, line segment intersection, polygon triangulation, smallest
enclosing disk, monotone polygons, point-line duality, Delaunay
triangulation, Voronoi diagram) has a page with an explanation, a runnable demo and, for some, a step-by-step
player. The demos are written in PaperScript, so you can edit them and see the
result immediately.

Live site: https://mehmetakifakkus.github.io/webcgal/ (also https://webcgal.netlify.app)

## Features

- Step-by-step players for Convex Hull, Line Segment Intersection (sweep
  line, de Berg ch. 2.1) and Polygon Triangulation (de Berg ch. 3: MakeMonotone
  + monotone triangulation): play, step through and reset an algorithm, with
  the pseudocode line that is running highlighted. Points can be dragged. The
  segment player also has presets for degenerate cases and event-queue and
  sweep-status panels. The triangulation player has the modes Full /
  Partition only / Triangulation only, presets, and draggable vertices with a
  simplicity guard. The Delaunay player (`/algorithms/delaunay`, de Berg ch. 9:
  randomized incremental insertion with the symbolic vertices p₋₁/p₋₂ and edge
  flips) has the panels Insertion order / Flip stack / Triangles, presets, and
  draggable points with a "Points must be distinct" guard. The Voronoi player
  (`/algorithms/voronoi`, de Berg ch. 7 / §9.2: the diagram is derived from the
  Delaunay triangulation by duality) has the modes With Delaunay / Voronoi
  only, the panels Vertices / Edges / Cells, presets, and draggable points.
  The Smallest Enclosing Disk player (`/algorithms/smallestEnclosingDisk`,
  de Berg §4.7: MiniDisc with its three nested procedures shown step by step)
  has the panels Call stack / Order / Disc, presets (including a deliberately
  bad order), and draggable points that keep the order.
- Live PaperScript editor on every algorithm page: edit the demo and run it.
- Playground: a free canvas with templates; the code is saved in the browser.
- API documentation of the helper objects and functions (`Polygon`,
  `TextPoint`, `Points`, `draw`, `loop`, ...) with a "Try it" link for each.

## Development

Requires Node 22.

```sh
npm install
npm run dev      # dev server
npm test         # unit tests (Vitest, node + browser projects)
npm run e2e      # end-to-end tests (Playwright; builds into dist-e2e/)
npm run build    # type-check and production build into dist/, then check:bundle
```

`npm run check:bundle` (run automatically after `npm run build`, or as
`node scripts/check-bundle.mjs <dir>`) fails if `dist/index.html` loads the
CodeMirror or paper.js chunks (they belong to the pages with a code runner
only) or if the build contains the `__webcgalDebug` test hook. The e2e tests
build with that hook into `dist-e2e/`, so `dist/` is never affected.

## Project structure

- `src/geometry/` - pure geometry (no DOM, no paper.js) with unit tests
- `src/geometry/algorithms/sweep/` - sweep-line segment intersection (event queue, status, step recorder, presets)
- `src/geometry/algorithms/triangulation/` - polygon triangulation (MakeMonotone, monotone triangulation, step recorder, presets)
- `src/geometry/algorithms/delaunay/` - Delaunay triangulation (inCircle/symbolic vertices, triangle mesh, randomized incremental algorithm, verifier, step recorder, presets)
- `src/geometry/algorithms/voronoi/` - Voronoi diagram (clipping helpers, dual construction with circumcenter merging, cells, verifier, step recorder, presets)
- `src/geometry/algorithms/minidisc/` - smallest enclosing disk (MiniDisc core with recorder, minimality verifier, step generator, presets)
- `src/engine/` - PaperScript runtime and the API exposed to user code (`api.ts`)
- `src/engine/__fixtures__/legacy/` - code of the old site, kept to prove it still runs
- `src/components/` - shared React components (editor, runner, player, layout)
- `src/pages/` - route pages (home, algorithm, documentation, playground)
- `src/players/` - step players of the algorithms
- `src/content/` - MDX content: algorithms, API docs, playground templates
- `src/registry.ts` - the list of algorithms; menu, cards and routes derive from it
- `scripts/` - `check-bundle.mjs` and `thumbnail.mjs` (`node scripts/thumbnail.mjs --slug <slug> --preset "<name>" --step <n>`; `npm run thumbnail:segmentIntersection`, `npm run thumbnail:triangulation`, `npm run thumbnail:delaunay`, `npm run thumbnail:voronoi` and `npm run thumbnail:smallestEnclosingDisk` regenerate those thumbnails)
- `tests/e2e/` - Playwright tests

## Adding a new algorithm

1. Write the pure geometry in `src/geometry/algorithms/<name>.ts` and add
   tests next to it.
2. Write the page in `src/content/algorithms/<slug>/index.mdx` and the demo
   in `src/content/algorithms/<slug>/demo.js` (PaperScript).
3. Add an entry to `src/registry.ts` with the fields `slug`, `path`, `name`,
   `group?`, `thumbnail` (an image in `public/images`), `summary`, `content`,
   `demoCode` and, for demos with two canvases, `canvases?`.
4. Optional: a step player. Create `src/players/<name>Player.ts` implementing
   `PlayerModule<S, I>` from `src/players/types.ts` and wire it with the
   `player` field of the registry entry. A module provides `computeSteps`,
   `render`, `pseudocode`, `randomInput`, `handles` and `moveHandle`, and
   optionally `presets`, `panels`, `canvas`, `modes` (with
   `computeSteps(input, mode)`), `validate`/`renderInvalid`, `dimmedLines` and
   `hint`. See `src/players/convexHullPlayer.ts` for a minimal example,
   `src/players/sweepLinePlayer.ts` for one with panels and presets and
   `src/players/triangulationPlayer.ts` for one with modes and validation.

## Deployment

Two targets are supported:

- **GitHub Pages** (`.github/workflows/pages.yml`): every push to `master`
  builds with `VITE_BASE=/webcgal/` and publishes `dist` to
  https://mehmetakifakkus.github.io/webcgal/. Pages has no server-side
  redirects, so `scripts/pages-postbuild.mjs` copies `index.html` to
  `404.html` (deep links to client-side routes), adds `.nojekyll`, and writes a
  meta-refresh stub for each legacy URL. Enable it once under Settings → Pages
  → Source: "GitHub Actions".
- **Netlify** (`netlify.toml`): build command `npm run build`, publish
  directory `dist`, served at the root. Old URLs are kept with 301 redirects,
  unknown paths fall back to `index.html`, and missing files under `/assets/`
  answer 404 instead (a stale chunk after a redeploy makes the page reload
  once).

The base path is read from `VITE_BASE` at build time (default `/`); code that
references `public/` assets by absolute path goes through `assetUrl()`, and the
router gets its `basename` from the same value.

To run the e2e smoke test against the live sub-path site (tests that need the
e2e debug hook are skipped there):

```bash
BASE_URL=https://mehmetakifakkus.github.io/webcgal/ npx playwright test tests/e2e/smoke.spec.ts tests/e2e/smallestEnclosingDisk.spec.ts --trace off
```

## License

MIT, see [LICENSE](LICENSE).
