# Poligon Üçgenleme: Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WebCgal'e de Berg Bölüm 3'ü eklemek: MakeMonotone + TriangulateMonotonePolygon, tek sayfada iki aşamalı oynatıcı (Full / Partition only / Triangulation only), köşe sürükleme ve basitlik koruması; oynatıcıya mod ve girdi doğrulama desteği.

**Architecture:** Saf geometri `src/geometry/algorithms/triangulation/` altında (poligon yardımcıları, MakeMonotone mevcut `StatusStructure` ile, parça bölme, monoton üçgenleme, tek `triangulate` + kaydediciyle adımlar). Oynatıcıya üç isteğe bağlı ek: `modes`, `validate`/`renderInvalid`, `dimmedLines`. Yeni algoritma bir modül, içerik ve registry girdisi ekler.

**Tech Stack:** Mevcut: Vite 8, React 19, TypeScript, paper.js 0.17.0, Vitest 5 (node + browser), Playwright 1.63, MDX, Netlify.

**Spec:** `docs/superpowers/specs/2026-11-06-triangulation-design.md`. Önceki: `2026-11-06-segment-intersection-design.md` (oynatıcı, paneller, süpürme veri yapıları).

## Global Constraints

- Node 22, npm. Doğrulama: `npm test`, `npx tsc -b`, `npm run build` (uyarısız; `postbuild` bundle kontrolü geçer), `npm run e2e` (`--trace off`, `dist-e2e`).
- Koordinatlar y-yukarı; `src/geometry` DOM/paper.js'den bağımsız; kütüphane kodu PaperScript operatörü kullanmaz.
- Parça/köşe karşılaştırmaları `GEOM_TOL` (1e-7) ile; `EPS` yalnızca mevcut hull/orientation kodunda.
- Poligonlar içeride CCW; köşeler kodda 0 tabanlı, açıklama ve panellerde 1 tabanlı (`v1`, `e1` = v1→v2, `u1`). Noktalar açıklamada yuvarlanmış tam sayı.
- Sözlüksel sıra: `above(p, q)` = `p.y > q.y + GEOM_TOL` veya (`|p.y − q.y| ≤ GEOM_TOL` ve `p.x < q.x − GEOM_TOL`).
- Arayüz ve içerik İngilizce. Test-görünür metinler sabit: "Mode", "Full", "Partition only", "Triangulation only", "Event queue", "Status structure", "Pieces", "Stack", "Vertex types", "Status is empty", "Stack is empty", uyarı "The polygon must be simple (no crossing edges)", done "Done: k diagonals, m triangles" / "Done: k diagonals, m monotone pieces".
- Mevcut testler **değiştirilmeden** geçer (Convex Hull ve Line Segment Intersection dahil); kart/öğe sayıları (6 → 7 kart, 16 → 17 doc) güncellemesi izinli.
- Yeni API adları `src/engine/api.ts` `API_NAMES` listesine eklenir.
- Dal: `claude/admiring-mendel-0muoxd` (`master` + spec/plan). Commit mesajı sonu (boş satırdan sonra):
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GDn6v79cMSt4qkDVCWkMfK
  ```

## Review Focus

1. **Köşeyi bir kenarın üzerinden geçirecek şekilde sürüklemek:** uyarı görünmeli, adımlar hesaplanmamalı, bırakınca köşe son geçerli konuma dönmeli. Test: Görev 5 `validate reverts on release`, Görev 7 e2e `dragging across an edge shows the alert and reverts`.
2. **İki köşeyi aynı noktaya ya da üç köşeyi eşdoğrusal yapmak:** çökme yok; aynı nokta → basit değil (uyarı); eşdoğrusal → regular köşe, üçgenleme geçerli. Test: Görev 1 `isSimple rejects repeated vertex`, Görev 3 `collinear consecutive vertices`.
3. **Oynatma sırasında mod değiştirmek / geçersiz girdiyle mod değiştirmek:** oynatma durur, sayaç başa döner; geçersiz girdide mod menüsü devre dışı. Test: Görev 5 `mode change during playback`, `controls disabled while invalid`.
4. **Saat yönünde (CW) poligon** (Code sekmesinden): aynı üçgenleme, indeksler girdiye göre. Test: Görev 3 `clockwise input`, Görev 7 `api accepts clockwise polygon`.
5. **Çok köşe (20+):** adım sayısı sınırlı, oynatıcı donmaz. Test: Görev 4 `step count bound` (20 köşeli rastgele dahil).

---

### Görev 1: Poligon yardımcıları ve doğrulayıcı

**Files:**
- Modify: `src/geometry/types.ts` (`Polygon`, `Diagonal`, `Triangle`, `VertexType`, `TriangulationResult` — spec §2.1 aynen)
- Create: `src/geometry/algorithms/triangulation/polygon.ts`, `src/geometry/algorithms/triangulation/verify.ts`
- Test: `src/geometry/algorithms/triangulation/polygon.test.ts`, `verify.test.ts`

**Interfaces:**
- Consumes: `GEOM_TOL`, `samePt`, `segmentIntersection`, `orientation` (primitives.ts).
- Produces (`polygon.ts`): `signedArea(polygon: Polygon): number` (CCW pozitif), `ensureCCW(polygon): { polygon: Polygon; reversed: boolean }`, `isSimple(polygon): boolean`, `above(p: Pt, q: Pt): boolean`, `lexicographicOrder(polygon): number[]` (indeksler, `above` ile azalan), `isReflex(polygon, i): boolean` (CCW'de `orientation(prev, v, next) === -1`), `vertexType(polygon, i): VertexType`, `vertexTypes(polygon): VertexType[]`, `interiorToRight(polygon, i): boolean` (= `above(prev, v) && above(v, next)`; CCW poligonda sol zincirden aşağı inerken iç bölge sağdadır — kitap §3.2 "interior lies to the right").
- Produces (`verify.ts`): `pointInPolygon(p, polygon): boolean` (ray casting; kenar üstü → true), `diagonalInside(polygon, d: Diagonal): boolean` (uçlar komşu değil; orta nokta içeride; köşegen hiçbir kenarı iç noktada kesmiyor — `segmentIntersection` ile, paylaşılan uçlar hariç), `diagonalsCross(polygon, a, b): boolean`, `isValidTriangulation(polygon, diagonals): { ok: boolean; reason?: string }` (sayı n−3, her köşegen içeride, çiftler kesişmiyor, tekrar yok), `randomStarPolygon(rng: () => number, n: number, cx: number, cy: number, rMin: number, rMax: number): Polygon` (açı `2πi/n + (rng()−0.5)·0.6·2π/n`, yarıçap `rMin + rng()·(rMax−rMin)`; CCW).

- [ ] **Step 1: Write the failing tests.**
  - `polygon.test.ts`: `signedArea` kare (0,0),(4,0),(4,4),(0,4) → 16, ters → −16; `ensureCCW` CW girdiyi çevirir (`reversed: true`) ve CCW'yi bırakır; `isSimple`: kare → true, kelebek (0,0),(4,4),(4,0),(0,4) → false, tekrarlanan ardışık köşe → false, 2 köşe → false, kenar üstünde değen köşe (0,0),(4,0),(4,4),(2,0),(0,4) → false; `above`: (1,5)/(3,2) → true, (3,5)/(1,5) → false, (1,5)/(3,5) → true; `vertexType` spec'in "Textbook polygon"u (Görev 4'teki koordinatlar; bu testte sabit yazılır) için: start {v1,v9,v11,v13}, end {v3,v5,v7}, split {v4,v6}, merge {v10,v12,v14}, regular {v2,v8} (1 tabanlı); `interiorToRight` aynı poligonda v2 → true, v8 → false.
  - `verify.test.ts`: `pointInPolygon` iç/dış/kenar; `isValidTriangulation` kare + köşegen [0,2] → ok; kare + [0,1] (kenar) → not ok; kare + iki köşegen → not ok (sayı); `randomStarPolygon` 100 seed × n∈{5,12,20} → `isSimple` ve `signedArea > 0`.
- [ ] **Step 2:** `npx vitest run --project node src/geometry/algorithms/triangulation` → FAIL.
- [ ] **Step 3:** Dosyaları yaz.
- [ ] **Step 4:** Aynı komut → PASS; `npx tsc -b` temiz.
- [ ] **Step 5: Commit.** `feat(geometry): polygon helpers and triangulation verifier`

---

### Görev 2: MakeMonotone ve parça bölme

**Files:**
- Create: `src/geometry/algorithms/triangulation/makeMonotone.ts`, `split.ts`, `triangulationState.ts` (yalnızca tipler: spec §3.2 `TriangulationState`, `TriangulationMode`, `TriPatch = Partial<Pick<TriangulationState, 'current'|'edgeLeft'|'cursor'|'reported'>>`, `TriRecorder = (line, description, patch, ctx) => void`, `ctx = { phase, sweepY, queue, status, partitionDiagonals, pieces, activePiece, merged, chain, stack, triangulationDiagonals, types }`)
- Test: `makeMonotone.test.ts`, `split.test.ts`

**Interfaces:**
- Consumes: Görev 1; `StatusStructure`, `compareAt` (sweep/status.ts) — kenar i = `{ a: v_i, b: v_{i+1} }`; `isMonotone` (monotone.ts).
- Produces: `makeMonotone(polygon: Polygon, record?: TriRecorder): { diagonals: Diagonal[]; types: VertexType[] }` (girdi CCW ve basit varsayılır); `splitByDiagonals(polygon: Polygon, diagonals: Diagonal[]): number[][]` (parçalar CCW köşe indeksleri; köşegen `(a,b)` için a ve b'yi birlikte içeren parça döngüsel olarak `[a..b]` ve `[b..a]` dilimlerine bölünür).
- Kayıt noktaları (satır indeksleri Görev 4'teki sözde koda göre): 1 kuyruk, 2 T, 4 köşe çek ("Next vertex v5 (split)"), 5 prosedür seçimi ("v5 is a split vertex → HandleSplitVertex"), 7/14/24 kenar ekle ("Insert e5 into T with helper v5"), 10/17/24 kenar sil ("Delete e4 from T"), 12/18/26 sol kenar ara ("Edge directly left of v5: e2", `edgeLeft`), 9/13/16/19/23/27 köşegen ekle ("Add diagonal v5–v2", `reported`) ya da merge kontrolü sonucu ("helper(e2) = v4 is not a merge vertex"), 13/20/28 helper ata ("Set helper(e2) = v5"), 22 iç bölge testi ("Interior of P lies to the right of v2" / "…to the left of v8"). Helper'lar `Map<number, number>`; status `ctx.status` için `{ edge, helper }[]` olarak soldan sağa verilir.

- [ ] **Step 1: Write the failing tests.**
  - `makeMonotone.test.ts`: Textbook polygon → `types` Görev 1'deki gibi, `diagonals.length === 5`, her köşegen `diagonalInside`; "Already monotone" altıgen (Görev 4 koordinatları) → 0 köşegen; "Comb" → 4 köşegen; rastgele 200 yıldız poligon (seed'li mulberry32, n 5–20) → tüm köşegenler `diagonalInside` ve çiftler kesişmiyor, `splitByDiagonals` sonrası her parça `isMonotone(pieceCoords, 90)`.
  - `split.test.ts`: kare + [0,2] → iki üçgen `[0,1,2]`,`[0,2,3]` (CCW); Textbook + makeMonotone köşegenleri → parça sayısı 6 ve köşe sayıları toplamı `n + 2·k`; köşegenler hangi sırada verilirse verilsin aynı parça kümesi.
- [ ] **Step 2:** Testler → FAIL.
- [ ] **Step 3:** Yaz. `HandleRegularVertex` için `interiorToRight`; "e_j directly left" için `status.leftOf(v)`; `StatusStructure` kenarlar üzerinde `compareAt(edgesAsSegments, v)`.
- [ ] **Step 4:** PASS; `npx tsc -b` temiz.
- [ ] **Step 5: Commit.** `feat(geometry): MakeMonotone and diagonal splitting`

---

### Görev 3: Monoton üçgenleme ve `triangulate`

**Files:**
- Create: `triangulateMonotone.ts`, `triangulate.ts`
- Test: `triangulateMonotone.test.ts`, `triangulate.test.ts`

**Interfaces:**
- Consumes: Görev 1–2.
- Produces: `triangulateMonotone(polygon: Polygon, piece: number[], record?: TriRecorder): Diagonal[]` (parça y-monoton varsayılır; kayıt satırları 30–40: birleştirme "Merge the chains: u1 = v3, u2 = v9, …", yığın başlangıcı, 33 zincir karşılaştırması ("u5 = v7 and the top of the stack are on different chains"), 34/38 pop + köşegen ("Pop v9; add diagonal u5–v9", `reported`), 35/39 push, 40 son köşe köşegenleri); `triangulate(polygon: Polygon): TriangulationResult` (spec §2.6: `ensureCCW`, `isSimple` değilse `Error('polygon must be simple')`, n<3 → `Error('polygon needs at least 3 vertices')`; `reversed` ise çıktı indeksleri `n−1−i` ile girdiye geri eşlenir; `runTriangulation(polygon, record?, mode?)` ortak yol — Görev 4 bunu kullanır).
- "Köşegen P'nin içinde" testi (satır 38): `orientation` ile; sol zincirdeyken sağa dönüş, sağ zincirdeyken sola dönüş kuralı (kitap); eşdoğrusal → içeride değil.

- [ ] **Step 1: Write the failing tests.**
  - `triangulateMonotone.test.ts`: "Already monotone" altıgen → 3 köşegen, `isValidTriangulation` ok; monoton bir "zigzag" (0,0),(2,1),(1,2),(3,3),(0,4)… yerine spec'teki "Same-y vertices" poligonu (Görev 4) → 4 köşegen, ok; üçgen → `[]`.
  - `triangulate.test.ts`: rastgele 200 yıldız poligon (seed'li, n 5–20) → `isValidTriangulation(polygon, [...partitionDiagonals, ...triangulationDiagonals]).ok` ve `triangles.length === n−2` ve her üçgen CCW (`signedArea > 0`); `clockwise input`: Textbook polygon ters çevrilmiş → köşegen kümesi, indeksler `n−1−i` ile eşlenince CCW sonuçla aynı; `collinear consecutive vertices`: (0,0),(2,0),(4,0),(4,4),(0,4) → 2 üçgen, ok; kelebek → throws "simple"; 2 köşe → throws "at least 3"; üçgen → 1 üçgen, 0 köşegen; presetlerin (Görev 4 koordinatları bu testte sabit) üçgen sayısı n−2.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** PASS; `npx tsc -b` temiz.
- [ ] **Step 5: Commit.** `feat(geometry): monotone triangulation and triangulate()`

---

### Görev 4: Sözde kod, presetler ve adım üreteci

**Files:**
- Create: `pseudocode.ts`, `presets.ts`, `triangulationSteps.ts`
- Test: `triangulationSteps.test.ts`, `presets.test.ts`

**Interfaces:**
- Consumes: Görev 2–3 (`runTriangulation` ile kaydedici).
- Produces:
  - `TRIANGULATION_PSEUDOCODE: string[]` — tam olarak şu 41 satır (indeks: metin; 4'er boşluk girinti; başlıklar `PSEUDOCODE_HEADINGS = [0, 6, 8, 11, 15, 21, 29]`; `PSEUDOCODE_SECTIONS = { partition: [0, 28], triangulate: [29, 40] }`):
    ```
    0  MakeMonotone(P)
    1      Construct a priority queue Q on the vertices of P, ordered by y (equal y: smaller x first)
    2      Initialize an empty status structure T
    3      while Q is not empty
    4          Remove the vertex v_i with the highest priority from Q
    5          Call the procedure that handles v_i, depending on its type
    6  HandleStartVertex(v_i)
    7      Insert e_i in T and set helper(e_i) to v_i
    8  HandleEndVertex(v_i)
    9      if helper(e_i−1) is a merge vertex, insert the diagonal connecting v_i to helper(e_i−1)
    10     Delete e_i−1 from T
    11 HandleSplitVertex(v_i)
    12     Search in T to find the edge e_j directly left of v_i
    13     Insert the diagonal connecting v_i to helper(e_j); set helper(e_j) to v_i
    14     Insert e_i in T and set helper(e_i) to v_i
    15 HandleMergeVertex(v_i)
    16     if helper(e_i−1) is a merge vertex, insert the diagonal connecting v_i to helper(e_i−1)
    17     Delete e_i−1 from T
    18     Search in T to find the edge e_j directly left of v_i
    19     if helper(e_j) is a merge vertex, insert the diagonal connecting v_i to helper(e_j)
    20     Set helper(e_j) to v_i
    21 HandleRegularVertex(v_i)
    22     if the interior of P lies to the right of v_i
    23         if helper(e_i−1) is a merge vertex, insert the diagonal connecting v_i to helper(e_i−1)
    24         Delete e_i−1 from T; insert e_i in T and set helper(e_i) to v_i
    25     else
    26         Search in T to find the edge e_j directly left of v_i
    27         if helper(e_j) is a merge vertex, insert the diagonal connecting v_i to helper(e_j)
    28         Set helper(e_j) to v_i
    29 TriangulateMonotonePolygon(P)
    30     Merge the vertices of the left and right chains into one sequence u_1 … u_n, sorted by y (equal y: smaller x first)
    31     Initialize an empty stack S and push u_1 and u_2 onto it
    32     for j ← 3 to n − 1
    33         if u_j and the vertex on top of S are on different chains
    34             Pop all vertices from S; insert a diagonal from u_j to each popped vertex except the last one
    35             Push u_j−1 and u_j onto S
    36         else
    37             Pop one vertex from S
    38             Pop the other vertices from S as long as the diagonals to u_j are inside P; insert these diagonals; push the last popped vertex back onto S
    39             Push u_j onto S
    40     Add diagonals from u_n to all stack vertices except the first and the last one
    ```
  - `TRIANGULATION_PRESETS: { name: string; polygon: Polygon; expected: { types: Record<VertexType, number>; partitionDiagonals: number; triangles: number } }[]` — tam olarak (CCW, 775×360):
    1. "Textbook polygon": (120,310),(80,180),(150,60),(260,150),(360,40),(470,160),(580,50),(700,190),(660,320),(560,220),(470,330),(370,230),(280,320),(200,230) → types {start 4, end 3, split 2, merge 3, regular 2}, partitionDiagonals 5, triangles 12.
    2. "Already monotone": (150,100),(620,80),(700,200),(600,330),(200,310),(100,200) → {start 1, end 1, split 0, merge 0, regular 4}, 0, 4.
    3. "Comb": (100,60),(700,60),(700,320),(640,140),(560,320),(500,140),(420,320),(360,140),(280,320),(220,140),(160,320) → {start 5, end 1, split 0, merge 4, regular 1}, 4, 9.
    4. "Same-y vertices": (200,80),(580,80),(640,200),(560,300),(400,300),(240,300),(160,200) → {start 1, end 1, split 0, merge 0, regular 5}, 0, 5.
    5. "Triangle": (200,80),(580,80),(390,320) → {start 1, end 1, split 0, merge 0, regular 1}, 0, 1.
    Beklenen değerler uygulama sırasında `triangulate` ile doğrulanır; bir preset uyuşmazsa preset **değiştirilmez**, rapor edilir (DONE_WITH_CONCERNS).
  - `triangulationSteps(polygon: Polygon, mode: TriangulationMode = 'full'): Step<TriangulationState>[]` (spec §3.3–3.5; init açıklaması "Classify the vertices: 4 start, 3 end, 2 split, 3 merge, 2 regular"; `triangulate` modunda init "Partition into monotone pieces (not shown in this mode): 5 diagonals, 6 pieces"; done "Done: 11 diagonals, 12 triangles" / partition modunda "Done: 5 diagonals, 6 monotone pieces"; `current` aynı köşenin adımlarında, `cursor` aynı u_j'nin adımlarında kalır; `activePiece` üçgenleme boyunca kalır).

- [ ] **Step 1: Write the failing tests.**
  - `presets.test.ts`: her preset `isSimple` ve CCW; `vertexTypes` sayıları `expected.types`; `makeMonotone` köşegen sayısı; `triangulate` üçgen sayısı; `isValidTriangulation` ok.
  - `triangulationSteps.test.ts`: `pseudocode has 41 lines, 7 headings, sections cover all lines`; `last step matches triangulate` (üç modda, presetler + 30 rastgele); `lines valid, never heading, never outside the mode's section` (partition modunda `line ≤ 28`, triangulate modunda `line ≥ 29`; full'da her ikisi de görülür); `reported diagonal is in the lists`; `current/cursor persistence and patch isolation` (`reported` yalnızca ekleme adımlarında; `edgeLeft` yalnızca 12/18/26 ve sonraki aynı-köşe adımlarında değil → yalnızca o adımda); `queue is sorted` her adımda `above` ile; `status consistent`: her bölme adımında `status` kenarları `compareAt(edges, current)` ile sıralı (satır 4–5 hariç, önceki köşenin sırası); `snapshots are independent`; `step count bound`: presetler + 20 rastgele (n=12) + 5 rastgele (n=20) → `≤ 600`; `init description for triangulate mode` içinde "not shown in this mode".
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** PASS; `npx tsc -b` temiz.
- [ ] **Step 5: Commit.** `feat(geometry): triangulation step generator, pseudocode and presets`

---

### Görev 5: Oynatıcı ekleri — modlar, doğrulama, soluk satırlar

**Files:**
- Modify: `src/players/types.ts`, `src/components/StepPlayer.tsx`, `src/components/StepPlayer.css`, `src/components/PseudocodePanel.tsx`, `src/components/StepPlayer.css`
- Test: `src/components/StepPlayer.browser.test.tsx` (yeni testler; mevcutlar değişmez), `src/components/PseudocodePanel.browser.test.tsx` (yeni)

**Interfaces:**
- Produces (`types.ts`, spec §4.1): `modes?: { id: string; label: string }[]`; `computeSteps(input: I, mode?: string)`; `dimmedLines?(mode?: string): number[]`; `validate?(input: I): string | null`; `renderInvalid?(scene: Scene, input: I): void`.
- `StepPlayer` davranışı:
  - `mode` durumu: `module.modes?.[0]?.id`; "Mode" etiketli `<select>` (preset menüsünün yanında) yalnızca modlar varsa; değişince `setIndex(0)`, `setPlaying(false)`; `useMemo(computeSteps, [module, input, mode])`. Sürükleme/preset/random modu **korumaz** → düzeltme: **korur** (mode state'ine dokunmaz).
  - `invalid = module.validate?.(input) ?? null`. `invalid` doluysa: canvas üstünde `<div role="alert" class="step-player-alert">{invalid}</div>`; First/Previous/Play/Next/Last, Mode ve Preset kontrolleri `disabled`; "New random input" **açık** (çıkış yolu); `steps` hesaplanmaz (`[]`), sayaç "Step – / –"; çizim `module.renderInvalid?.(scene, input)` yoksa `scene.clear()` + tutamaçlar.
  - Sürükleme: `lastValidRef` (son geçerli girdi). Her hareket: `next = moveHandle(...)`; `validate(next)` null ise `lastValidRef = next`; her durumda `setInput(next)` (tutamaç fareyi izler; geçersizse uyarı). `onMouseUp`: girdi geçersizse `replaceInput(lastValidRef.current)`.
  - `PseudocodePanel` `dimmed?: number[]` → ilgili `<li>`'lere `pseudocode-dimmed` sınıfı (opacity .45); `aria-current` mantığı değişmez. `StepPlayer` `module.dimmedLines?.(mode)` geçirir.

- [ ] **Step 1: Write the failing tests** (sahte modüller; `fakeWithModes`: 2 mod, `computeSteps` mod başına farklı adım sayısı (3 / 5); `fakeWithValidate`: `validate` ilk tutamaç x < 50 ise "Invalid input"):
  - `mode select recomputes and resets`: Next (Step 2 / 3) → mod 2 seç → "Step 1 / 5"; `computeSteps` ikinci modla çağrıldı.
  - `mode change during playback stops playback`: Play → mod değiştir → buton "Play".
  - `drag and preset keep the mode`: mod 2 seç → preset seç → sayaç "/ 5".
  - `validate shows alert and disables controls`: tutamacı x=20'ye sürükle (fare basılı) → `role="alert"` "Invalid input", Next `disabled`, Mode `disabled`, "New random input" aktif.
  - `validate reverts on release`: aynı sürükleme + mouseup → uyarı yok, tutamaç eski konumda (`handles(input)` ile), sayaç "Step 1 /".
  - `no alert for modules without validate`: Convex Hull benzeri sahte modülde `role="alert"` yok.
  - `PseudocodePanel.browser.test.tsx`: `dimmed=[1,2]` → ilgili satırlarda `pseudocode-dimmed` sınıfı; aktif satır sınıfı korunur.
- [ ] **Step 2:** `npx vitest run --project browser src/components` → yeni testler FAIL; mevcut 10+ test değişmeden.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** `npm test` → PASS; `npm run e2e -- player segmentIntersection` → PASS (değişmeden); `npx tsc -b` temiz.
- [ ] **Step 5: Commit.** `feat(player): modes, input validation and dimmed pseudocode lines`

---

### Görev 6: Üçgenleme oynatıcı modülü

**Files:**
- Create: `src/players/triangulationPlayer.ts`
- Modify: `src/styles/theme.css` (`--tri-*` değişkenleri; açık ve koyu bloklarda aynı değerler)
- Test: `src/players/triangulationPlayer.browser.test.ts`

**Interfaces:**
- Consumes: Görev 4 (`triangulationSteps`, `TRIANGULATION_PSEUDOCODE`, `PSEUDOCODE_SECTIONS`, `TRIANGULATION_PRESETS`), Görev 1 (`isSimple`, `randomStarPolygon`), Görev 5 (`PlayerModule`), `cssColor`.
- Produces: `default triangulationPlayer: PlayerModule<TriangulationState, Polygon>` spec §4.2 aynen:
  - `randomInput()`: `randomStarPolygon(Math.random, 8 + ⌊Math.random()·5⌋, 387, 180, 60, 150)`.
  - `modes`: `[{ id: 'full', label: 'Full' }, { id: 'partition', label: 'Partition only' }, { id: 'triangulate', label: 'Triangulation only' }]`; `dimmedLines(mode)`: partition → `[29..40]`, triangulate → `[0..28]`, full → `[]`.
  - `validate`: `isSimple(input) ? null : 'The polygon must be simple (no crossing edges)'`; `renderInvalid`: kenarlar `--tri-invalid` (#c01c28) 2px + tutamaçlar.
  - `canvas: { width: 775, height: 360 }`; `handles` = köşeler; `moveHandle` saf.
  - Renkler (açık = koyu): `--tri-start: #1a5fb4`, `--tri-end: #1a5fb4`, `--tri-split: #e66100`, `--tri-merge: #9141ac`, `--tri-regular: #1c1e21`, `--tri-partition: #c01c28`, `--tri-diagonal: #26a269`, `--tri-sweep: #6b7280`, `--tri-active: #4f46e5`, `--tri-invalid: #c01c28`.
  - `render` spec §4.2: dolgu `--tri-active` alpha .06; kenarlar 1.5px `--tri-regular`; köşe sembolleri (start dolu kare 10px, end içi boş kare, split yukarı üçgen, merge aşağı üçgen, regular daire r=4) ve etiket `v1…` (+8,+8); bölme aşamasında süpürme doğrusu kesikli `--tri-sweep` `sweepY`'de, `current` r=7 halka `--tri-active`, `status` kenarları 3px `--tri-active` ve kenar orta noktasından helper köşesine kesikli ince çizgi, `edgeLeft` 3px `--tri-split`; `partitionDiagonals` 2px `--tri-partition`, `triangulationDiagonals` 2px `--tri-diagonal`, `reported` 4px; üçgenleme aşamasında `activePiece` dolgu alpha .15, `stack` köşeleri r=9 halka + sıra numarası, `cursor` r=7 dolu `--tri-active`; done'da üçgenler alpha .08 dolgu.
  - `panels(step)`: spec §4.2 formatları: "Event queue" `v7 (split)`; "Status structure" `e3   helper: v4`; "Pieces" `piece 2: v1 v4 v7 v9`; "Stack" üstten alta `v9`; "Vertex types" `v1   start`. `empty` metinleri "Queue is empty", "Status is empty", "Stack is empty".
  - `hint`: "Drag the vertices to change the polygon (it must stay simple). Keys: ← → to step, Space to play or pause."

- [ ] **Step 1: Write the failing tests:** `random input is simple, CCW, 8–12 vertices` (20 run); `validate rejects a bowtie, accepts a square`; `modes and dimmedLines`; `render is pure` (iki render → aynı `children.length`); `render draws sweep line in partition phase and stack rings in triangulate phase` (preset 1; ilk `line === 4` adımı → kesikli Path var; ilk `line ≥ 31` adımı → kesikli Path yok); `panels by phase` (partition adımında "Event queue"/"Status structure"; triangulate adımında "Pieces"/"Stack"; init'te "Vertex types"); `presets expose five names`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** `npm test` PASS; `npx tsc -b`; `npm run build` uyarısız.
- [ ] **Step 5: Commit.** `feat(player): polygon triangulation player module`

---

### Görev 7: Sayfa, API, demo, küçük görsel, e2e → PR ve ön izleme yayını

**Files:**
- Create: `src/content/algorithms/triangulation/index.mdx`, `demo.js`, `src/engine/triangulation.ts`, `public/images/triangulation_tn.png`, `tests/e2e/triangulation.spec.ts`
- Modify: `src/registry.ts` (Line Segment Intersection'dan sonra), `src/engine/api.ts` (`API_NAMES` + `triangulate`, `makeMonotone`, `drawDiagonals`, `drawTriangles`), `scripts/thumbnail.mjs` (parametreli: `--slug`, `--preset`, `--step`; mevcut çağrı davranışı korunur), `package.json` (`thumbnail:triangulation`), `tests/e2e/visual.spec.ts`, `tests/e2e/algorithms.spec.ts` ve `home.spec.ts` (7 kart), `src/registry.test.ts` (`NEW_PATHS`'e ekle)
- Test: `src/engine/runtime.browser.test.ts` (`describe('triangulation api')`), e2e

**Interfaces:**
- API (`src/engine/triangulation.ts`): `toPolygon(input, fnName): Pt[]` — motor `Polygon` nesnesi (`points[i].pos`), `TextPoint[]` (`.pos`), `Point`/`{x,y}`/`[x,y]` dizisi; hatalı → `Error("triangulate: expected a Polygon or an array of points (item N is not a point)")`; `triangulate(input)` → `TriangulationResult` (noktasız, indeksler girdiye göre), basit değilse `Error("triangulate: the polygon must be simple (no crossing edges)")`; `makeMonotone(input)` → `{ types, diagonals, pieces }`; `drawDiagonals(input, diagonals, color = 'red')` 2px çizgiler → `drawables`; `drawTriangles(input, triangles)` dolgu alpha .12, kenar 1px → `drawables`.
- Registry: spec §5.1 aynen (`slug 'triangulation'`, `name 'Polygon Triangulation'`, summary verbatim, `player: () => import('./players/triangulationPlayer')`, `canvases` tek 775×360).
- `demo.js` spec §5.3 aynen.
- MDX spec §5.2 (kitap cümlesi verbatim; L-monoton linki; sanat galerisi paragrafı; etkileşim ipuçları).

- [ ] **Step 1: Write the failing tests.**
  - `runtime.browser.test.ts`: `triangulate` kare `{x,y}` dizisi → 2 üçgen; motor `Polygon` nesnesi (`createPolygon('square')`) → üçgenler; `api accepts clockwise polygon` → aynı sayı; kelebek → `ok:false` ve mesaj "must be simple"; `[1,2,3]` → mesaj "not a point"; demo.js çalışır, çıktı `/\d+ triangle\(s\), \d+ partition diagonal\(s\)/`.
  - `triangulation.spec.ts`: `page opens on the step tab with mode select` (h1 "Polygon Triangulation"; "Mode" üç seçenek; "Vertex types" paneli init'te); `presets reach the expected totals` (her preset: seç → "Step 1 /" → Last → açıklama `Done: ${n−3} diagonals, ${n−2} triangles`); `partition mode ends with pieces` ("Partition only" → Last → "monotone pieces"); `dragging a vertex restarts the player`; `dragging across an edge shows the alert and reverts` (Textbook preset; v1'i poligonun karşı tarafına, kenarı kesecek bir noktaya sürükle (fare basılı) → `role="alert"` görünür; bırak → uyarı yok ve `__webcgalDebug` ile köşe konumu eski; `test.skip(!!process.env.BASE_URL)`); `code tab runs the demo`.
  - `visual.spec.ts` sayfa; kart sayıları 7.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz; küçük görsel: `node scripts/thumbnail.mjs --slug triangulation --preset "Textbook polygon" --step 60` (dist-e2e preview ile) → 413×232 PNG commit.
- [ ] **Step 4:** `npm test`, `npx tsc -b`, `npm run build`, `npm run e2e` → PASS. 375/1280 açık/koyu ekran görüntülerine bak (paneller, sözde kod soluk satırlar, uyarı şeridi).
- [ ] **Step 5: Commit.** `feat: polygon triangulation page, demo and API`
- [ ] **Step 6 (controller):** PR aç (`master`'a) ve Netlify'a ön izleme yayını; canlıda `/algorithms/triangulation` 200, debug kancası yok, e2e smoke + triangulation (sürükleme testi atlanır).

---

### Görev 8: Dokümantasyon öğesi `triangulate`

**Files:**
- Create: `src/content/docs/triangulate.mdx`, `src/content/docs/examples/triangulate.js` (demo.js verbatim)
- Modify: `src/content/docs/index.ts` (`misc_functions`, `findIntersections`'tan sonra), `src/content/docs/docs.test.ts` (`newItems` listesine ekle; toplam 17), `tests/e2e/docs.spec.ts` (17 sayfa, "Try it" 11)

- [ ] **Step 1:** Test sayılarını güncelle, `triangulate is documented with an example` ekle → FAIL.
- [ ] **Step 2:** MDX (~200 kelime): `triangulate(polygon)` imzası ve girdi biçimleri (Polygon nesnesi, nokta dizisi, TextPoint dizisi); çıktı alanları (0 tabanlı indeksler; `types`, `partitionDiagonals`, `pieces`, `triangulationDiagonals`, `triangles`); `makeMonotone`; `drawDiagonals(polygon, diagonals, color)`, `drawTriangles`; basitlik koşulu ve hata mesajı; link `[Polygon Triangulation](/algorithms/triangulation)`; örnek ```js.
- [ ] **Step 3:** `npm test`, `npm run e2e -- docs` → PASS.
- [ ] **Step 4: Commit.** `docs: triangulate API item`

---

### Görev 9: README ve yeniden yayın

- [ ] **Step 1:** README: özellikler satırına Polygon Triangulation; "Adding a new algorithm" oynatıcı maddesine `modes`, `validate`/`renderInvalid`, `dimmedLines`; proje yapısına `src/geometry/algorithms/triangulation/`; thumbnail script'in parametreleri. `npm run build` geçer.
- [ ] **Step 2: Commit.** `docs: README for polygon triangulation`; push.
- [ ] **Step 3 (controller):** Son inceleme + düzeltme turu; Netlify'a yayın; canlı kontrol (`/algorithms/triangulation`, `/documentation/triangulate`); PR açıklamasını güncelle.
