# Sanat Galerisi Problemi: Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** de Berg §3.1'in sanat galerisi teoremini (Fisk'in ispatı: üçgenleme, dual ağaç, 3-boyama, en küçük renk sınıfı) adım adım gösteren ve köşe kameralı bir sandbox sunan yeni sayfa, API ve dokümantasyon.

**Architecture:** Saf geometri `src/geometry/algorithms/artGallery/` altında (Fisk, görünürlük, kapsama, adımlar, presetler), mevcut üçgenleme modülünü yeniden kullanır. StepPlayer'a isteğe bağlı `clickHandle` eklenir; oynatıcı `src/players/artGalleryPlayer.ts` iki mod sunar; API `src/engine/artGallery.ts`.

**Tech Stack:** Mevcut: Vite 8, React 19, TypeScript, paper.js 0.17.0 (boolean işlemler yalnızca çizimde), Vitest 5 (node + browser), Playwright 1.63, MDX, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-10-art-gallery-design.md`.

## Global Constraints

- Node 22, npm. Doğrulama: `npm test`, `npx tsc -b`, `npm run build` (uyarısız; bundle kontrolü geçer), `npm run e2e -- --trace off`; e2e ayrıca `/webcgal/` alt yolunda (`VITE_BASE=/webcgal/` derleme + `scripts/pages-postbuild.mjs` + `BASE_URL=http://localhost:<port>/webcgal/`). Playwright/Chromium kurulu; `playwright install` çalıştırılmaz.
- `src/geometry` DOM/paper.js'den bağımsız; kütüphane kodunda PaperScript operatörü yok; koordinatlar y-yukarı.
- Üçgenleme modülünden `triangulate`, `isSimple`, `ensureCCW`, `pointInPolygon`, `diagonalInside`, `randomStarPolygon`, `TRIANGULATION_PRESETS` yeniden kullanılır (kopyalanmaz).
- Renk adları sırayla "red", "green", "blue" (0, 1, 2); etiketler `v1…`; tekil/çoğul doğru ("1 camera").
- Test-görünür metinler sabit: modlar "Fisk's construction" / "Place your own cameras"; panel başlıkları "Colours", "Cameras", "Coverage"; boş metinler "No vertex coloured yet", "No cameras yet"; uyarı "The polygon must be simple (no crossing edges)"; ipucu "Drag the corners to change the room; in the camera mode, click a corner to place or remove a camera. Keys: ← → to step, Space to play or pause."; done "Done: 4 cameras for 14 vertices (⌊14/3⌋ = 4)"; sandbox "No cameras yet: click a corner to place one" / "3 cameras · 92% covered" / "Room covered with 3 cameras (Fisk's bound: ⌊14/3⌋ = 4)".
- Mevcut testler değişmeden geçer; sayım güncellemeleri izinli (kart 10 → 11, docs 20 → 21, "Try it" 14 → 15). Diğer oynatıcıların davranışı değişmez.
- Yeni API adları `API_NAMES`'e; hatalar `artGallery:` / `visibilityPolygon:` / `drawArtGallery:` önekli, öğe indeksi 1 tabanlı.
- Commit sonu (boş satırdan sonra), sistem notu başka model söylese bile aynen:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GDn6v79cMSt4qkDVCWkMfK
  ```
- Dal `claude/admiring-mendel-0muoxd`.

## Review Focus

1. **Kolineer ardışık köşeler ve köşelerden geçen ışınlar:** görünürlük çokgeni boşluk/sıçrama üretmemeli. Test: Görev 1 `visibility matches sampling` (kolineer köşeli çokgenler dahil).
2. **CW girdi:** saat yönünde verilen çokgen aynı kameraları vermeli (indeksler girdiye göre). Test: Görev 1 `CW input`.
3. **Tıklama ile sürükleme karışması:** 3 px altı hareket tıklama; üstü sürükleme; `clickHandle` tanımlamayan oynatıcılar etkilenmez. Test: Görev 3 StepPlayer testleri.
4. **Sandbox'ta köşe sürükleme:** girdi değişmemeli, kameralar korunmalı. Test: Görev 3 `sandbox moveHandle keeps the input`.
5. **Comb'un gerçekten 4 kamera gerektirmesi:** hiçbir 3 köşe kamerası örtmez. Test: Görev 2 `comb needs four`.

---

### Görev 1: Fisk ve görünürlük

**Files:**
- Create: `src/geometry/algorithms/artGallery/fisk.ts`, `visibility.ts`, `galleryState.ts`
- Modify: `src/geometry/types.ts` (`ArtGalleryInput = { polygon: Pt[]; cameras: number[] }`)
- Test: `fisk.test.ts`, `visibility.test.ts`

**Interfaces:**
- Produces: `dualTree(triangles: Triangle[]): { adjacency: number[][] }`, `fisk(polygon: Pt[], record?: GalleryRecorder): FiskResult` (spec §2.2: `{ triangles, colors, order, counts, chosen, cameras }`), `sees(polygon, a: Pt, b: Pt): boolean`, `visibilityPolygon(polygon, v: number): Pt[]`, `coverage(polygon, cameras: number[], step = 5): { percent: number; covered: boolean; perCamera: number[] }`, `colorName(c) → 'red' | 'green' | 'blue'`, `label(i)`.
- `galleryState.ts`: `GalleryState` (spec §3.2, plus `coverage?: { percent; covered; perCamera }`), `GalleryPatch`, `GalleryRecorderContext`, `GalleryRecorder = (line, description, patch, ctx) => void`; kayıt satırları ve açıklamalar spec §3.2 tablosu aynen (1, 2, 3, 6 (her üçgen), 7, 8, 9).
- Fisk kuralları: `ensureCCW` (indeksler girdiye göre); başlangıç üçgeni en küçük indeksli köşeyi içeren üçgenlerden en küçük indeksli; köşeleri artan indeks sırasıyla 0, 1, 2; dual ağaçta DFS (komşular üçgen indeksi sırasıyla); `chosen` en az köşeli renk (eşitlikte küçük numara); `cameras` artan.
- `visibilityPolygon`: spec §2.3 (ışınlar her köşeye ve ±1e-7 rad yanlarına; en yakın sınır kesişimi; v'nin iç açısı dışındakiler atılır; açıya göre sıralı CCW).
- `coverage`: çokgen içindeki 5 birimlik ızgara noktaları; görülen = en az bir kamera `sees`; `percent` tam sayı; `covered` = görülmeyen örnek yok; `perCamera` her kamera için ayrı yüzde.

- [ ] **Step 1: Write the failing tests.** `dualTree`: n − 2 düğüm, n − 3 kenar, bağlı; `fisk`: üçgen (1 kamera), kare (1), Textbook polygon (`TRIANGULATION_PRESETS`'ten), rastgele 200 basit çokgen (`randomStarPolygon`, seed'li, n 3–30): her üçgende üç farklı renk, `cameras.length ≤ ⌊n/3⌋`, her üçgenin bir köşesi kamera; `CW input` (ters çevrilmiş girdi → aynı kamera kümesi, girdi indekslerine göre); `deterministic` (aynı girdi iki kez aynı sonuç); `recorder lines and descriptions` (küçük sabit çokgende satır dizisi ve açıklamalar verbatim, done dahil); `visibility of a convex polygon is the polygon`; `L shape` (bilinen köşe bir kolu göremez); `visibility matches sampling` (rastgele 50 çokgen + kolineer ardışık köşeli 5 çokgen × her köşe × 200 örnek: `sees` ⇔ `pointInPolygon(visibility)`, sınıra 1e-6 yakın örnekler atlanır); `coverage` (Fisk kameraları → `covered: true`, `percent 100`; kamerasız → 0; dışbükey + 1 kamera → 100).
- [ ] **Step 2:** `npx vitest run --project node src/geometry/algorithms/artGallery` → FAIL.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** PASS; `npx tsc -b`.
- [ ] **Step 5: Commit.** `feat(geometry): Fisk's guard construction, visibility polygons and coverage`

---

### Görev 2: Sözde kod, presetler, adımlar

**Files:**
- Create: `src/geometry/algorithms/artGallery/pseudocode.ts`, `presets.ts`, `gallerySteps.ts`
- Test: `gallerySteps.test.ts`, `presets.test.ts`

**Interfaces:**
- `GALLERY_PSEUDOCODE` — spec §3.1'deki 10 satır aynen, `PSEUDOCODE_HEADINGS = [0]`.
- `GALLERY_PRESETS: { name; polygon: Pt[]; expected: { cameras: number; n: number } }[]` — spec §3.4: "Comb" (12 köşe, 4 diş; Fisk 4; hiçbir 3 köşe örtmez), "Textbook polygon" (`TRIANGULATION_PRESETS` kopyası), "Convex room" (düzgün 9-gen, merkez (387,180), r 140; Fisk 3), "L-shaped gallery", "Star", "Spiral corridor" (tasarlanır; basit; 775×360 içinde ≥ 15 pay; sayılar sabitlenir).
- `gallerySteps(input: ArtGalleryInput, mode: 'fisk' | 'sandbox' = 'fisk'): Step<GalleryState>[]` — 'fisk': spec §3.2 adımları (n + 3 adım); 'sandbox': tek adım, satır 9, açıklama spec §3.3, durum kameraları, görünürlük çokgenlerini ve `coverage` sonucunu taşır. `structuredClone`.

- [ ] **Step 1: Write the failing tests.** `pseudocode 10 lines verbatim, heading [0]`; `last fisk step matches fisk()`; `step count = n + 3`; `lines valid, never heading`; `line-6 steps colour exactly one new vertex and every triangle so far has three colours`; `newlyColored only on 3 and 6`; `snapshots independent`; `preset counts` (Fisk kamera sayısı = `expected.cameras`, `n` doğru, basit, canvas içinde); `comb needs four` (tüm 3'lü köşe kümeleri `coverage(...).covered === false`); `convex room is covered by one camera` (herhangi bir köşe); `sandbox texts` (kamerasız, kısmi, tam örtme metinleri ve tekil "1 camera"); `sandbox step carries coverage`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** PASS; `npx tsc -b`.
- [ ] **Step 5: Commit.** `feat(geometry): art gallery step generator, pseudocode and presets`

---

### Görev 3: StepPlayer `clickHandle` ve oynatıcı modülü

**Files:**
- Modify: `src/players/types.ts` (`clickHandle?(input: I, index: number): I`), `src/components/StepPlayer.tsx` (basıp 3 px'ten az hareketle bırakınca, modül tanımlıyorsa `clickHandle` çağrılır ve adımlar yeniden hesaplanır; aksi halde eski davranış), `src/styles/theme.css` (`--ag-*`, açık ve koyu blokta aynı)
- Create: `src/players/artGalleryPlayer.ts`
- Test: `src/components/StepPlayer.browser.test.tsx` (yeni testler), `src/players/artGalleryPlayer.browser.test.ts`

**Interfaces:** spec §4 ve §5 (StepPlayer) aynen: modlar, `dimmedLines('sandbox') = 0–9`, tutamaçlar, `moveHandle` (Fisk: taşır; sandbox: değiştirmeden döndürür), `clickHandle` (sandbox: kamera aç/kapa, artan sıra; Fisk: değiştirmeden döndürür), `validate`/`renderInvalid`, `randomInput` (10–16 köşe), render kuralları (Fisk ve sandbox; sandbox'ta örtülmeyen alan paper.js `unite`/`subtract`), paneller ve boş metinler, renkler, hint. Kalıp: `src/players/triangulationPlayer.ts` (basitlik koruması), `src/players/kdTreePlayer.ts` (modlar).

- [ ] **Step 1: Write the failing tests.** StepPlayer: `a click on a handle calls clickHandle and recomputes`; `a drag of ≥ 3 px does not call clickHandle`; `players without clickHandle keep their behaviour` (mevcut bir oynatıcıyla tıklama girdiyi değiştirmez). Oynatıcı: `random input is a simple polygon with 10–16 vertices`; `render is pure`; `last Fisk step: cameras ≤ ⌊n/3⌋ and no uncovered area drawn`; `colouring steps: every triangle has three different colours`; `sandbox clickHandle toggles a camera`; `sandbox moveHandle keeps the input`; `uncovered area > 0 without cameras`; `panels by phase`; `presets expose six names`; `invalid polygon shows the alert text`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** `npm test` PASS; `npx tsc -b`; `npm run build`.
- [ ] **Step 5: Commit.** `feat(player): art gallery player and clickable handles`

---

### Görev 4: Sayfa, API, demo, küçük görsel, e2e → PR

**Files:**
- Create: `src/content/algorithms/artGallery/index.mdx`, `demo.js`, `src/engine/artGallery.ts`, `public/images/artGallery_tn.png`, `tests/e2e/artGallery.spec.ts`
- Modify: `src/registry.ts` (Polygon Triangulation'dan hemen sonra), `src/registry.test.ts`, `src/engine/api.ts` (`artGallery`, `visibilityPolygon`, `drawArtGallery`), `src/engine/runtime.browser.test.ts` (`describe('art gallery api')`), `package.json` (`thumbnail:artGallery`: preset "Comb", son adım; gerekirse `--pad`), `tests/e2e/visual.spec.ts`, `tests/e2e/algorithms.spec.ts` ve `home.spec.ts` (11 kart), `scripts/pages-postbuild.test.mjs` (rota sayısı değişiyorsa)

**Interfaces:** spec §5. Girdi doğrulama `src/engine/triangulation.ts`'teki `toPolygon` ile aynı biçimde; basit değilse "artGallery: the polygon must be simple"; `visibilityPolygon(polygon, i)` 0 tabanlı köşe indeksi, aralık dışı → "visibilityPolygon: vertex index out of range"; `drawArtGallery` çizilebilirleri `ctx.drawables`'a. `demo.js`: rastgele yıldız çokgen, `artGallery`, `drawArtGallery`, `console.log(result.cameras.length + ' camera(s) for ' + n + ' vertices')` (çıktı `/^\d+ camera\(s\) for \d+ vertices$/`). MDX spec §5 (kitap cümlesi aynen).

- [ ] **Step 1: Write the failing tests.** API (browser): kare → 1 kamera; Comb → 4; CW girdi; `Polygon`/TextPoint/`{x,y}`/`[x,y]` girdileri; basit olmayan → mesaj; hatalı nokta → "artGallery: expected an array of points (item 2 is not a point)" (toPolygon kalıbı); `visibilityPolygon` aralık dışı → mesaj; `drawArtGallery` çizilebilir sayısı = kamera sayısı × 2 (simge + bölge) veya uygulamanın belgelediği sayı; demo regex. e2e: `page opens on the step tab` (h1 "Art Gallery Problem", "Colours" paneli); `presets reach the expected totals` (her preset → Last → done metni `expected`'tan); `comb needs four cameras`; `sandbox: clicking a corner places a camera` (Mode → "Place your own cameras" → bir köşe tutamacına tıkla → açıklama "1 camera · …%" ya da "Room covered with 1 camera …"); `code tab runs the demo`. `visual.spec` sayfa; kart 11.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz; küçük görseli üret ve kırpılmadığını gör.
- [ ] **Step 4:** `npm test`, `npx tsc -b`, `npm run build`, `npm run e2e -- --trace off` → PASS; alt yol çalıştırması (smoke, home, artGallery) → PASS; kök `dist` geri üretilir; 375/1280 açık/koyu ekran görüntülerine bak.
- [ ] **Step 5: Commit.** `feat: art gallery page, demo and API`
- [ ] **Step 6 (controller):** PR; yerel `/webcgal/` derlemesinden ekran görüntüleri.

---

### Görev 5: Dokümantasyon öğesi `artGallery`

**Files:** Create `src/content/docs/artGallery.mdx`, `examples/artGallery.js` (demo.js aynen); Modify `src/content/docs/index.ts` (`misc_functions`, `kdTree`'den sonra), `docs.test.ts` (`newItems` + 21), `tests/e2e/docs.spec.ts` (21 / "Try it" 15), `scripts/pages-postbuild.test.mjs` (rota sayısı değişiyorsa).

- [ ] **Step 1:** Testler → FAIL. **Step 2:** MDX (~200 kelime; imzalar, girdi biçimleri, sonuç alanları (0 tabanlı), `visibilityPolygon`, `drawArtGallery`, hata mesajları, link `[Art Gallery Problem](/algorithms/artGallery)`; iddialar `src/engine/artGallery.ts` okunarak doğrulanır; MDX'te `{`/`<` kaçışları). **Step 3:** `npm test`, `npm run e2e -- --trace off tests/e2e/docs.spec.ts` → PASS. **Step 4: Commit.** `docs: artGallery API item`

---

### Görev 6: README

- [ ] **Step 1:** README: özellikler ve oynatıcı paragrafına Art Gallery (de Berg §3.1, Fisk'in ⌊n/3⌋ kurgusu, sandbox modu, `clickHandle`), proje yapısına `src/geometry/algorithms/artGallery/`, `thumbnail:artGallery`, canlı alt yol e2e örneğine `tests/e2e/artGallery.spec.ts`. `npm run build` geçer.
- [ ] **Step 2: Commit.** `docs: README for the art gallery page`; push.
- [ ] **Step 3 (controller):** Son inceleme + düzeltme dalgası; PR açıklaması; birleşme sonrası canlı kontrol.
