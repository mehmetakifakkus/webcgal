# Doğru Parçası Kesişimi (Süpürme Doğrusu): Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WebCgal'e de Berg Bölüm 2.1'in süpürme doğrusu algoritmasını eklemek: geometri modülü, adım üreteci, olay kuyruğu ve durum yapısı panelleriyle oynatıcı, sayfa, API ve dokümantasyon; bu arada oynatıcıyı nokta dışındaki girdilere genelleştirmek.

**Architecture:** Saf geometri `src/geometry/algorithms/sweep/` altında (kuyruk, durum yapısı, tek `runSweep` uygulaması + kaydedici). Oynatıcı `PlayerModule<S, I>` arayüzüne geçer: girdi türünü bilmez, sürükleme için `handles/moveHandle`, yan paneller için `panels` kullanır. Yeni algoritma yalnızca bir modül, içerik ve registry girdisi ekler.

**Tech Stack:** Mevcut: Vite 8, React 19, TypeScript, paper.js 0.17.0 (sabit), Vitest 5 (node + browser), Playwright 1.63, MDX, Netlify.

**Spec:** `docs/superpowers/specs/2026-11-06-segment-intersection-design.md`. Önceki mimari: `docs/superpowers/specs/2026-11-06-webcgal-modernization-design.md`.

## Global Constraints

- Node 22, npm. Doğrulama: `npm test` (Vitest node + browser), `npx tsc -b`, `npm run build` (uyarısız; `postbuild` bundle kontrolü geçer), `npm run e2e` (`--trace off`, `dist-e2e`'ye build alır).
- Koordinatlar y-yukarı matematik sistemindedir; `src/geometry` DOM'dan ve paper.js'den bağımsızdır. Kütüphane kodu PaperScript operatörleri kullanmaz.
- `EPS = 1e-9` (`src/geometry/primitives.ts`). Süpürme: y azalan, eşitlikte x artan; üst uç = y'si büyük uç, yatay parçada sol uç.
- Parçalar koddan 0 tabanlı, açıklamalarda ve panellerde 1 tabanlı (`s1`…) anılır. Noktalar açıklamada yuvarlanmış tam sayı `(142, 87)`.
- Arayüz ve içerik İngilizce. Test-görünür metinler sabit: "Step k / n", "New random input", "Preset", "Event queue", "Status structure", "Queue is empty", "Status is empty", sekme adları "Step by step" / "Code".
- Mevcut testler **değiştirilmeden** geçmeye devam eder; istisna: Görev 5'te "New random points" buton metni "New random input" olur ve yalnızca bu metni arayan test satırları güncellenir.
- Kullanıcıya açılan API adları `src/engine/api.ts` içindeki `API_NAMES` listesine eklenir.
- Dal: PR #3 birleştikten sonra `git fetch origin master && git checkout -B claude/admiring-mendel-0muoxd origin/master`. Commit mesajlarının sonu (boş satırdan sonra):
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GDn6v79cMSt4qkDVCWkMfK
  ```
  Commit'ler `claude/admiring-mendel-0muoxd` dalına push'lanır.

## Review Focus

1. **Sürüklerken parçaların çakışması:** Bir uç nokta başka bir ucun üstüne ya da bir parçanın içine bırakıldığında, hatta iki parça özdeş hale geldiğinde algoritma çökmemeli ve kaba kuvvetle aynı sonucu vermeli. Test: Görev 3 `random inputs with snapped endpoints`, Görev 6 `moveHandle onto another endpoint`.
2. **Sıfır uzunluklu parça:** İki uç aynı noktaya sürüklenirse adımlar yine üretilmeli. Test: Görev 3 `zero-length segment`, Görev 4 `steps for zero-length segment`.
3. **Çok adım (grid preset):** Adım sayısı sınırlı kalmalı, oynatıcı donmamalı. Test: Görev 4 `step count bound`.
4. **Dar ekranda paneller:** 375px'te üç panel alt alta dizilmeli, yatay kaydırma olmamalı. Test: Görev 7 `visual.spec` girdisi.
5. **Convex Hull değişmedi:** Genellemeden sonra Convex Hull oynatıcısı aynı davranmalı. Test: Görev 5'te mevcut `StepPlayer.browser.test.tsx` ve `tests/e2e/player.spec.ts` değiştirilmeden geçer (buton metni hariç).

---

### Görev 1: Tipler ve kesişim ilkelleri

**Files:**
- Modify: `src/geometry/types.ts`, `src/geometry/primitives.ts`
- Test: `src/geometry/primitives.test.ts` (mevcut dosyaya `describe('segments')` eklenir)

**Interfaces:**
- Produces (`types.ts`): `Segment = { a: Pt; b: Pt }`, `IntersectionPoint = { p: Pt; segments: number[] }`, `Overlap = { a: Pt; b: Pt; segments: [number, number] }`, `IntersectionResult = { points: IntersectionPoint[]; overlaps: Overlap[] }`.
- Produces (`primitives.ts`):
  - `samePt(p: Pt, q: Pt): boolean` (EPS ile).
  - `upperEndpoint(s: Segment): Pt`, `lowerEndpoint(s: Segment): Pt` (y büyük olan üst; eşitse x küçük olan üst).
  - `isHorizontal(s: Segment): boolean` (|a.y − b.y| ≤ EPS).
  - `xAtY(s: Segment, y: number): number` — yatay parçada `s.a.x` döner (çağıran özel durumu ele alır).
  - `onSegment(p: Pt, s: Segment): boolean` — p parçanın üzerinde (uçlar dahil), EPS ile.
  - `segmentIntersection(s: Segment, t: Segment): { kind: 'point'; p: Pt } | { kind: 'overlap'; a: Pt; b: Pt } | null`. `overlap` için `a`, `b` ortak kısmın uçlarıdır ve `upperEndpoint` kuralıyla sıralıdır (a üst). Eşdoğrusal parçalar tek noktada değiyorsa `point`.

- [ ] **Step 1: Write the failing tests** (`describe('segments')`):
  - `crossing`: (0,0)-(4,4) × (0,4)-(4,0) → `point (2,2)`.
  - `touching at endpoint`: (0,0)-(2,2) × (2,2)-(4,0) → `point (2,2)`.
  - `endpoint on interior`: (0,0)-(4,0) × (2,0)-(2,3) → `point (2,0)`.
  - `parallel`: (0,0)-(4,0) × (0,1)-(4,1) → `null`.
  - `collinear disjoint`: (0,0)-(1,0) × (2,0)-(3,0) → `null`.
  - `collinear touching`: (0,0)-(2,0) × (2,0)-(4,0) → `point (2,0)`.
  - `partial overlap`: (0,0)-(3,0) × (1,0)-(5,0) → `overlap` with `{a,b}` = {(1,0),(3,0)} (sırasız karşılaştır).
  - `containment`: (0,0)-(6,0) × (2,0)-(4,0) → `overlap` (2,0)-(4,0).
  - `identical`: aynı parça iki kez → `overlap` tam parça.
  - `vertical × horizontal`: (2,-1)-(2,5) × (0,1)-(4,1) → `point (2,1)`.
  - `upperEndpoint`: (0,0)-(0,5) → (0,5); yatay (3,1)-(1,1) → (1,1).
  - `xAtY`: (0,0)-(4,4) at y=1 → 1; yatay → `a.x`.
- [ ] **Step 2:** `npx vitest run --project node src/geometry/primitives.test.ts` → FAIL.
- [ ] **Step 3:** Tipleri ve fonksiyonları yaz. `segmentIntersection`: önce `crossVec` ile paralellik; eşdoğrusalsa parametrik aralık kesişimi; değilse standart parametrik çözüm `t, u ∈ [−EPS, 1+EPS]`.
- [ ] **Step 4:** Aynı komut → PASS. `npx tsc -b` temiz.
- [ ] **Step 5: Commit.** `feat(geometry): segment types and intersection primitives`

---

### Görev 2: Olay kuyruğu ve durum yapısı

**Files:**
- Create: `src/geometry/algorithms/sweep/eventQueue.ts`, `src/geometry/algorithms/sweep/status.ts`
- Test: `src/geometry/algorithms/sweep/eventQueue.test.ts`, `src/geometry/algorithms/sweep/status.test.ts`

**Interfaces:**
- Consumes: Görev 1.
- Produces:
  - `class EventQueue { insert(p: Pt, upperOf?: number): void; popNext(): { p: Pt; upper: number[] } | undefined; has(p: Pt): boolean; get size(): number; toArray(): { p: Pt; upper: number[] }[] }`. Sıra: y azalan, eşitlikte x artan; `samePt` ile birleşir; `upper` tekrar içermez.
  - `class StatusStructure { constructor(segments: Segment[]); insert(i: number, p: Pt): void; remove(i: number): void; reorderAt(p: Pt): void; findThrough(p: Pt): number[]; leftOf(p: Pt): number | undefined; rightOf(p: Pt): number | undefined; leftNeighbor(i: number): number | undefined; rightNeighbor(i: number): number | undefined; toArray(): number[] }`.
  - `compareAt(segments: Segment[], p: Pt): (i: number, j: number) => number` (dışa açık, Görev 4'ün tutarlılık testi için): spec §2.5 kuralları: `xAtY(·, p.y)` (yatay için `p.x`); eşitlikte `y = p.y − 1` için x (sıfır uzunluklu ya da yatay parçada `p.x`); yatay parça p'den geçenlerin en sağında; hâlâ eşitse indeks.
  - `leftOf(p)` = x'i `p.x`'ten (EPS) küçük olan en sağdaki parça; `rightOf(p)` = büyük olan en soldaki; p'den geçen parçalar hariç.

- [ ] **Step 1: Write the failing tests.**
  - `eventQueue.test.ts`: `orders by y desc then x asc` ((1,5),(3,5),(0,2) eklenince pop sırası (1,5),(3,5),(0,2)); `merges same point` (aynı p iki kez, `upperOf` 0 ve 2 → tek olay, `upper [0,2]`); `has` EPS içinde; `toArray` sıralı ve pop'tan etkilenmez (kopya).
  - `status.test.ts` (parçalar: s0 (0,0)-(4,4), s1 (4,0)-(0,4), s2 (2,-1)-(2,5), s3 yatay (0,2)-(4,2)): `order above the crossing` (p=(2,3): s1, s2, s0 soldan sağa); `reorder at the crossing` (p=(2,2): insert all → `toArray()` [1,2,0] → `reorderAt((2,2))` → [0,2,1]; yani doğrunun altındaki sıra); `horizontal is rightmost at p` (s3 dahil p=(2,2): s3 sonda); `findThrough((2,2))` = {0,1,2,3}; `leftOf/rightOf` p=(2,2) ile s0..s3 ve ek s4 (−3,0)-(−3,4), s5 (6,0)-(6,4) → leftOf = 4, rightOf = 5; `overlapping collinear by index` (s6 (0,0)-(3,3), s7 (1,1)-(4,4) p=(2,2): 6 solda); `remove` sonrası komşular.
- [ ] **Step 2:** `npx vitest run --project node src/geometry/algorithms/sweep` → FAIL.
- [ ] **Step 3:** İki sınıfı yaz: sıralı dizi + ikili arama; dosya başına "öğretim ölçeği (≤ ~30 parça) için sıralı dizi; kitaptaki dengeli ağaç değil" notu.
- [ ] **Step 4:** Aynı komut → PASS.
- [ ] **Step 5: Commit.** `feat(geometry): sweep-line event queue and status structure`

---

### Görev 3: Süpürme algoritması ve kaba kuvvet referansı

**Files:**
- Create: `src/geometry/algorithms/sweep/findIntersections.ts`, `src/geometry/algorithms/sweep/bruteForceIntersections.ts`, `src/geometry/algorithms/sweep/sameResult.ts`
- Test: `src/geometry/algorithms/sweep/findIntersections.test.ts`

**Interfaces:**
- Consumes: Görev 1–2.
- Produces:
  - `type SweepPatch = Partial<Pick<SweepState, 'current' | 'U' | 'L' | 'C' | 'testing' | 'newEvent' | 'reported'>>` ve `type Recorder = (line: number, description: string, patch: SweepPatch, ctx: { queue: EventQueue; status: StatusStructure; sweepY: number | null; phase: SweepState['phase'] }) => void`. (`SweepState` Görev 4'te tanımlanır; bu görevde `sweepState.ts` dosyasına yalnızca tip konur.)
  - `runSweep(segments: Segment[], record?: Recorder): IntersectionResult`
  - `findIntersections(segments: Segment[]): IntersectionResult` = `runSweep(segments)`
  - `bruteForceIntersections(segments: Segment[]): IntersectionResult`
  - `sameResult(a: IntersectionResult, b: IntersectionResult, eps = 1e-6): boolean`
- Kayıt noktaları ve `line` değerleri Görev 4'teki sözde kod listesine göredir; bu görevde `record` çağrıları yazılır ama yalnızca `runSweep(segments)` test edilir. Kayıt sırası spec §3.4: init (line 1–2), olay çek (4), U/L/C (7–8), rapor (10), sil (11), ekle (12), her komşu testi (19; kesişim bulunursa 20; örtüşme bulunursa 21–22), bitiş (3, `phase: 'done'`).
- Çıktı sırası deterministik: `points` olay sırasıyla (y azalan, x artan), her noktadaki `segments` artan; `overlaps` keşif sırasıyla, `segments` küçük indeks önce.
- `bruteForceIntersections`: her çift için `segmentIntersection`; `point` sonuçları ve her `overlap`'ın **iki ucu** aday noktadır (örtüşmenin ucunda iki parça da o noktayı içerdiğinden kitabın |U ∪ L ∪ C| ≥ 2 kuralı orayı da kesişim sayar). Aday noktalar `samePt` ile birleştirilir; her noktada `onSegment` ile o noktadan geçen **tüm** parçalar listelenir; sonuç `points` süpürmeyle aynı sırayla sıralanır.

- [ ] **Step 1: Write the failing tests** (yardımcı: `seg(x1,y1,x2,y2)`; sonuçlar `sameResult` ile ve ayrıca sabit örneklerde doğrudan sayılarla kontrol edilir):
  - `two crossing segments` → 1 point, segments [0,1].
  - `three through one point` → 1 point with segments [0,1,2].
  - `vertical and horizontal` → (2,1) örneği, 1 point.
  - `shared endpoint of three` → 1 point, 3 segments.
  - `endpoint on interior` → 1 point.
  - `partial overlap` ((0,0)-(3,0), (1,0)-(5,0)) → overlaps 1 = (1,0)-(3,0); points 2 ((1,0) ve (3,0)); `bruteForce` ile `sameResult`.
  - `identical segments` → overlaps 1, points 2 (iki uç).
  - `containment` → overlaps 1, points 2.
  - `collinear touching` → points 1, overlaps 0.
  - `empty and single` → boş sonuç.
  - `zero-length segment` ((1,1)-(1,1) ile (0,0)-(2,2)) → points 1 [(1,1), segments [0,1]]; tek başına sıfır uzunluk → boş.
  - `random inputs equal brute force`: seed'li mulberry32 ile 200 girdi, her biri 2–12 parça, koordinatlar 0–700 arası tam sayı → her biri `sameResult(findIntersections, bruteForceIntersections)`.
  - `random inputs with snapped endpoints`: 100 girdi; her girdide rastgele birkaç ucun koordinatı başka bir parçanın ucuna ya da orta noktasına eşitlenir (dejenere üretimi) → yine `sameResult`.
  - `deterministic output order`: aynı girdi iki kez → derin eşit.
- [ ] **Step 2:** `npx vitest run --project node src/geometry/algorithms/sweep/findIntersections.test.ts` → FAIL.
- [ ] **Step 3:** Üç dosyayı yaz. `runSweep` spec §2.6 adımlarıyla; `FindNewEvent` içinde `segmentIntersection`: `point` ise ve nokta süpürme doğrusunun altında ya da üstünde-sağda (`p.y < sweepY − EPS` veya (`|p.y − sweepY| ≤ EPS` ve `p.x > current.x + EPS`)) ve kuyrukta yoksa ekle; `overlap` ise çift anahtarı `${min},${max}` `Set`'te yoksa ekle.
- [ ] **Step 4:** Aynı komut → PASS. Tüm `src/geometry` testleri → PASS.
- [ ] **Step 5: Commit.** `feat(geometry): sweep-line segment intersection with brute-force reference`

---

### Görev 4: Durum modeli, sözde kod, adım üreteci ve hazır örnekler

**Files:**
- Create: `src/geometry/algorithms/sweep/sweepState.ts` (Görev 3'teki tip dosyası tamamlanır), `src/geometry/algorithms/sweep/pseudocode.ts`, `src/geometry/algorithms/sweep/findIntersectionsSteps.ts`, `src/geometry/algorithms/sweep/presets.ts`
- Test: `src/geometry/algorithms/sweep/findIntersectionsSteps.test.ts`

**Interfaces:**
- Consumes: Görev 2–3 (`runSweep`, `Recorder`, `compareAt`).
- Produces:
  - `SweepState` (spec §3.2 aynen).
  - `SEGMENT_INTERSECTION_PSEUDOCODE: string[]` — tam olarak şu 23 satır (indeks: metin; başlık satırları 0, 6, 18 hiçbir adımda `line` olamaz; girintiler 4'er boşluk):
    ```
    0  FindIntersections(S)
    1      Initialize an empty event queue Q and insert the endpoints of all segments; an upper endpoint stores its segment
    2      Initialize an empty status structure T
    3      while Q is not empty
    4          Determine the next event point p in Q and delete it
    5          HandleEventPoint(p)
    6  HandleEventPoint(p)
    7      Let U(p) be the set of segments whose upper endpoint is p
    8      Find the segments in T that contain p: L(p) has p as lower endpoint, C(p) contains p in its interior
    9      if U(p) ∪ L(p) ∪ C(p) contains more than one segment
    10         Report p as an intersection, together with U(p), L(p) and C(p)
    11     Delete the segments in L(p) ∪ C(p) from T
    12     Insert the segments in U(p) ∪ C(p) into T, ordered as they are just below the sweep line
    13     if U(p) ∪ C(p) is empty
    14         Let sl and sr be the left and right neighbours of p in T; FindNewEvent(sl, sr, p)
    15     else
    16         Let s' be the leftmost segment of U(p) ∪ C(p) in T and sl its left neighbour; FindNewEvent(sl, s', p)
    17         Let s'' be the rightmost segment of U(p) ∪ C(p) in T and sr its right neighbour; FindNewEvent(s'', sr, p)
    18 FindNewEvent(sl, sr, p)
    19     if sl and sr intersect below the sweep line, or on it to the right of p, and the point is not yet in Q
    20         Insert the intersection point as an event into Q
    21     (extension) if sl and sr are collinear and overlap
    22         (extension) Report their common part as an overlap, once per pair
    ```
    `PSEUDOCODE_HEADINGS = [0, 6, 18]`.
  - `findIntersectionsSteps(segments: Segment[]): Step<SweepState>[]`. İlk adım `phase: 'init'`, `line: 1`, açıklama "Insert all endpoints into the event queue"; son adım `phase: 'done'`, `line: 3`, açıklama "The queue is empty: done. Found k intersection point(s) and m overlap(s)". Patch alanları her adımda sıfırdan konur (önceki adımın `testing`/`reported` taşınmaz). Her adım `structuredClone`.
  - `SWEEP_PRESETS: { name: string; segments: Segment[]; expected: { points: number; overlaps: number } }[]` — tam olarak (koordinatlar 775×360 canvas, y-yukarı):
    1. "Three segments through one point": (200,60)-(574,300), (200,300)-(574,60), (387,40)-(387,320) → {1, 0}
    2. "Vertical and horizontal segments": (150,180)-(620,180), (300,60)-(300,300), (500,60)-(500,300), (150,60)-(620,300) → {5, 0}
    3. "Shared endpoint": (200,80)-(400,280), (400,280)-(600,80), (400,280)-(400,60), (250,200)-(550,200) → {4, 0}
    4. "Endpoint on a segment": (150,100)-(650,260), (400,180)-(300,320), (550,300)-(550,100) → {2, 0}
    5. "Overlapping segments": (150,120)-(450,240), (300,180)-(600,300), (350,80)-(350,300) → {3, 1}
    6. "Grid of six segments": (120,100)-(655,120), (120,180)-(655,200), (120,260)-(655,280), (250,40)-(270,320), (390,40)-(400,320), (520,40)-(530,320) → {9, 0}

- [ ] **Step 1: Write the failing tests.**
  - `pseudocode has 23 lines and three headings`.
  - `last step equals findIntersections` (rastgele 30 girdi, seed'li): son adımın `points`/`overlaps` → `sameResult`.
  - `every line is valid and never a heading`: `0 ≤ line < 23` ve `line ∉ PSEUDOCODE_HEADINGS`.
  - `queue is sorted and status is consistent in every step`: her adımda `queue` y azalan/x artan; `sweepY !== null` ise `status` dizisi `compareAt(segments, {x: current.x, y: sweepY})` ile sıralı. (`current` yoksa önceki adımın `current`'ı.)
  - `test step precedes a new event`: `newEvent` dolu olan her adımın `line === 20`'dir ve hemen öncesinde `line === 19` ve `testing` dolu bir adım vardır.
  - `reported point is in the found list`: `reported` nokta ise aynı adımın `points`'inde yer alır.
  - `snapshots are independent`: 3. adımın `status`'una `push(99)` → diğer adımların `status`'u değişmez.
  - `steps for zero-length segment`: (1,1)-(1,1) tek başına → en az init ve done adımı, hata yok.
  - `presets have expected counts`: her preset için `findIntersections(preset.segments)` → `expected` ve `bruteForce` ile `sameResult`.
  - `step count bound`: her preset ve 7 rastgele parça (20 seed) için `steps.length ≤ 500`.
- [ ] **Step 2:** `npx vitest run --project node src/geometry/algorithms/sweep` → yeni testler FAIL.
- [ ] **Step 3:** Dosyaları yaz; `findIntersectionsSteps` içindeki kaydedici `ctx`'ten `queue.toArray()`, `status.toArray()` ve bulunanları alıp `SweepState` kurar. Açıklama biçimleri: "Next event p = (x, y)", "U = {s2}, L = {}, C = {s1, s4}", "Report intersection at (x, y): s1, s2, s4", "Delete L ∪ C from T", "Insert U ∪ C into T", "Test s3 and s5: they intersect at (x, y) below the sweep line → new event", "Test s3 and s5: no intersection below the sweep line", "Test s1 and s2: collinear and overlapping → report overlap (x1, y1)–(x2, y2)".
- [ ] **Step 4:** Aynı komut → PASS. `npx tsc -b` temiz.
- [ ] **Step 5: Commit.** `feat(geometry): sweep-line step generator, pseudocode and presets`

---

### Görev 5: Oynatıcı genellemesi (`PlayerModule<S, I>`) ve `StatePanel`

**Files:**
- Modify: `src/players/types.ts`, `src/players/convexHullPlayer.ts`, `src/components/StepPlayer.tsx`, `src/components/StepPlayer.css`, `src/registry.ts:6-9` (`PlayerImport` tipi `PlayerModule<any, any>`), `src/pages/AlgorithmPage.tsx:16` (aynı), `tests/e2e/player.spec.ts` ve `src/components/StepPlayer.browser.test.tsx` (yalnızca "New random points" → "New random input" metin satırları)
- Create: `src/components/StatePanel.tsx`, `src/components/StatePanel.css`
- Test: `src/components/StatePanel.browser.test.tsx`; `src/components/StepPlayer.browser.test.tsx` (yeni testler eklenir)

**Interfaces:**
- Produces (`types.ts`): spec §4.1'deki `Panel` ve `PlayerModule<S, I>` aynen (`initialPoints` kaldırılır; `randomInput`, `handles`, `moveHandle` zorunlu; `presets`, `panels`, `canvas` isteğe bağlı).
- Produces (`StatePanel.tsx`): `<StatePanel panel: Panel />` → `<section class="state-panel" aria-label={title}>` içinde `<h3>` ve `<ol>`; satır `class="state-row state-row-active|testing|new"`; boşsa `<p class="state-empty">` ile `empty` (varsayılan "Empty").
- `StepPlayer` davranışı:
  - `input` durumu `module.randomInput()` ile başlar; `handles = module.handles(input)` sürükleme hedefleri; sürüklemede `module.moveHandle(inputRef.current, k, clamped)`; `inputRef` ile rAF-kısıtlı güncelleme (mevcut mantık).
  - Canvas boyutu `module.canvas ?? { width: 775, height: 360 }`; `WIDTH/HEIGHT` sabitleri kalkar.
  - Buton metni "New random input". `module.presets` varsa yanında `<label>Preset <select>` (ilk seçenek "Choose a preset…", `value=""`); seçimde `replaceInput(preset.input)` ve seçim sıfırlanır.
  - `module.panels?.(step, input)` varsa sözde kod panelinin altında her biri `<StatePanel>`.
  - İpucu metni: "Drag the handles to change the input. Keys: ← → to step, Space to play or pause."
- `convexHullPlayer`: `PlayerModule<HullState, Pt[]>`; `randomInput: () => randomPoints()`, `handles: (pts) => pts`, `moveHandle: (pts, k, p) => pts.map((q, i) => (i === k ? p : q))`, `canvas: { width: WIDTH, height: HEIGHT }`. `render` değişmez.

- [ ] **Step 1: Write the failing tests.**
  - `StatePanel.browser.test.tsx`: `renders rows with highlight classes` (3 satır: active/testing/none → sınıflar); `shows empty text` (0 satır, `empty: 'Queue is empty'`).
  - `StepPlayer.browser.test.tsx` (sahte modül `fakeSegmentModule: PlayerModule<{ n: number }, Segment[]>`: 2 parça, `handles` = 4 uç, `computeSteps` 3 adım, `presets` = [{ name: 'Two crossing', input }], `panels` = [{ title: 'Status structure', rows: [{ text: 's1', highlight: 'active' }] }]):
    - `preset select replaces input and resets`: Next'e bas (Step 2), preset seç → "Step 1 / 3" ve `computeSteps` preset girdisiyle çağrıldı.
    - `panels are rendered`: "Status structure" başlığı ve `s1` satırı `state-row-active`.
    - `moveHandle onto another endpoint`: canvas'ta 1. tutamacı 2. tutamacın konumuna sürükle (gerçek fare olayları, mevcut drag testindeki yöntem) → `moveHandle` çağrıldı, girdi iki uç aynı noktada, sayaç "Step 1 /", hata yok.
    - Mevcut 6 test değişmeden (metin güncellemesi hariç) geçer.
- [ ] **Step 2:** `npx vitest run --project browser src/components` → yeni testler FAIL (tip hataları dahil).
- [ ] **Step 3:** `types.ts`, `StatePanel`, `StepPlayer` ve `convexHullPlayer`'ı yaz. CSS: `.state-panel` sözde kod paneliyle aynı kart stili; `.state-row-active` vurgu arka planı, `-testing` `--hull-testing`, `-new` başarı rengi; dar ekranda tam genişlik.
- [ ] **Step 4:** `npm test` → PASS; `npm run e2e -- player` → PASS; `npx tsc -b` temiz.
- [ ] **Step 5: Commit.** `refactor(player): generic input with handles, presets and state panels`

---

### Görev 6: Süpürme oynatıcı modülü

**Files:**
- Create: `src/players/sweepLinePlayer.ts`
- Modify: `src/styles/theme.css` (yeni renk değişkenleri, açık ve koyu)
- Test: `src/players/sweepLinePlayer.browser.test.ts`

**Interfaces:**
- Consumes: Görev 4 (`findIntersectionsSteps`, `SEGMENT_INTERSECTION_PSEUDOCODE`, `SWEEP_PRESETS`, `SweepState`), Görev 5 (`PlayerModule`, `Panel`).
- Produces: `default sweepLinePlayer: PlayerModule<SweepState, Segment[]>`:
  - `randomInput()`: 7 parça; uçlar `[77.5, 697.5] × [36, 324]` aralığında; uzunluğu < 40 olan parça yeniden üretilir; `Math.random`.
  - `presets`: `SWEEP_PRESETS.map(({ name, segments }) => ({ name, input: segments }))`.
  - `handles(segs)`: `[s0.a, s0.b, s1.a, s1.b, …]`; `moveHandle(segs, k, p)`: `segs[⌊k/2⌋]`'nin `a` (k çift) / `b` (k tek) ucu; saf.
  - `canvas: { width: 775, height: 360 }`.
  - `render` spec §4.3: parçalar ince (`--sweep-segment`, 1.5px), durum yapısındakiler kalın (`--sweep-status`, 3px), `testing` çifti `--sweep-testing` 3px; süpürme doğrusu `sweepY`'de `dashArray [6,4]` `--sweep-line`; kuyruktaki olaylar içi boş r=4 daire, `current` dolu r=5 `--sweep-event`; `points` dolu r=5 `--sweep-found`; `overlaps` 5px `--sweep-overlap`; `newEvent` r=8 halka; etiketler `s1`… üst ucun 8px sağ üstünde `--canvas-ink`; tutamaçlar r=4 `--canvas-ink` (sürüklenebilirlik ipucu).
  - `panels(step)`: "Event queue" satırları `(x, y)   U = {s2, s5}` (`U = {}` boşsa), `current` ile aynı noktaysa `active`, `newEvent` ile aynıysa `new`; boş: "Queue is empty". "Status structure" satırları tek satır `s3   s1   s4` **değil**, her parça ayrı satır (`s3`, `s1`, `s4` soldan sağa), `testing` içindekiler `testing`, bu adımda eklenenler (`U ∪ C` ve `line === 12`) `new`; boş: "Status is empty".
- Tema değişkenleri (`theme.css`, açık / koyu): `--sweep-line: #6b7280 / #9ca3af`, `--sweep-segment: #374151 / #d1d5db`, `--sweep-status: #1a5fb4 / #60a5fa`, `--sweep-testing: #9141ac / #c084fc`, `--sweep-event: #e66100 / #fb923c`, `--sweep-found: #c01c28 / #f87171`, `--sweep-overlap: #26a269 / #4ade80`.

- [ ] **Step 1: Write the failing tests** (browser; her test kendi canvas'ıyla `createScene`):
  - `random input has 7 segments of length ≥ 40 inside the canvas`.
  - `handles and moveHandle`: 2 parça → 4 tutamaç; `moveHandle(segs, 3, p)` → `segs[1].b === p`, girdi değişmedi.
  - `render draws the sweep line at sweepY`: preset 1'in orta bir adımında (ilk `line === 4` adımı) render → `project.activeLayer.children` içinde `dashArray` dolu bir `Path` var ve y'si `sweepY`.
  - `render is pure`: aynı adım iki kez render → `children.length` eşit.
  - `panels reflect queue and status`: `line === 12` olan ilk adımda "Status structure" satır sayısı `state.status.length` ve `new` vurgulu satır var; init adımında "Status is empty".
  - `presets expose names`: 6 preset, adlar `SWEEP_PRESETS` ile aynı.
- [ ] **Step 2:** `npx vitest run --project browser src/players` → FAIL.
- [ ] **Step 3:** Modülü ve tema değişkenlerini yaz; renkler `cssColor` ile render anında okunur (Convex Hull modülündeki yardımcı paylaşılır: `src/players/cssColor.ts`'e taşı ve ikisinde kullan).
- [ ] **Step 4:** Aynı komut → PASS; `npm test` → PASS.
- [ ] **Step 5: Commit.** `feat(player): sweep-line player module with queue and status panels`

---

### Görev 7: Sayfa, içerik, API ve demo

**Files:**
- Create: `src/content/algorithms/segmentIntersection/index.mdx`, `src/content/algorithms/segmentIntersection/demo.js`, `public/images/segmentIntersection_tn.png`, `tests/e2e/segmentIntersection.spec.ts`, `scripts/thumbnail.mjs` (Playwright ile `dist-e2e` önizlemesinden oynatıcı canvas'ının ekran görüntüsü; bir kez çalıştırılır, PNG commit edilir)
- Modify: `src/registry.ts` (Convex Hull'dan sonra yeni girdi), `src/engine/api.ts` (`API_NAMES` + uygulamalar), `tests/e2e/visual.spec.ts` (sayfa listesi), `tests/e2e/algorithms.spec.ts` (kart sayısı 5 → 6 olan satırlar)
- Test: `src/engine/runtime.browser.test.ts` (`describe('segments api')` eklenir), e2e

**Interfaces:**
- Consumes: Görev 3 (`findIntersections`, `bruteForceIntersections`), Görev 6 (`sweepLinePlayer`).
- Produces (API, `api.ts`; girdi `{a, b}` ile `a`/`b` paper `Point` ya da `{x, y}`; çıktıdaki noktalar `paper.Point`):
  - `findIntersections(segments)`, `bruteForceIntersections(segments)` → `{ points: { p, segments }[], overlaps: { a, b, segments }[] }`
  - `Segments.createRandom(n, minLen = 40)` → `{ a: Point, b: Point }[]` canvas içinde %10 kenar boşluğu
  - `Segments.draw(segments)` → parçaları 2px `black` çizer, `s1`… etiketler, `drawables`'a ekler
  - `drawIntersections(result)` → noktalar kırmızı dolu r=5, örtüşmeler yeşil 5px; `drawables`'a ekler
- Registry girdisi: `slug 'segmentIntersection'`, `path '/algorithms/segmentIntersection'`, `name 'Line Segment Intersection'`, `thumbnail '/images/segmentIntersection_tn.png'`, `summary 'Find all intersections of n line segments with a sweep line in O((n + k) log n) time.'`, `content`, `demoCode`, `player: () => import('./players/sweepLinePlayer')`, `canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }]`.
- `demo.js` (PaperScript):
  ```js
  var segments = Segments.createRandom(7);
  Segments.draw(segments);
  var result = findIntersections(segments);   // try bruteForceIntersections(segments) too
  drawIntersections(result);
  console.log(result.points.length + ' intersection point(s), ' + result.overlaps.length + ' overlap(s)');
  ```
- MDX içeriği (İngilizce, ~250–350 kelime): başlık yok (sayfa başlığı registry'den), paragraflar: problem; kaba kuvvet O(n²) ve çıktıya duyarlı O((n+k) log n); kitap referansı "This page follows chapter 2.1, *Line Segment Intersection*, of Computational Geometry: Algorithms and Applications, 3rd ed., by de Berg et al."; olay kuyruğu ve durum yapısı; "Beyond the book's assumptions, this page also handles collinear overlapping segments (reported as overlaps)"; etkileşim: "Drag the endpoints, pick a preset to see the degenerate cases, and follow the two panels next to the pseudocode."

- [ ] **Step 1: Write the failing tests.**
  - `runtime.browser.test.ts` `segments api`: `findIntersections` iki kesişen `{a,b}` ile 1 nokta ve `p instanceof Point`; `Segments.createRandom(5)` 5 parça; demo.js (`?raw`) çalışır `ok: true` ve çıktı satırı `/\d+ intersection point\(s\), \d+ overlap\(s\)/`.
  - `tests/e2e/segmentIntersection.spec.ts`:
    - `page opens on the step tab without errors`: h1 "Line Segment Intersection", "Step by step" sekmesi seçili, "Event queue" ve "Status structure" panelleri var, konsol hatası yok.
    - `last step empties the status`: Last → "Status is empty" ve "Queue is empty".
    - `presets reset the player and find the expected intersections`: her preset için seç → "Step 1 /" → Last → açıklama metni `Found ${expected.points} intersection point(s) and ${expected.overlaps} overlap(s)` içerir.
    - `dragging an endpoint restarts the player`: Next ×3, ilk tutamacı 30px sürükle (mevcut player.spec yöntemi, `__webcgalDebug` ile `r=4` daireyi bul) → "Step 1 /".
    - `code tab runs the demo`: "Code" sekmesi → çıktı panelinde `intersection point(s)` satırı, error satırı yok.
  - `visual.spec.ts`: `{ path: '/algorithms/segmentIntersection', name: 'segmentIntersection', heading: 'Line Segment Intersection' }` eklenir.
  - `algorithms.spec.ts`: 6 kart.
- [ ] **Step 2:** İlgili testler → FAIL.
- [ ] **Step 3:** Registry, MDX, demo, API, `scripts/thumbnail.mjs` ile PNG (preset 2'nin orta adımı, 775×360'tan 310×144'e ölçekli — mevcut `convexHull_tn.png` boyutuna bak ve ona uy).
- [ ] **Step 4:** `npm test`, `npx tsc -b`, `npm run build` (uyarısız, bundle kontrolü geçer), `npm run e2e` → PASS. 375px açık/koyu ekran görüntüsüne bak (paneller alt alta, yatay kaydırma yok).
- [ ] **Step 5: Commit.** `feat: line segment intersection page, demo and API`

---

### Görev 8: Dokümantasyon öğesi `findIntersections`

**Files:**
- Create: `src/content/docs/findIntersections.mdx`, `src/content/docs/examples/findIntersections.js`
- Modify: `src/content/docs/index.ts` (`misc_functions`, `loop`'tan önce), `src/content/docs/docs.test.ts` (15 → 16; eski 15 listesine `findIntersections` **eklenmez**, ayrı `newItems` listesiyle toplam 16), `tests/e2e/docs.spec.ts` (16 sayfa, "Try it" sayısı 10)
- Test: `src/content/docs/docs.browser.test.ts` (örnek hatasız çalışır — mevcut döngü otomatik kapsar)

- [ ] **Step 1:** Testlerdeki sayıları güncelle; `docs.test.ts`'e `findIntersections is documented with an example` ekle. Çalıştır → FAIL.
- [ ] **Step 2:** MDX: imza, girdi/çıktı biçimi, `bruteForceIntersections` notu, `Segments.createRandom`/`Segments.draw`/`drawIntersections` yardımcıları, algoritma sayfasına link `[Line Segment Intersection](/algorithms/segmentIntersection)`; örnek = Görev 7'deki demo.js.
- [ ] **Step 3:** `npm test`, `npm run e2e -- docs` → PASS.
- [ ] **Step 4: Commit.** `docs: findIntersections API item`

---

### Görev 9: README ve yayın

**Files:**
- Modify: `README.md` (özellikler: "Step-by-step players for Convex Hull and Line Segment Intersection"; "Adding a new algorithm" bölümüne `presets`/`handles`/`panels` satırı)

- [ ] **Step 1:** README güncellenir; `npm run build` → `dist/` temiz (`postbuild` geçer).
- [ ] **Step 2: Commit.** `docs: README for segment intersection`; push.
- [ ] **Step 3:** PR aç (`master`'a; açıklama: özet, test planı, canlı adres).
- [ ] **Step 4:** Netlify'a yayın (önceki yöntemle: `netlify-deploy-services-updater` → `npx @netlify/mcp`); canlıda `/algorithms/segmentIntersection` 200, `__webcgalDebug` yok; `BASE_URL=https://webcgal.netlify.app npx playwright test tests/e2e/segmentIntersection.spec.ts --trace off` → PASS (debug kancası gerektiren sürükleme testi hariç; o test `test.skip(!!process.env.BASE_URL)` ile canlıda atlanır).
