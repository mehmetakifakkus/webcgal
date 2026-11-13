# Range Tree page — design

Date: 2026-11-13. Status: approved in conversation (scope A; sections 1–3).

## 1. Goal and context

A new algorithm page for the 2-D range tree of de Berg et al., *Computational Geometry: Algorithms and Applications*, 3rd ed., §5.3, as the follow-up to the kd-Tree Range Search page (§5.2). A step-by-step player shows the build (main tree on x, an associated tree on y at every node) and the query (split node, two search paths, a 1-D query in the associated tree of every canonical subtree). Fractional cascading (§5.6) is a later round, not part of this one.

Conventions that carry over from the kd-tree page (`src/geometry/algorithms/kdtree/`, `src/players/kdTreePlayer.ts`, `src/engine/kdTree.ts`):

- Composite-number order (§5.5): on the x axis points compare by (x, y), on the y axis by (y, x), and coincident points by index. So ties and duplicates need no special handling and every drag gives a valid input.
- Modes "Build and query", "Build only", "Query only".
- Rectangle corner handles that stop at the opposite corner, offset by 1 so they never stick.
- The closed query rectangle `{ x0, y0, x1, y1 }`, normalized.
- Read-only API results with input indices and prefixed error messages.

The canvas is drawn with y pointing up (origin bottom-left), as on every page.

## 2. Geometry module (`src/geometry/algorithms/rangetree/`)

### 2.1 Types and build (`rangeTree.ts`)

- A 1-D tree (`Tree1D`) is the leaf-based balanced binary search tree of §5.1 on one axis.
  - It stores the points in its leaves, in composite order for that axis.
  - An internal node stores `value`, the largest key in its left subtree, as the coordinate on that axis.
  - The left subtree gets ⌈m/2⌉ of the m points.
  - Nodes have stable ids in pre-order.
- `rangeTree(points: Pt[]): RangeTree` builds the main tree on x the same way. Every main-tree node (leaves included) has `assoc: Tree1D` on y over the points in its subtree.
- `RangeTree = { root, nodes, depth, storage }`:
  - `nodes` lists the main-tree nodes in pre-order, with ids `v1`, `v2`, … for internal nodes and the point labels for leaves.
  - `depth` is the depth of the deepest leaf.
  - `storage` is the total number of leaves over all associated trees. For n a power of two it is n·(depth + 1).
- An empty point set gives `root = null`, `depth = 0`, `storage = 0`.

### 2.2 Queries (`search.ts`)

- `oneDRangeQuery(tree: Tree1D, lo, hi): { split, pathLo, pathHi, reported: nodeIds, checkedLeaves, result }` follows 1DRangeQuery of §5.1. It finds the split node, walks to `lo` and reports the right subtrees hanging off that path, walks to `hi` and reports the left subtrees, and checks the two end leaves directly. `result` is the sorted point indices.
- `rangeQuery2D(tree: RangeTree, rect, record?)` follows 2DRangeQuery of §5.3:
  1. Find the split node on x.
  2. Walk the path to x. At each node where the path goes left, run `oneDRangeQuery` on y in the `assoc` of the right child (a *canonical subtree*).
  3. Walk the path to x′ symmetrically.
  4. Check the two end leaves against the whole rectangle.

  The result is `{ reported: number[] (sorted), canonical: nodeIds, checkedLeaves, assocQueries }`.

### 2.3 Verification and tests

The tests check:

- the result equals a brute-force check of every point against the closed rectangle, on many random sets, including ties, duplicate points, n = 0, 1 and 2, and rectangles of zero width or height;
- the structure:
  - the main tree and every associated tree are balanced (left gets ⌈m/2⌉);
  - leaves are in composite order;
  - every `assoc` holds exactly its subtree's points in y-composite order;
  - `storage` equals the sum of associated leaves;
- the canonical subtrees are pairwise disjoint, at most two per level of the main tree, and lie inside the x-slab, and the union of their associated query results with the qualifying checked leaves is the answer.

## 3. Steps and state

### 3.1 Pseudocode (`pseudocode.ts`)

Two blocks with headings, following the book:

- **Build2DRangeTree(P)**, about 7 lines:
  1. build T_assoc on P by y;
  2. if |P| = 1, a leaf;
  3. otherwise split at x_mid, the median by composite x;
  4. recurse on P_left and P_right;
  5. make v with its children;
  6. T_assoc(v);
  7. return v.
- **2DRangeQuery(T, [x : x′] × [y : y′])**, about 12 lines:
  1. FindSplitNode;
  2. if v_split is a leaf, check it;
  3. otherwise, on the path to x: if x ≤ x_v, run 1DRangeQuery(T_assoc(rc(v)), [y : y′]) and go left, else go right;
  4. check the leaf at the end;
  5. the symmetric path to x′.

The exact lines are fixed in the plan; the line numbers the recorder uses come from them.

### 3.2 State (`rtState.ts`)

The state of a step:

- `phase` (`'build' | 'query'`) and `mode`;
- `current` (a main-tree node id);
- `assocShown` (the main-tree node whose associated tree is drawn, or null);
- `assocPaths` (the two y search paths and the reported nodes in that tree);
- `pathLo` and `pathHi` (main-tree node ids so far);
- `split`;
- `canonical` (node ids so far);
- `reported` (point indices so far);
- `checked` (point indices tested one by one);
- `builtUpTo` (number of main nodes built);
- `counts` (`{ nodes, storage, depth, assocQueries }`).

Each step is `structuredClone({ ...ctx, ...patch })`, as in the earlier rounds.

### 3.3 Step descriptions

Templates (computed values are pinned in tests, as in earlier rounds):

- Build, internal node: "Node v3: 6 points, associated tree on y with 6 leaves; split at x = 210 (3 left, 3 right)".
- Build, leaf: "Leaf p5: associated tree with 1 leaf".
- Build done (the last build step's description ends with the totals): "… · main tree 23 nodes, associated trees 56 leaves".
- Query, split node: "Split node v1: x = 130 and x′ = 370 go different ways" (or "Split node is the leaf p4" when they don't part).
- Query, path step: "v2: x = 130 ≤ 175, the right subtree v5 lies in the slab → query its associated tree" / "v4: x = 130 > 95, go right".
- Query, associated query: "1DRangeQuery(T_assoc(v5), [100 : 280]): reports p3, p7, p9" (or "reports nothing").
- Query, end leaf: "Leaf p2: inside the rectangle, reported" / "Leaf p8: outside".
- Done: "Done: 4 points reported, 3 associated queries".

Labels: points `p1…pn` (1-based), internal nodes `v1…` (pre-order, 1-based).

### 3.4 Modes and step generator (`rtSteps.ts`)

`rtSteps(input, mode)`:

- `full`: 2n − 1 build steps, then the query steps.
- `build`: the build steps only.
- `query`: the query steps only, starting from the built tree.

The query never visits build steps.

### 3.5 Presets (`presets.ts`)

Six presets, each with `expected: { reported, canonical, assocQueries, nodes, storage, depth }` pinned from the code:

1. Textbook example. The kd-tree page's Textbook points, mapped into this canvas's plane area, with its query mapped too, so the two pages can be compared.
2. Square grid 4×4.
3. Clusters.
4. Thin vertical strip: a query that is narrow in x and tall in y over about 14 points, so it has many canonical subtrees.
5. Query covers everything.
6. Empty query.

All points lie in the plane area (§4.1) with a margin of at least 15. The random input is 8–16 points with a random rectangle in the plane area.

## 4. Player (`src/players/rangeTreePlayer.ts`)

### 4.1 Canvas: one 775×480 canvas

- **Plane area (left, x 15–355, y 15–465):** the points, labelled `p1…`, and the query rectangle.
  - Build phase: the current node's points are filled, and its split line is drawn vertically through the plane area.
  - Query phase: the x-slab [x : x′] is shaded, and reported points are green.
- **Main tree (top right, about x 380–765, y 250–465):** circles for internal nodes labelled `v#`, and leaves drawn as points labelled with their `p#`.
  - The current node is orange, nodes on the search paths blue, and canonical nodes green.
  - Unbuilt nodes are faint in the build phase.
- **Associated tree (bottom right, below a thin divider, y 15–235):** the y-tree of `assocShown`, titled "T_assoc(v5) on y" with the same drawing rules; in the query phase its search paths and reported leaves are highlighted. With nothing to show, a light line reads "No associated tree selected".
- Positions are computed from the tree shape, with leaves evenly spaced, so the drawing is deterministic.

### 4.2 Handles

- "Build and query" and "Build only": point handles.
- "Build and query" and "Query only": two rectangle corner handles. They behave as on the kd-tree page: a corner stops at the opposite one and is offset by 1.

### 4.3 Panels and texts

- **"Node":** the current node, its x-range, its number of points, and its associated leaves in y order.
- **"Result":** the reported points, the number of canonical subtrees, the number of associated queries, and the leaves checked one by one.
- **"Storage":**
  - "n = 12 · main tree 23 nodes · associated trees 56 leaves ≤ n·(depth + 1) = 60" (each point is stored once per main-tree node on its root path; the bound is reached when n is a power of two, where the text reads "= n·(depth + 1)");
  - a second row comparing with a kd-tree: "a kd-tree stores n = 12 points once".
- Empty texts: "No node yet", "Nothing reported yet".
- **Hint:** "Drag the points or the corners of the query rectangle. Keys: ← → to step, Space to play or pause."

### 4.4 Colours

New tokens, identical in the light and dark theme blocks:

| Token | Value |
|---|---|
| `--rt-current` | `#e66100` |
| `--rt-path` | `#1a5fb4` |
| `--rt-canonical` | `#26a269` |
| `--rt-slab` | `#99c1f1` (drawn at low alpha) |
| `--rt-faint` | `#c0bfbc` |

## 5. Page, API, documentation, tests and release

### 5.1 Page and registry

- **Registry entry:** slug `rangeTree`, path `/algorithms/rangeTree`, name "Range Tree", right after kd-Tree Range Search.
  - Summary: "Build a 2-D range tree (a tree on x with an associated tree on y at every node) and answer a rectangular range query in O(log² n + k), step by step."
  - One canvas, 775×480.
  - That makes 12 cards.
- **Thumbnail** `public/images/rangeTree_tn.png` from the "Textbook example" at its last step, via a `thumbnail:rangeTree` npm script.
- **Page text (`src/content/algorithms/rangeTree/index.mdx`), §5.3:**
  - the motivation, and the kd-tree's O(√n + k) query and O(n) storage;
  - associated structures;
  - Build2DRangeTree and its O(n log n) time with presorted lists;
  - why storage is O(n log n): each point is in one associated structure per level of the main tree;
  - 2DRangeQuery and why it takes O(log² n + k): O(log n) canonical subtrees, each queried in O(log n + k_v);
  - one sentence each on higher dimensions (O(logᵈ n + k), O(n logᵈ⁻¹ n) storage) and on fractional cascading (§5.6, O(log n + k)) as an outlook;
  - a link to the kd-tree page for the 1-D query, which is explained there.

  Every claim is checked against the book. No theorem numbers unless verified.
- **Demo (`demo.js`):** random points, `rangeTree`, a rectangle, `rangeTreeQuery`, `drawRangeTree`. It prints one line matching `/^\d+ point\(s\) in the range, storage \d+$/`.

### 5.2 API (`src/engine/rangeTree.ts`, names added to `API_NAMES`)

- **`rangeTree(points)`** returns a frozen `{ root, depth, size, storage }`.
  - An internal node is `{ value, left, right, assoc }`, and a leaf is `{ point, assoc }`, where `point` is the 0-based input index.
  - `assoc` is a frozen 1-D tree of the same leaf/internal shape with `value` on y.
- **`rangeTreeQuery(points, tree, rect)`** returns the sorted indices in the closed rectangle. `rect` is `{ x0, y0, x1, y1 }` or two points.
- **`drawRangeTree(points, tree, color = 'black')`** draws the main tree's split lines in the plane, as `drawKdTree` does for the kd-tree.
- **Input validation** follows `src/engine/kdTree.ts`:
  - "rangeTree: expected an array of points (item N is not a point)" and "(got <type>)";
  - "rangeTreeQuery: expected the result of rangeTree(points) for the same points";
  - "rangeTreeQuery: expected a rectangle {x0, y0, x1, y1} or two points";
  - the same messages with the `drawRangeTree:` prefix.
- The tree check verifies that every point is in exactly one leaf and in each associated tree on its root path; it does not rebuild the tree.

### 5.3 Documentation and README

- A docs item `rangeTree` in `misc_functions`, right after `kdTree`, with a "Try it" example equal to the demo. That makes 29 items, 23 with "Try it".
- The API coverage test (`docs.test.ts`) must pass, so all three names need definition lines.
- README: the feature and player paragraph (de Berg §5.3), the project structure line, `thumbnail:rangeTree`, and the live sub-path e2e example.

### 5.4 Tests

- **Geometry:** §2.3, plus the steps:
  - 2n − 1 build steps;
  - line numbers valid and never a heading;
  - `full` = `build` steps followed by `query` steps;
  - snapshots independent;
  - the last query step's `reported` equals `rangeQuery2D`;
  - preset expectations pinned.
- **Player (browser):**
  - render is pure;
  - random input is valid;
  - corner handles stop and offset;
  - point handles exist only in modes with a build phase;
  - panels by phase.
- **API (browser runtime):**
  - every input form;
  - results frozen;
  - error messages;
  - a tree for other points is rejected;
  - the demo regex.
- **e2e (`tests/e2e/rangeTree.spec.ts`):**
  - page opens on the step tab;
  - every preset reaches its pinned done text;
  - mode switch;
  - dragging a rectangle corner changes the result;
  - the Code tab runs the demo.
- **Existing counts:** cards 11 → 12, docs 28 → 29, "Try it" 22 → 23. `scripts/pages-postbuild.test.mjs` follows the registry.
- **Sub-path:** smoke, home and rangeTree e2e under `/webcgal/`.

## 6. Out of scope

- Fractional cascading / layered range trees (§5.6): a later round.
- A node-by-node expansion of each 1-D associated query (option C, which can be added later).
- Changing the kd-tree page.

## 7. Risks

- A crowded canvas at n = 16: the main tree has 31 nodes in about 385×215 px. Leaves are evenly spaced (about 24 px apart), and labels are 9–10 px. Check screenshots at n = 16 before the PR.
- Composite order on y in the associated trees must match the main tree's tie rules, or the canonical-subtree test fails on duplicates. Test duplicates explicitly.
- 775×480 is taller than the other pages' canvases. Check the page at 375 px (canvas scaled down) and the thumbnail crop.
