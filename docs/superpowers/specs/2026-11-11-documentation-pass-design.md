# Documentation pass: every API name documented — design

Date: 2026-11-11. Status: approved in conversation (sections 1–3).

## 1. Goal

Every name in `API_NAMES` (`src/engine/api.ts`) that a user can call or read in the playground has documentation: either a documentation item of its own, or a heading or sentence inside a related item. A unit test enforces this, so a future API name cannot ship undocumented. Behaviour does not change: legacy quirks are documented as they are.

Audience: students using the playground and the algorithm pages' Code tabs. They should be able to look up any function they see in an example.

## 2. Current state (2026-11-11, master after PR #12)

- 21 documentation items (`src/content/docs/index.ts`), 15 with a "Try it" example.
- Names with no documentation at all: `Vector`, `add`, `subtract`, `dotProduct`, `crossProduct`, `isLeftTurn`, `convexHullPts`, `inCircle`, `dualPoint`, `dualLine`, `findStabber`, `isMonotone`, `monotoneDirections`, `smallestEnclosingDisk`, `convertToRealCoord`, `origin`, `drawables`, `getTextPoint`, `printLog`.
- Names only used in examples, without a description: `convexHull`, `miniDisc`, `getRandomInt`, `range`, `clear`, and the global (non-`Points.`) forms of `drawLine`, `drawLines` and `drawCoordinateSystem`.
- Algorithm pages without a documentation item: Convex Hull, Monotone (L-monoton), Duality, Smallest Enclosing Disk.

## 3. Items

### 3.1 New items (7)

Item names are case-sensitive URL segments, as for the existing items. "Category" is the `DocCategory`; "after" fixes the menu order.

| Item | Category, after | Covers | Links to |
|---|---|---|---|
| `Vector` | `objects`, after `Points` | `Vector`, `add`, `subtract`, `dotProduct`, `crossProduct` | — |
| `getRandomInt` | `points_functions`, after `shuffle` | `getRandomInt`, `range` | — |
| `isMonotone` | `polygon_functions`, after `createRandomPolygon` | `isMonotone`, `monotoneDirections` | `/algorithms/L-monoton` |
| `convexHull` | `misc_functions`, after `findIntersections` (first algorithm item: hull comes first in the book) | `convexHull`, `convexHullPts`, `isLeftTurn` | `/algorithms/convexHull` |
| `findStabber` | `misc_functions`, after `kdTree` | `dualPoint`, `dualLine`, `findStabber` | `/algorithms/duality` |
| `smallestEnclosingDisk` | `misc_functions`, before `getCenterAndRadius` | `smallestEnclosingDisk`, `miniDisc`, `inCircle` | `/algorithms/smallestEnclosingDisk` |
| `getTextPoint` | `misc_functions`, last | `getTextPoint`, `origin`, `drawables`, `convertToRealCoord` | — |

`artGallery` keeps its place after `kdTree`; `findStabber` goes after `artGallery`.

### 3.2 Additions to existing items

- `draw`: headings `drawLine(p1, p2)`, `drawLines(points)` (the global forms; same behaviour as the `Points.` forms already documented, stated once) and `drawCoordinateSystem()` (axes through the origin, a dotted grid every 50 units over x 0–1000 and y 0–500, and the label "(0,0)").
- `clearLog`: heading `print(...values)`, with `printLog` named as the same function.
- `clearScreen`: one sentence naming `clear()` as the same function.

Totals: 28 items, 22 with "Try it" (all 7 new items have an example).

## 4. Content rules

Each new item follows the structure of `kdTree.mdx`:

1. One or two sentences: what it does, and the link to the algorithm page where there is one.
2. A `js` code block with the signature(s).
3. Accepted inputs. The legacy helpers take what the code takes: `{ x, y }`, `[x, y]`, `TextPoint`, paper `Point`, where `toPt`/`toPoint` accept them. Unlike the newer APIs, these helpers do not validate their input; the docs say nothing about error messages they do not have.
4. Return value and its fields.
5. Quirks, as a sentence starting "Note:" (section 5).
6. A short example (the same code as the item's "Try it" file, or a part of it).

Every statement is checked against the code before it is written. MDX prose escapes `{`, `}` and `<` as the other items do.

## 5. Facts to document (from the code, 2026-11-11)

- `Vector` is a paper `Point` subclass (`new Vector(x, y)`), so it has every `Point` method and works with PaperScript operators. Its `draw()` draws a red circle of radius 10 at the tip and the label "1". (A leftover `deneme()` method exists; it is not documented.)
- `add(p1, p2)` and `subtract(p1, p2)` return paper `Point`s. `dotProduct(v1, v2)` returns `v1.x·v2.x + v1.y·v2.y`. `crossProduct(v1, v2)` returns `v1.x·v2.y − v2.x·v1.y`. `dotProduct` and `crossProduct` need `{ x, y }` objects; arrays are not converted.
- `convexHull(points)` takes `TextPoint`s and returns the hull's `TextPoint`s from the leftmost point clockwise, closed (the first point repeated at the end). `convexHullPts(points)` takes any point form and returns plain `{ x, y }` objects in the same order, not closed. Collinear points on hull edges and duplicates are dropped.
- `isLeftTurn(list)` looks only at the last three points of `list` and returns true when they make a left turn (as in the legacy convex hull code). Note: with y pointing up.
- `isMonotone(polygon, angleDeg)`: `polygon` is an array of points or anything with a `points` array (a `Polygon`); true when the polygon is monotone with respect to the line at `angleDeg` degrees counter-clockwise from +x; vertex order does not matter. `monotoneDirections(polygon)` returns the sorted angle ranges `[from, to]` in degrees within [0, 180] for which it is monotone; an isolated valid angle is `[a, a]`; 180 is the same line as 0 and is not merged across.
- `dualLine(p)`: the point (a, b) becomes the line y = a·x − b, returned as `{ slope, intercept }`. `dualPoint(line)`: the line `{ slope: a, intercept: c }` becomes the point (a, −c). They are inverses.
- `findStabber(segments)`: `segments` is an array of `[a, b]` pairs; returns a non-vertical line `{ slope, intercept }` that meets every segment (endpoints count), or `null` when there is none. It tries the lines through pairs of endpoints. 0 segments give `{ slope: 0, intercept: 0 }`.
- `smallestEnclosingDisk(points)` returns `{ center: { x, y }, radius }` (randomized incremental, de Berg et al. §4.7). `miniDisc(points)` returns the same disc as `{ center: Point, radius }` with a paper `Point` centre (the legacy shape that `drawCircle` takes). An empty set gives radius 0 at the origin.
- `inCircle(center, radius, p)` returns the distance from `p` to `center` minus `radius`: negative inside, 0 on the circle, positive outside. Note: a number, not a boolean.
- `getRandomInt(min, max)` returns an integer with min ≤ value < max.
- `range(start, stop, step = 1)` returns `[start, start + step, …]` and keeps adding until the last value is at least `stop`. Note: the last value can pass `stop`: `range(0, 10, 3)` is `[0, 3, 6, 9, 12]`.
- `getTextPoint(name)` returns the `TextPoint` whose name is `name`, else the first whose name starts with `name`, else `undefined`. Unnamed points are named `_p` + id.
- `origin` is the paper `Point` (0, 0). `drawables` is the run's array of drawn items. `convertToRealCoord(p)` multiplies a point by 50 (grid units to canvas units, as used by `drawCoordinateSystem`).
- `print(...values)` writes one line to the output panel; `printLog` is the same function. `clear()` is the same function as `clearScreen()`.

The implementer re-checks each fact in the code; where the code says otherwise, the code wins and the deviation is reported.

## 6. "Try it" examples

One file per new item in `src/content/docs/examples/<item>.js`, registered in `index.ts`. Each draws something and prints one line whose format is pinned by a regular expression in the runtime test:

| Item | Draws | Prints (regex) |
|---|---|---|
| `Vector` | two vectors from the origin and their sum | `^sum \(-?\d+, -?\d+\) · dot -?\d+ · cross -?\d+$` |
| `getRandomInt` | circles of random radius on a `range` grid | `^\d+ circles$` |
| `isMonotone` | a polygon from `createPolygon` | `^monotone directions: .+$` |
| `convexHull` | random points and their hull | `^\d+ of \d+ points on the hull$` |
| `findStabber` | vertical segments and the stabbing line, or a message | `^(stabber y = .+|no stabbing line)$` |
| `smallestEnclosingDisk` | random points and the disc | `^radius \d+(\.\d+)? · \d+ points inside$` |
| `getTextPoint` | the coordinate system and a named point found by `getTextPoint` | `^found .+$` |

The exact wording may change in the plan as long as each example has one line pinned by a test.

## 7. Tests

- Coverage (node, `src/content/docs/docs.test.ts`): for every name in `API_NAMES` except an explicit allow-list (`PAPER_CLASSES`, `project`, `view`, `tool`, `paper`, `console`, `document`, `polygon`, `colors`), the name is an item name, or appears in some item's MDX as a heading containing `name(` or `.name(`, or, for the non-functions `origin` and `drawables`, as inline code. The test reads the MDX files as text.
- Counts: 28 items, 22 "Try it" (unit test and `tests/e2e/docs.spec.ts`), menu order as in section 3.1.
- Examples (browser, `src/engine/runtime.browser.test.ts` or the docs browser test): each new example runs without error and prints a line matching its regex.
- Documented facts: runtime tests pin the facts that are easy to get wrong: `range(0, 10, 3)`, the sign of `inCircle`, `miniDisc` vs `smallestEnclosingDisk` centre types, `convexHull` closed vs `convexHullPts` open, `dualPoint(dualLine(p))` equals `p`, `getTextPoint` prefix match, `findStabber` returning `null`.
- e2e: each new item opens without console errors; "Try it" opens the playground with the example.
- `scripts/pages-postbuild.test.mjs`: route count follows the docs list (no hard-coded change expected).

## 8. Out of scope

- Changing any legacy behaviour (the quirks in section 5 stay).
- Search, filters or a "getting started" page on the documentation index.
- Scaling canvas labels on small screens.

## 9. Delivery

A separate PR from `claude/admiring-mendel-0muoxd` after PR #13 is merged; README gains one line on the documentation coverage test.
