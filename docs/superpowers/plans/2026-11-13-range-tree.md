# Range Tree Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Range Tree" algorithm page (de Berg et al. §5.3) with a step-by-step build and query player, an API (`rangeTree`, `rangeTreeQuery`, `drawRangeTree`), a documentation item and README updates.

**Architecture:** A DOM-free geometry module `src/geometry/algorithms/rangetree/` (build, 1-D and 2-D queries, recorder-driven steps, presets) feeds a `PlayerModule` in `src/players/rangeTreePlayer.ts`. The page, demo and API follow the kd-tree page (`src/geometry/algorithms/kdtree/`, `src/players/kdTreePlayer.ts`, `src/engine/kdTree.ts`, `src/content/algorithms/kdTree/`), which every task uses as its template.

**Tech Stack:** Vite 8, React 19, TypeScript, MDX, paper.js 0.17, Vitest 5 (node + browser), Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-11-13-range-tree-design.md`

## Global Constraints

- `src/geometry` stays free of DOM and paper.js. Coordinates are y-up (the canvas flips the layer; origin bottom-left).
- Reuse, do not copy:
  - from `src/geometry/algorithms/kdtree/`: `compareOn` (composite order), `inRect`, `bruteForceRange`, `plural`;
  - the rectangle normalisation and point conversion of `src/engine/kdTree.ts` / `src/engine/toPoints.ts`;
  - the corner-handle behaviour of `kdTreePlayer.ts` (`cornerHandles`, `CORNER_GAP` = 1).
- Labels: points `p1…pn`, internal main-tree nodes `v1…` in pre-order, both 1-based.
- Fixed texts:
  - modes "Build and query" / "Build only" / "Query only";
  - panel titles "Node", "Result", "Storage";
  - empty texts "No node yet", "Nothing reported yet", "No associated tree selected";
  - hint "Drag the points or the corners of the query rectangle. Keys: ← → to step, Space to play or pause."
- Colours, identical in the light and dark blocks of `src/styles/theme.css`: `--rt-current #e66100`, `--rt-path #1a5fb4`, `--rt-canonical #26a269`, `--rt-slab #99c1f1`, `--rt-faint #c0bfbc`.
- Canvas 775×480:
  - plane area x 15–355, y 15–465;
  - main tree x 380–765, y 250–465;
  - associated tree x 380–765, y 15–235.
- API:
  - names `rangeTree`, `rangeTreeQuery`, `drawRangeTree` in `API_NAMES`;
  - errors prefixed with the function name, item indices 1-based, wording as in `src/engine/kdTree.ts`;
  - results deeply frozen.
- Existing tests pass. Count updates are allowed: cards 11 → 12, docs 28 → 29, "Try it" 22 → 23. Other players are unchanged.
- Verification:
  - `npm test`, `npx tsc -b`, `npm run build` (no warnings, bundle check ok), `npm run e2e` (already passes `--trace off`);
  - for Task 4, also the `/webcgal/` sub-path run (`VITE_BASE=/webcgal/` build + `node scripts/pages-postbuild.mjs dist "/webcgal/"` + e2e with `BASE_URL`), then rebuild the root `dist`;
  - never run `playwright install`.
- Commit trailer, verbatim, after a blank line:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GDn6v79cMSt4qkDVCWkMfK
  ```
  Branch `claude/admiring-mendel-0muoxd`.

## Review Focus

1. **Duplicates and ties in the associated trees:** points with equal x, equal y, or equal x and y must still give canonical subtrees that are disjoint and whose results add up to the brute-force answer. Task 1 tests sets with heavy duplication.
2. **A query rectangle of zero width or zero height, or a rectangle outside all points:** it reports exactly the brute-force points, and the steps end with "Done: 0 points reported…" without errors. Task 1 covers the geometry, Task 2 the steps.
3. **n = 0, 1 or 2 points**, for example after the user drags until the input is degenerate, or through the API. There is no crash, and the split node is a leaf where the spec says so. Tasks 1, 2 and 4 each test it.
4. **A crowded canvas at n = 16:** labels must stay inside the canvas and not overlap other labels; the main tree has 31 nodes in about 385×215 px. Task 3 tests label bounds and minimum spacing at n = 16.
5. **The API given a tree built for other points, or a hand-made object:** it rejects them with the documented message instead of returning wrong results. Task 4 tests it.

---

### Task 1: Build and queries (geometry)

**Files:**
- Create: `src/geometry/algorithms/rangetree/rangeTree.ts`, `search.ts`, `verify.ts`
- Test: `rangeTree.test.ts`, `search.test.ts`
- Modify: `src/geometry/types.ts` (`RangeTreeInput = { points: Pt[]; query: Box }`, like `KdInput`)

**Interfaces (Produces):**
- `type Tree1DNode = { kind: 'leaf'; id: number; point: number } | { kind: 'split'; id: number; value: number; left: Tree1DNode; right: Tree1DNode }`. `value` is the largest key (on the tree's axis) in the left subtree. `id` is the pre-order number within its tree.
- `type Tree1D = { axis: 'x' | 'y'; root: Tree1DNode | null; size: number }`
- `buildTree1D(points: Pt[], indices: number[], axis: 'x' | 'y'): Tree1D`: the input order is irrelevant; it sorts by `compareOn`, and the left subtree gets ⌈m/2⌉.
- `type RTNode = { id: number; label: string; kind: 'leaf' | 'split'; point?: number; value?: number; left?: RTNode; right?: RTNode; assoc: Tree1D; depth: number; points: number[] }`
  - `points` lists the subtree's point indices in x-composite order.
  - `label` is `v#` for a split node and `p#` for a leaf.
- `type RangeTree = { root: RTNode | null; nodes: RTNode[] (pre-order); depth: number; storage: number }`
- `rangeTree(points: Pt[]): RangeTree` — no recorder in this task; Task 2 adds an optional `record` argument (pre-order: a node is recorded before its children).
- `oneDRangeQuery(points: Pt[], tree: Tree1D, lo: number, hi: number): { split: number | null; pathLo: number[]; pathHi: number[]; reported: number[] (node ids); checkedLeaves: number[] (point indices); result: number[] (sorted point indices) }`
  - It compares with the composite key on `tree.axis`.
  - A bound counts as (bound, ±∞) on the other coordinate, so the closed interval includes ties.
- `rangeQuery2D(points: Pt[], tree: RangeTree, R: Box): { split: number | null (main node id); pathLo: number[]; pathHi: number[]; canonical: number[]; assocQueries: { node: number; result: number[] }[]; checkedLeaves: number[]; reported: number[] (sorted) }`
- `checkRangeTree(points: Pt[], tree: RangeTree): { ok: true } | { ok: false; reason: string }`
  - It checks balance (left gets ⌈m/2⌉), composite order of the leaves, each `assoc` against its subtree's points in y-composite order, and `storage`.

- [ ] **Step 1: Write the failing tests**
  - `buildTree1D balances and orders`: m = 1..17. The leaves come out in `compareOn` order, every split's left subtree has ⌈m/2⌉ leaves, and `value` equals the max key of the left subtree.
  - `rangeTree structure`: `checkRangeTree(...)` is ok on 300 random sets with n ∈ [0, 20], seeded with `mulberry32`. Half of them use a 5×5 integer lattice, so they have heavy ties and duplicates.
    - `storage === Σ over leaves of (leaf.depth + 1)`.
    - For n = 12: depth 4, storage 56, 23 main nodes.
    - For n = 16: storage 80 = n·(depth + 1).
    - n = 0 gives `root null, depth 0, storage 0`.
  - `oneDRangeQuery matches brute force`: on y-trees of random sets, including `lo === hi` and `lo > all`.
  - `rangeQuery2D matches brute force`: on 500 random set/rectangle pairs, including lattice duplicates, zero-width or zero-height rectangles and rectangles outside the points. For each:
    - `reported` equals `bruteForceRange`;
    - the canonical subtrees are pairwise disjoint (no node is an ancestor of another), with at most 2 per main-tree depth;
    - every canonical node's x-range lies inside [x0, x1];
    - `⋃ assocQueries.result ∪ checkedLeaves∩R` equals `reported`.
  - `n = 1 and n = 2`: the split node is the leaf for n = 1; for n = 2, the query on one point returns that point.
- [ ] **Step 2:** `npx vitest run --project node src/geometry/algorithms/rangetree` → FAIL (modules missing).
- [ ] **Step 3: Implement.** Follow BuildTree / FindSplitNode / 1DRangeQuery / 2DRangeQuery of §5.1/§5.3 using the leaf-based trees. The 2-D path to x reports `right` children where the path goes left (`x ≤ value`, in composite terms). The path to x′ reports `left` children where it goes right.
- [ ] **Step 4:** The same command → PASS. Then `npx tsc -b`.
- [ ] **Step 5: Commit** `feat(geometry): 2-D range tree build and queries`

### Task 2: Pseudocode, state, steps, presets

**Files:**
- Create: `src/geometry/algorithms/rangetree/pseudocode.ts`, `rtState.ts`, `rtSteps.ts`, `presets.ts`
- Test: `rtSteps.test.ts`, `presets.test.ts`
- Modify: `rangeTree.ts` and `search.ts`, to add an optional `record` argument that does not change their results

**Interfaces:**
- **Consumes** Task 1.
- **Produces:**
  - `RT_PSEUDOCODE: string[]` and `PSEUDOCODE_HEADINGS: number[]`. There are two blocks per spec §3.1: Build2DRangeTree (heading + 7 lines) and 2DRangeQuery (heading + about 12 lines, with `1DRangeQuery(T_assoc(rc(v)), [y : y′])` on one line).
  - `RTState` per spec §3.2, plus `points`, `query` and `nodes` (a view list for drawing: id, label, kind, parent, depth, `points`, value).
  - `type RTMode = 'full' | 'build' | 'query'`
  - `rtSteps(input: RangeTreeInput, mode: RTMode = 'full'): Step<RTState>[]`
  - `RT_PRESETS: { name: string; input: RangeTreeInput; expected: { reported: number[]; canonical: number; assocQueries: number; nodes: number; storage: number; depth: number } }[]`, with the six names of spec §3.5 in order.

- [ ] **Step 1: Write the failing tests**
  - `pseudocode`: the two headings at the indices in `PSEUDOCODE_HEADINGS`.
  - `build steps`: exactly 2n − 1 steps in `build` mode, one per main node in pre-order. Their descriptions follow the spec §3.3 templates, and the last one ends with `main tree X nodes, associated trees S leaves`.
  - `full = build + query`: the `full` steps equal the `build` steps followed by the `query` steps.
  - `query steps`:
    - the first query step is the split node;
    - every associated query step reads `1DRangeQuery(T_assoc(vK), [lo : hi]): reports …` or `…: reports nothing`;
    - the last step reads `Done: K points reported, M associated queries`, with correct plurals, e.g. "1 point", "1 associated query";
    - `reported` in the last step equals `rangeQuery2D(...).reported`.
  - `lines valid, never a heading`; `snapshots independent` (mutating one step's state does not affect another).
  - `degenerate`: n = 0 gives no build steps and one query step "Done: 0 points reported, 0 associated queries"; n = 1 and a zero-width rectangle are handled.
  - `presets`: every preset's points lie in the plane area x 15–355, y 15–465 with a margin of 15 or more, and its query lies inside the plane area. The `expected` values match what the code computes (pinned). "Thin vertical strip" has at least 3 canonical subtrees, and "Empty query" reports `[]`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement.**
  - The recorder pattern is `emit(line, description, patch, ctx)` with ctx copies, as in `kdSteps.ts`.
  - The Textbook preset maps the kd-tree page's Textbook points from `PLANE_BOX` (15–455 × 15–345) into 15–355 × 15–465 with an affine map rounded to integers, and maps its query the same way.
  - Random input: 8–16 points (`mulberry32` not needed; take a `random` argument defaulting to `Math.random`), with a random rectangle.
- [ ] **Step 4:** `npx vitest run --project node src/geometry/algorithms/rangetree` → PASS; `npx tsc -b`.
- [ ] **Step 5: Commit** `feat(geometry): range tree steps, pseudocode and presets`

### Task 3: Player module

**Files:**
- Create: `src/players/rangeTreePlayer.ts`
- Test: `src/players/rangeTreePlayer.browser.test.ts`
- Modify: `src/styles/theme.css` (the `--rt-*` tokens)

**Interfaces:**
- **Consumes** Task 2 and `PlayerModule` (`src/players/types.ts`).
- **Produces:** a default-exported `PlayerModule<RTState, RangeTreeInput>`:
  - modes per Global Constraints;
  - `dimmedLines` for `build` covers the query block, and for `query` the build block;
  - `handles`: points in modes with a build phase, and corners in modes with a query phase, as in `kdTreePlayer`;
  - `moveHandle`, `randomInput`, `presets`, `panels`, `hint`;
  - `canvas: { width: 775, height: 480 }`, or whatever field the kd-tree player uses for its size.

- [ ] **Step 1: Write the failing tests**
  - `render is pure`;
  - `random input is valid`: 8–16 points inside the plane area, with the rectangle inside it;
  - `corner handles stop at the opposite corner and are offset by 1`: copy the kd-tree tests' cases;
  - `point handles only with a build phase`;
  - `panels by phase`: "Node" during the build, "Result" during the query, "Storage" always. The Storage row reads `n = 12 · main tree 23 nodes · associated trees 56 leaves ≤ n·(depth + 1) = 60` for a 12-point preset, and uses "=" for 16 points;
  - `associated tree drawn for assocShown`: the item named `assoc` exists and carries the title "T_assoc(vK) on y";
  - `labels fit at n = 16`: every label's bounds lie inside the canvas, and no two labels' bounds overlap by more than 2 px (Review Focus 4).
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement** per spec §4.
  - Tree layout: leaves evenly spaced in the tree box, and internal nodes at the midpoint of their children; levels are spaced by depth.
  - Build phase: unbuilt nodes faint; the current node's points filled; a split line.
  - Query phase: the slab shaded at low alpha, path nodes blue, canonical nodes green, reported points green.
  - The associated tree uses the same layout in its box, with its own search paths and reported nodes highlighted.
- [ ] **Step 4:** `npm test`, `npx tsc -b`, `npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(player): range tree player`

### Task 4: Page, registry, API, demo, thumbnail, e2e → PR

**Files:**
- Create: `src/content/algorithms/rangeTree/index.mdx`, `demo.js`, `src/engine/rangeTree.ts`, `public/images/rangeTree_tn.png`, `tests/e2e/rangeTree.spec.ts`
- Modify:
  - `src/registry.ts` (right after kdTree; one canvas 775×480) and `src/registry.test.ts`;
  - `src/engine/api.ts` (`API_NAMES` + implementations);
  - `src/engine/runtime.browser.test.ts` (`describe('range tree api')`);
  - `package.json` (`thumbnail:rangeTree`: preset "Textbook example", last step, `--pad` as needed);
  - `tests/e2e/visual.spec.ts`, `algorithms.spec.ts`, `home.spec.ts` (12 cards);
  - `scripts/pages-postbuild.test.mjs` (if needed);
  - `src/content/docs/docs.test.ts`: the coverage test fails until Task 5 documents the names. In this task, add the three names to a clearly marked temporary allow-list `AWAITING_DOCS`, and Task 5 removes it.

**Interfaces:** Spec §5.2. The API reuses Task 1 (`rangeTree`, `rangeQuery2D`, `checkRangeTree`) and converts to the frozen API shape `{ root, depth, size, storage }`, with nodes `{ value, left, right, assoc }` / `{ point, assoc }`.

- [ ] **Step 1: Write the failing tests**
  - **API (browser):**
    - the input forms `TextPoint`, `Point`, `{x,y}` and `[x,y]`;
    - n = 0, 1 and 2;
    - results frozen deeply;
    - `rangeTreeQuery` equals brute force on random sets;
    - the rectangle given as two points, in any corner order;
    - the error messages of spec §5.2;
    - a tree built for other points is rejected, and so is a hand-made `{ root: null }` for non-empty points;
    - `drawRangeTree` adds one drawable per split line;
    - the demo prints a line matching `/^\d+ point\(s\) in the range, storage \d+$/`.
  - **e2e:**
    - `page opens on the step tab`: h1 "Range Tree", the "Storage" panel, and the three mode labels;
    - `presets reach their pinned totals`: for each preset, choose it, press Last, and the description is the pinned Done text;
    - `query only skips the build`: step 1's description starts with "Split node";
    - `dragging a corner changes the result`: drag the top-right corner of the Textbook query inward and the Done text changes;
    - `code tab runs the demo`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Write the page, API, demo and registry.**
  - The MDX text covers spec §5.1, links to `/algorithms/kdTree`, and makes no unverified theorem numbers or claims.
  - Generate the thumbnail and view it: nothing may be cropped.
- [ ] **Step 4: Verify.**
  - `npm test`, `npx tsc -b`, `npm run build`, and the full `npm run e2e` → PASS.
  - The sub-path run (smoke, home, rangeTree) → PASS; then rebuild the root `dist`.
  - Screenshots at 375 and 1280 px, light and dark, viewed.
- [ ] **Step 5: Commit** `feat: range tree page, demo and API`
- [ ] **Step 6 (controller):** open the PR; send screenshots from a local `/webcgal/` build.

### Task 5: Documentation item and README

**Files:**
- Create: `src/content/docs/rangeTree.mdx`, `src/content/docs/examples/rangeTree.js` (the demo, verbatim)
- Modify:
  - `src/content/docs/index.ts` (`misc_functions`, right after `kdTree`);
  - `docs.test.ts` (29 items and 29 MDX files; a per-item test; the final misc order with `rangeTree` after `kdTree`; remove `AWAITING_DOCS`);
  - `docs.browser.test.ts` (`EXAMPLE_OUTPUT.rangeTree` = the demo regex);
  - `tests/e2e/docs.spec.ts` (items list; "29 pages, "Try it" on exactly 23");
  - `README.md` (spec §5.3).

- [ ] **Step 1:** Write the tests → FAIL.
- [ ] **Step 2: Write the item** in the style of `kdTree.mdx`.
  - Signatures, input forms, result fields (0-based indices), `rangeTreeQuery`, `drawRangeTree`, the exact error messages (read them from `src/engine/rangeTree.ts`), and a link to `[Range Tree](/algorithms/rangeTree)`.
  - Every function gets a definition line.
  - Every claim is checked in code.
- [ ] **Step 3:** `npm test`, `npm run build`, `npm run e2e -- tests/e2e/docs.spec.ts` → PASS.
- [ ] **Step 4: Commit** `docs: rangeTree API item and README`
