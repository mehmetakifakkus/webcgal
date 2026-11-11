# Documentation Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every callable or readable name in `API_NAMES` is documented, enforced by a test, with 7 new documentation items (28 in all, 22 with "Try it").

**Architecture:** Content-only change: MDX items in `src/content/docs/`, example files in `src/content/docs/examples/`, entries in `src/content/docs/index.ts`. A node test reads the MDX as text to check coverage; browser tests run the examples and pin the documented behaviour. No engine behaviour changes.

**Tech Stack:** Vite 8, React 19, TypeScript, MDX, paper.js 0.17, Vitest 5 (node + browser projects), Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-11-11-documentation-pass-design.md`

## Global Constraints

- No behaviour change in `src/engine/` or `src/geometry/`; legacy quirks are documented as they are (spec §5). If the code disagrees with a spec §5 fact, the code wins: document the code and report the difference.
- Item names, categories and menu order exactly as spec §3.1 (final `misc_functions` order: `convexHull`, `findIntersections`, `triangulate`, `delaunay`, `voronoi`, `kdTree`, `artGallery`, `findStabber`, `loop`, `mouseDown`, `smallestEnclosingDisk`, `getCenterAndRadius`, `getTextPoint`).
- Each new item follows `kdTree.mdx`'s structure (spec §4); MDX prose escapes `{`, `}` and `<`; algorithm items link to the algorithm page with an app-relative link (e.g. `[Convex Hull](/algorithms/convexHull)`).
- Each new item has an example file whose code also appears verbatim in its MDX (the existing test "each example is shown in its MDX page" enforces this).
- Verification per task: `npm test`, `npx tsc -b`, `npm run build` (no warnings, bundle check ok), `npm run e2e -- --trace off tests/e2e/docs.spec.ts`. Playwright/Chromium are installed; never run `playwright install`.
- Commit trailer, verbatim, after a blank line:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GDn6v79cMSt4qkDVCWkMfK
  ```
- Branch `claude/admiring-mendel-0muoxd`.

## Review Focus

1. A name mentioned only in prose or only inside a code block passing the coverage test: the test must require a definition line (the matcher in Task 1), except for `origin` and `drawables` (inline code). Task 1 pins this with negative cases.
2. Random examples that print different line shapes on different runs (e.g. `findStabber` finding or not finding a line): every example's regex must accept every possible outcome; Task 1's harness runs each example 5 times.
3. A documented fact drifting from the code later: Task 1's facts tests pin the spec §5 values that are easy to get wrong.
4. An MDX brace or `<` breaking the build or rendering as JSX: covered by `npm run build` and the e2e "every documentation page opens without console errors", which must include the new items (each task adds its items to the e2e `items` list).
5. The narrow-screen documentation select with 28 items: the existing e2e "on a narrow screen the sidebar is a select" must still pass after Task 4 (no change expected; verify).

---

### Task 1: Coverage test, facts tests, additions to existing items

**Files:**
- Modify: `src/content/docs/docs.test.ts`, `src/content/docs/docs.browser.test.ts`, `src/engine/runtime.browser.test.ts`, `src/content/docs/draw.mdx`, `src/content/docs/clearLog.mdx`, `src/content/docs/clearScreen.mdx`, `src/content/docs/getCenterAndRadius.mdx`

**Interfaces:**
- Produces in `docs.test.ts`: `const ALLOWED_UNDOCUMENTED` (spec §7 allow-list: `...PAPER_CLASSES`, `project`, `view`, `tool`, `paper`, `console`, `document`, `polygon`, `colors`) and `const PENDING: string[]` — names not yet documented, which Tasks 2–4 remove as they document them: `Vector`, `add`, `subtract`, `dotProduct`, `crossProduct`, `getRandomInt`, `range`, `isMonotone`, `monotoneDirections`, `convexHull`, `convexHullPts`, `isLeftTurn`, `smallestEnclosingDisk`, `miniDisc`, `inCircle`, `dualPoint`, `dualLine`, `findStabber`, `getTextPoint`, `origin`, `drawables`, `convertToRealCoord`. Export `PAPER_CLASSES` from `src/engine/api.ts` if it is not exported (export-only change).
- Produces in `docs.browser.test.ts`: `const EXAMPLE_OUTPUT: Record<string, RegExp>`; for every docs entry with a key there, its example (run 5 times) prints exactly one log line matching the regex. Tasks 2–4 add their keys.

- [ ] **Step 1: Write the failing tests**
  - `docs.test.ts` → `test('every API name is documented')`: for each name in `API_NAMES` not in `ALLOWED_UNDOCUMENTED` or `PENDING`, `isDocumented(name)` is true, where `isDocumented` = an item has that name, or some `.mdx` has a *definition line*: a line matching ``^(#{1,6} +|- +)?`?(NAME\(|NAME\.|[A-Za-z]+\.NAME\()`` (with NAME regex-escaped) — this is the house style: headings like `### Points.drawLine(p1, p2)`, list items like ``- `rangeQuery(points, tree, rect)` returns…``, paragraphs starting ``` `bruteForceIntersections(segments)` returns…```, and ``- `Segments.createRandom(n, minLen)` …``; or for `origin`/`drawables` the text contains `` `origin` `` / `` `drawables` ``. Lines inside ``` fenced code blocks are ignored. Message lists the undocumented names.
  - `test('pending names are really undocumented')`: every `PENDING` name has `isDocumented(name) === false` (so a task that documents a name must remove it).
  - `test('a prose or code-block mention does not count')`: with a pure helper `isDocumentedIn(name, mdxText)`: `'We call drawLine(a, b) here.'` → false; a fenced ```js block containing `drawLine(a, b);` → false; `'### drawLine(p1, p2)'` → true; ``'- `rangeQuery(points, tree, rect)` returns'`` → true; ``'- `Segments.createRandom(n)` creates'`` for `Segments` → true.
  - `runtime.browser.test.ts` → `describe('documented facts')`, run through `run(...)` like the existing API tests: `range(0, 10, 3)` → `[0, 3, 6, 9, 12]`; `range(0, 3)` → `[0, 1, 2, 3]`; `inCircle([0,0], 5, [3,0])` → `-2`, on the circle `0`, outside positive; `miniDisc(pts).center instanceof paper.Point` and `smallestEnclosingDisk(pts).center` is a plain `{x, y}` with the same coordinates (within 1e-9) and radius; `convexHull(textPoints)` last === first and `convexHullPts(...)` length is one less, same order; `dualPoint(dualLine([3, 4]))` → `{x: 3, y: 4}`; `dualLine([2, 5])` → `{slope: 2, intercept: -5}`; `findStabber([[[0,0],[0,1]], [[1,5],[1,6]], [[2,0],[2,1]]])` → `null` and a stabbable set returns a line that meets every segment; `getTextPoint` exact name beats prefix, prefix match works, unknown → `undefined`; `getRandomInt(3, 4)` is always 3 (20 draws); `isLeftTurn([[0,0],[1,0],[1,1]])` true and `([[0,0],[1,0],[1,-1]])` false; `convertToRealCoord([1, 2])` → (50, 100); `printLog === print` and `clear === clearScreen`.
- [ ] **Step 2:** Run `npx vitest run --project node src/content/docs` → `every API name is documented` FAILS listing `drawLine`, `drawLines`, `drawCoordinateSystem`, `print`, `printLog`, `clear` `getCenterAndRadius2`, `getCenterAndRadius3` (only used in code blocks today), and any name the spec missed — add such a name to `PENDING` only if a later task's item covers it per spec §3; otherwise document it in this task and report it. Facts tests: they characterise existing behaviour and should pass; a failing fact means the spec is wrong — report it, fix the test to the code's value.
- [ ] **Step 3: Add the headings** (spec §3.2): in `draw.mdx` `### drawLine(p1, p2)`, `### drawLines(points)`, `### drawCoordinateSystem()` with the global-form sentence and the coordinate-system description (check the grid extent in `src/engine/drawing.ts`); in `clearLog.mdx` `### print(...values)` naming `printLog`; in `clearScreen.mdx` a sentence naming `clear()` and a `### clear()` heading; in `getCenterAndRadius.mdx` headings `### getCenterAndRadius2(p1, p2)` and `### getCenterAndRadius3(p1, p2, p3)` above the existing examples (check the returned shape in `src/engine/api.ts`).
- [ ] **Step 4:** `npm test`, `npx tsc -b`, `npm run build` → PASS.
- [ ] **Step 5: Commit** `test(docs): API coverage and documented-facts tests; document global drawing and print helpers`

### Task 2: `Vector` and `getRandomInt` items

**Files:**
- Create: `src/content/docs/Vector.mdx`, `examples/Vector.js`, `getRandomInt.mdx`, `examples/getRandomInt.js`
- Modify: `src/content/docs/index.ts` (`Vector` in `objects` after `Points`; `getRandomInt` in `points_functions` after `shuffle`), `docs.test.ts` (`newItems`, counts 23 items / 23 MDX files, remove the 7 names from `PENDING`), `docs.browser.test.ts` (`EXAMPLE_OUTPUT` keys), `tests/e2e/docs.spec.ts` (`items` list in menu order; count test "23 pages, "Try it" on exactly 17")

**Interfaces:** Consumes Task 1's `PENDING`, `EXAMPLE_OUTPUT`.

- [ ] **Step 1: Tests first:** add `Vector` → `/^sum \(-?\d+, -?\d+\) · dot -?\d+ · cross -?\d+$/` and `getRandomInt` → `/^\d+ circles$/` to `EXAMPLE_OUTPUT`; `test('Vector and getRandomInt are documented with an example')` in the style of the existing per-item tests; remove `Vector`, `add`, `subtract`, `dotProduct`, `crossProduct`, `getRandomInt`, `range` from `PENDING`; update counts. Run → FAIL.
- [ ] **Step 2: Write the items** from spec §4–§5: `Vector` (constructor, `Point` methods and operators, `draw()`; headings `### add(p1, p2)`, `### subtract(p1, p2)`, `### dotProduct(v1, v2)`, `### crossProduct(v1, v2)`; Note that `dotProduct`/`crossProduct` need `{x, y}` objects); `getRandomInt` (`### getRandomInt(min, max)`, `### range(start, stop, step)` with the overshoot Note and the `range(0, 10, 3)` example). Examples per spec §6.
- [ ] **Step 3:** Verify (Global Constraints) → PASS.
- [ ] **Step 4: Commit** `docs: Vector and getRandomInt items`

### Task 3: `convexHull`, `isMonotone`, `smallestEnclosingDisk` items

**Files:**
- Create: `convexHull.mdx`, `isMonotone.mdx`, `smallestEnclosingDisk.mdx` and their `examples/*.js`
- Modify: `index.ts` (`convexHull` first in `misc_functions`; `isMonotone` in `polygon_functions` after `createRandomPolygon`; `smallestEnclosingDisk` in `misc_functions` before `getCenterAndRadius`), `docs.test.ts` (counts 26, `PENDING` minus `convexHull`, `convexHullPts`, `isLeftTurn`, `isMonotone`, `monotoneDirections`, `smallestEnclosingDisk`, `miniDisc`, `inCircle`), `docs.browser.test.ts`, `tests/e2e/docs.spec.ts` (26 / 20)

- [ ] **Step 1: Tests first:** `EXAMPLE_OUTPUT`: `convexHull` → `/^\d+ of \d+ points on the hull$/`, `isMonotone` → `/^monotone directions: .+$/`, `smallestEnclosingDisk` → `/^radius \d+(\.\d+)? · \d+ points inside$/`; per-item example tests; counts; `PENDING`. Run → FAIL.
- [ ] **Step 2: Write the items** (spec §5 facts; links `/algorithms/convexHull`, `/algorithms/L-monoton`, `/algorithms/smallestEnclosingDisk`). `smallestEnclosingDisk` example: "points inside" counts points with `inCircle(...) <= 1e-9`, so it always equals the number of points.
- [ ] **Step 3:** Verify → PASS.
- [ ] **Step 4: Commit** `docs: convexHull, isMonotone and smallestEnclosingDisk items`

### Task 4: `findStabber` and `getTextPoint` items, coverage complete, README

**Files:**
- Create: `findStabber.mdx`, `getTextPoint.mdx` and their `examples/*.js`
- Modify: `index.ts` (`findStabber` after `artGallery`; `getTextPoint` last in `misc_functions`), `docs.test.ts` (counts 28; delete `PENDING` and its test, keeping the coverage test), `docs.browser.test.ts`, `tests/e2e/docs.spec.ts` (28 / 22), `README.md` (one line: every API name is documented and a unit test enforces it)

- [ ] **Step 1: Tests first:** `EXAMPLE_OUTPUT`: `findStabber` → `/^(stabber y = .+|no stabbing line)$/`, `getTextPoint` → `/^found .+$/`; per-item tests; counts. Run → FAIL.
- [ ] **Step 2: Write the items** (spec §5; `findStabber` links `/algorithms/duality`; `getTextPoint` documents `origin` and `drawables` as inline code and has `### convertToRealCoord(p)`). The `getTextPoint` example names a `TextPoint` explicitly and finds it by a prefix.
- [ ] **Step 3:** Verify → PASS, including the narrow-screen e2e test (Review Focus 5).
- [ ] **Step 4: Commit** `docs: findStabber and getTextPoint items; every API name documented`
