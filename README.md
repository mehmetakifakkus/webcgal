# WebCgal

WebCgal is a small teaching site for computational geometry. Each algorithm
(convex hull, line segment intersection, smallest enclosing disk, monotone
polygons, point-line duality)
has a page with an explanation, a runnable demo and, for some, a step-by-step
player. The demos are written in PaperScript, so you can edit them and see the
result immediately.

Live site: https://webcgal.netlify.app

## Features

- Step-by-step players for Convex Hull and Line Segment Intersection (sweep
  line, de Berg ch. 2.1): play, step through and reset an algorithm, with the
  pseudocode line that is running highlighted. Points can be dragged. The
  segment player also has presets for degenerate cases and event-queue and
  sweep-status panels.
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
- `src/engine/` - PaperScript runtime and the API exposed to user code (`api.ts`)
- `src/engine/__fixtures__/legacy/` - code of the old site, kept to prove it still runs
- `src/components/` - shared React components (editor, runner, player, layout)
- `src/pages/` - route pages (home, algorithm, documentation, playground)
- `src/players/` - step players of the algorithms
- `src/content/` - MDX content: algorithms, API docs, playground templates
- `src/registry.ts` - the list of algorithms; menu, cards and routes derive from it
- `scripts/` - `check-bundle.mjs` and `thumbnail.mjs` (`npm run thumbnail:segmentIntersection` regenerates that algorithm's thumbnail)
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
   optionally `presets`, `panels` and `canvas`. See
   `src/players/convexHullPlayer.ts` for a minimal example and
   `src/players/sweepLinePlayer.ts` for one with panels and presets.

## Deployment

The site is deployed on Netlify (`netlify.toml`): build command
`npm run build`, publish directory `dist`. Old URLs are kept, and unknown
paths fall back to `index.html` for client-side routing; missing files under
`/assets/` answer 404 instead (a stale chunk after a redeploy makes the page
reload once).

## License

MIT, see [LICENSE](LICENSE).
