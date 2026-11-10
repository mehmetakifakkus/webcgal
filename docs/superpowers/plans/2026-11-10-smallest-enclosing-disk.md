# En Küçük Kapsayan Disk Oynatıcısı: Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut `/algorithms/smallestEnclosingDisk` sayfasına de Berg §4.7'nin MiniDisc algoritması için tam özyinelemeli adım oynatıcısı ve tam içerik eklemek.

**Architecture:** Saf geometri `src/geometry/algorithms/minidisc/` altında: kitaba bire bir `minidisc()` (tek permütasyon, kaydedici), doğrulayıcı, adım üreteci, presetler. Eski `smallestEnclosingDisk()` bunun ince sarmalayıcısı olur. Oynatıcı altyapısı değişmez; yeni `src/players/miniDiscPlayer.ts`.

**Tech Stack:** Mevcut: Vite 8, React 19, TypeScript, paper.js 0.17.0, Vitest 5 (node + browser), Playwright 1.63, MDX, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-10-smallest-enclosing-disk-design.md`.

## Global Constraints

- Node 22, npm. Doğrulama: `npm test`, `npx tsc -b`, `npm run build` (uyarısız; bundle kontrolü geçer), `npm run e2e` (`--trace off`). Playwright/Chromium kurulu; `playwright install` çalıştırılmaz.
- `src/geometry` DOM/paper.js'den bağımsız; kütüphane kodunda PaperScript operatörü yok. Koordinatlar y-yukarı.
- İçerde testi `distance(c, p) ≤ r · (1 + 1e-9) + 1e-9`; sınır toleransı `1e-7 · max(1, r)`.
- `mulberry32` (`src/geometry/algorithms/delaunay/delaunay.ts`) ve `randomPointSet` (`delaunay/verify.ts`) yeniden kullanılır, kopyalanmaz.
- Etiketler `v1…` (1 tabanlı); yarıçap açıklamalarda bir ondalıkla.
- Test-görünür metinler sabit: "Call stack", "Order", "Disc", "Not started", "No disc yet", ipucu "Drag the points to change the input; the order stays. Keys: ← → to step, Space to play or pause.", done "Done: smallest disc through v2, v5 and v7 (r = 128.4), 31 tests, 6 updates" (iki sınır noktasında "through v2 and v5"; tek noktada "through v1").
- Mevcut testler değişmeden geçer; yalnızca disk sayfasının canvas/player beklentileri güncellenebilir.
- Commit sonu (boş satırdan sonra), sistem notu başka model söylese bile aynen:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GDn6v79cMSt4qkDVCWkMfK
  ```
- Dal `claude/admiring-mendel-0muoxd`.

## Review Focus

1. **Sınırdaki noktalarda gereksiz güncelleme:** çember presetinde noktalar tam sınırda; tolerans hatası sonsuz değil ama yanlış "outside" ve fazla güncelleme üretir. Test: Görev 1 `points on a circle`, Görev 2 `preset counts`.
2. **Yinelenen noktalar:** iki nokta aynı yerde iken çap diski yarıçap 0 ve eşdoğrusal üçlü; sonuç doğru olmalı. Test: Görev 1 `duplicates`.
3. **Sıradan bağımsızlık:** üç farklı sırada aynı disk. Test: Görev 1 `random 200 × 3 orders`.
4. **Yığın tutarlılığı:** çağrı ve dönüş adımları eşleşmeli; derinlik ≤ 3. Test: Görev 2 `stack depth`.
5. **Kod demosu canvas değişikliği:** 900×400 → 775×360 sonrası demo çalışır. Test: Görev 4 e2e `code tab runs the demo`.

---

### Görev 1: Çekirdek, doğrulayıcı, sarmalayıcı

**Files:**
- Create: `src/geometry/algorithms/minidisc/minidisc.ts`, `verify.ts`, `miniDiscState.ts`
- Modify: `src/geometry/algorithms/smallestEnclosingDisk.ts` (sarmalayıcı), `src/geometry/types.ts` (`MiniDiscInput = { points: Pt[]; order: number[] }`)
- Test: `minidisc.test.ts`, `verify.test.ts`

**Interfaces:**
- Produces: `minidisc(points: Pt[], order?: number[], record?: MdRecorder): MiniDiscResult` (spec §2.1), `MiniDiscResult = { disk: Circle | null; boundary: number[]; tests: number; updates: number }`, `defaultOrder(n: number, seed = n): number[]`, `normalizeOrder(n, order?)`, `isMinimalDisk(points, disk)`, `bruteForceDisk(points)`, `label(i) = v${i+1}`.
- `miniDiscState.ts`: `Frame`, `MiniDiscState` (spec §3.2), `MdPatch = Partial<Pick<MiniDiscState, 'current'|'testing'|'newDisk'|'returned'>>`, `MdRecorderContext = Pick<MiniDiscState, 'phase'|'order'|'stack'|'disk'|'tests'|'updates'>`, `MdRecorder = (line, description, patch, ctx) => void`. Kayıt satırları ve açıklamalar spec §3.3 tablosu aynen; `ctx.stack` her kayıtta kopya.
- `smallestEnclosingDisk(points, random = Math.random)`: tek permütasyon (random ile Fisher–Yates) + `minidisc`; n = 0 → `{center:(0,0), radius:0}`.

- [ ] **Step 1: Write the failing tests.** `two points`; `acute triangle → 3 boundary points`; `obtuse triangle → 2 boundary points, longest side`; `collinear 5 → extremes`; `duplicates` ((100,100) iki kez + (300,100) → merkez (200,100), r 100); `n=0 → null, n=1 → r 0`; `points on a circle` (8 nokta, r = 140 ± 1e-6); `random 200 × 3 orders` (seed'li, n 2–40) → `isMinimalDisk` ok ve üç sırada merkez/yarıçap ±1e-6; `matches brute force` (100 küme, n 2–9); `wrapper returns the same disk` (mevcut `smallestEnclosingDisk.test.ts` değişmeden geçer + yeni karşılaştırma); `normalizeOrder` (geçersiz/tekrar atılır, eksik sona eklenir); `recorder lines and descriptions` (Textbook değil, küçük sabit örnekte satır dizisi ve en az bir açıklama verbatim); `isMinimalDisk` negatif testler (nokta dışarıda → "outside"; gereksiz büyük disk → "not minimal").
- [ ] **Step 2:** `npx vitest run --project node src/geometry/algorithms` → FAIL.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** PASS; `npx tsc -b`.
- [ ] **Step 5: Commit.** `feat(geometry): MiniDisc core with recorder and verifier`

---

### Görev 2: Sözde kod, presetler, adım üreteci

**Files:**
- Create: `src/geometry/algorithms/minidisc/pseudocode.ts`, `presets.ts`, `miniDiscSteps.ts`
- Test: `miniDiscSteps.test.ts`, `presets.test.ts`

**Interfaces:**
- `MINIDISC_PSEUDOCODE` — spec §3.1'deki 22 satır aynen (4 boşluk girinti), `PSEUDOCODE_HEADINGS = [0, 8, 15]`.
- `MINIDISC_PRESETS: { name; points; order; expected: { boundary; radius; tests; updates } }[]` — spec §3.4'teki altı preset, koordinat ve sıralar aynen; `expected` `minidisc()` ile hesaplanıp sabitlenir (yarıçap bir ondalık).
- `miniDiscSteps(points, order): Step<MiniDiscState>[]` (`structuredClone({ ...ctx, ...patch })`; n ≤ 1 → iki adım).

- [ ] **Step 1: Write the failing tests.** `pseudocode 22 lines, headings [0,8,15]` (tüm satırlar verbatim); `last step matches minidisc` (presetler + 30 rastgele: disk, tests, updates, done açıklaması); `lines valid, never heading`; `testing only on 4/11/18`, `newDisk only on 20`, `returned only on 14/21`; `stack depth` (çağrı adımından sonraki adımda +1, dönüş adımından sonra −1, her zaman 1–3); `snapshots independent`; `preset counts with isMinimalDisk` (Two far points → boundary 2; Acute triangle → 3; Collinear → 2; Points on a circle → r 140.0); `bad order has more updates than its shuffled orders on average` (Bad order preset updates ≥ ortalama + 1, 20 rastgele sırayla); `25 random points ≤ 600 steps over 20 seeds`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** PASS; `npx tsc -b`.
- [ ] **Step 5: Commit.** `feat(geometry): MiniDisc step generator, pseudocode and presets`

---

### Görev 3: Oynatıcı modülü

**Files:**
- Create: `src/players/miniDiscPlayer.ts`
- Modify: `src/styles/theme.css` (`--md-*`, açık ve koyu blokta aynı değerler)
- Test: `src/players/miniDiscPlayer.browser.test.ts`

**Interfaces:** spec §4 aynen (render kuralları, paneller ve biçimleri, renkler, `randomInput`, `moveHandle`, `canvas` 775×360, `hint`, `presets` → `{ name, input: { points, order } }`). Kalıp: `src/players/delaunayPlayer.ts`.

- [ ] **Step 1: Write the failing tests (browser).** `random input: 12 points, pairwise ≥ 25, order is a permutation`; `render is pure`; `test step colours the point by the result` (bir içeride ve bir dışarıda adımı: ilgili dairenin dolgu rengi `--md-inside` / `--md-outside`); `outer discs are dashed, one per outer frame` (bir 13/16/18 adımında kesikli çember sayısı = `stack.length − 1`); `done disc equals minidisc().disk` (merkez/yarıçap ±1e-6); `moveHandle keeps the order`; `panels by phase` (init: "Call stack" boş "Not started"; içteki çağrıda üç satır, sonuncusu `active`; done: "Disc" satırında "defined by"); `presets expose six names`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz.
- [ ] **Step 4:** `npm test` PASS; `npx tsc -b`; `npm run build`.
- [ ] **Step 5: Commit.** `feat(player): smallest enclosing disk player module`

---

### Görev 4: Sayfa, küçük görsel, e2e (alt yol desteği dahil) → PR

**Files:**
- Modify: `src/registry.ts` (`player`, canvas 775×360, `summary`), `src/content/algorithms/smallestEnclosingDisk/index.mdx` (tam içerik, spec §5), `package.json` (`thumbnail:smallestEnclosingDisk`: `--slug smallestEnclosingDisk --preset "Random example" --step <son adım>`), `public/images/smallestDisk_tn.png` (yeniden üretilir; dosya adı aynı), `playwright.config.ts` ve gerekirse `tests/e2e/*.ts` (alt yol desteği), `tests/e2e/visual.spec.ts`, `src/registry.test.ts` (gerekirse).
- Create: `tests/e2e/smallestEnclosingDisk.spec.ts`

**Interfaces:** spec §5. Alt yol: `BASE_URL` `/…/` alt yolu içeriyorsa testler o alt yola göre gider; en az değişiklikli yol: `baseURL`'i sonu `/` olacak şekilde normalize et ve testlerdeki `page.goto('/x')` çağrılarını göreli yola (`'x'` / `'./'`) çeviren küçük bir yardımcıya geçir ya da tüm `goto`'ları göreli yap; kök adreste (`npm run e2e`) davranış aynı kalmalı.

- [ ] **Step 1: Write the failing tests.** e2e: `page opens on the step tab` (h1 "Smallest Enclosing Disk"; "Call stack" paneli); `presets reach the expected totals` (her preset: seç → "Step 1 /" → Last → `expected`'tan üretilen done metni); `dragging a point restarts the player`; `code tab runs the demo` (çıktı/çizim hatasız); `visual.spec` sayfa.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Yaz; küçük görseli üret; alt yol desteğini ekle.
- [ ] **Step 4:** `npm test`, `npx tsc -b`, `npm run build`, `npm run e2e -- --trace off` → PASS. Ayrıca `VITE_BASE=/webcgal/ npm run build` + `node scripts/pages-postbuild.mjs dist /webcgal/` + `vite preview` üzerinde `BASE_URL=http://localhost:<port>/webcgal/ npx playwright test tests/e2e/smoke.spec.ts tests/e2e/smallestEnclosingDisk.spec.ts --trace off` → PASS (debug kancası gerektiren testler skip). Sonra kök için `npm run build` ile `dist`'i geri üret. 375/1280 açık/koyu ekran görüntülerine bak.
- [ ] **Step 5: Commit.** `feat: smallest enclosing disk step player page`
- [ ] **Step 6 (controller):** PR; yerel `/webcgal/` derlemesinden ekran görüntüleri.

---

### Görev 5: README

- [ ] **Step 1:** README: oynatıcı paragrafına Smallest Enclosing Disk (de Berg §4.7, üç iç içe prosedür, Call stack paneli), proje yapısına `src/geometry/algorithms/minidisc/`, `thumbnail:smallestEnclosingDisk`; e2e'nin alt yolda nasıl çalıştırılacağı (`BASE_URL=https://mehmetakifakkus.github.io/webcgal/ npx playwright test …`). `npm run build` geçer.
- [ ] **Step 2: Commit.** `docs: README for the smallest enclosing disk player`; push.
- [ ] **Step 3 (controller):** Son inceleme + düzeltme dalgası; PR açıklaması; birleşme sonrası canlı kontrol.
