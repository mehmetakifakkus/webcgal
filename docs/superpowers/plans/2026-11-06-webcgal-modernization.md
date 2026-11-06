# WebCgal Modernizasyonu: Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Express + EJS + PaperScript sitesini Vite + React + TypeScript SPA'ya taşımak, Convex Hull için adım adım oynatıcı eklemek ve siteyi Netlify'da `webcgal` adıyla yayınlamak.

**Architecture:**
- **`src/geometry/`:** Saf ve test edilebilir geometri kodu.
- **`src/engine/`:** paper.js çizim katmanı ve eski API ile uyumlu kullanıcı API'si. Bu katmanın içindeki `runtime.ts`, kullanıcı kodunu `paper.PaperScript.compile` ile derleyip API enjekte edilmiş bir kapsamda çalıştırır.
- **`src/components/` ve `src/pages/`:** React arayüzü.
- **`src/content/`:** MDX metinler ve demo kodları.
- **`src/registry.ts`:** Algoritma listesi; menü ve yönlendirme bu listeden üretilir.

**Tech Stack:** Vite, React 18+, TypeScript, React Router, `@mdx-js/rollup`, paper.js 0.17.x, CodeMirror 6 (`@uiw/react-codemirror` veya doğrudan `@codemirror/*`), Vitest (node + browser mode), Playwright, Netlify.

**Spec:** `docs/superpowers/specs/2026-11-06-webcgal-modernization-design.md`. Her görev, spec'in ilgili bölümüyle birlikte okunmalıdır.

## Global Constraints

- Node 22 (`netlify.toml` → `NODE_VERSION = "22"`), npm.
- Build: `npm run build` → `dist/`. Testler: `npm test` (Vitest, node + browser projeleri), `npm run e2e` (Playwright, `--trace off`).
- Playwright ve Vitest browser mode, ortamdaki Chromium'u kullanır. Proje ortamdaki sürümden farklı bir `@playwright/test` sürümü kurarsa, `launchOptions.executablePath` için `/opt/pw-browsers/chromium` verilir. `playwright install` çalıştırılmaz.
- URL'ler ve slug'lar, büyük/küçük harf dahil aynen korunur: `/algorithms/convexHull`, `/algorithms/smallestEnclosingDisk`, `/algorithms/L-monoton`, `/algorithms/duality`, `/algorithms/duality/dualLine`, `/algorithms/duality/checkStabber`, `/documentation`, `/documentation/:item`, `/playground`.
- İçerik dili İngilizce. Arayüz metinleri de İngilizce olur (Play, Step, Run, Reset…).
- Kaldırılanlar: Express, EJS, nodemon, pm2, reload, jQuery, w3.css, eski CSS, Universal Analytics, `examples_old/`, repodaki `node_modules/`, nerdamer. 3 noktadan geçen çember kapalı formülle hesaplanır.
- Ek UI kütüphanesi yok. Stil sade CSS ile yazılır, renkler CSS değişkenleriyle tanımlanır, açık/koyu tema `prefers-color-scheme` ile seçilir.
- Kütüphane kodu (`src/engine`) PaperScript operatörlerini **kullanmaz** (`a + b` yerine `a.add(b)`). Kullanıcı ve demo kodu ise PaperScript olarak derlenir.
- Kullanıcı koduna açılan adlar `src/engine/api.ts` içinde tek bir listede toplanır. Görev 5'teki tablo bu listenin asgari içeriğidir.
- Commit mesajlarının sonuna şu satırlar eklenir:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GDn6v79cMSt4qkDVCWkMfK
  ```
  Commit'ler `claude/admiring-mendel-0muoxd` dalına push'lanır.

## Review Focus

1. **Kodu art arda çalıştırmak:** Bir önceki çalıştırmadan kalan `onFrame` ve `onMouseDrag` gibi olay işleyicileri ile çizimler temizlenmeli; ikinci çalıştırma yalnızca yeni kodun etkisini göstermeli. Test: Görev 5'teki `run twice replaces handlers`.
2. **Sayfalar arasında gezinme:** Bir algoritma sayfasından ötekine geçildiğinde önceki `PaperScope`, işleyicileri ve animasyon döngüsü bırakılmalı; konsolda hata ve çift animasyon olmamalı. Test: Görev 7'deki `navigating between algorithms leaves no errors`.
3. **Dejenere noktalar:** Hepsi aynı doğru üzerinde olan, üst üste binen veya 0–2 adet nokta verildiğinde Convex Hull, adım üreteci ve Smallest Enclosing Disk çökmemeli, anlamlı bir sonuç dönmeli. Testler: Görev 2, 3 ve 4'teki uç durum testleri.
4. **Dar ekranda canvas:** Canvas CSS ile küçültüldüğünde tıklama ve sürükleme hâlâ doğru noktaya denk gelmeli (y ekseni ters çevirme bozulmamalı). Test: Görev 7'deki `drag works at 375px width`.
5. **`localStorage` erişilemezken:** Gizli pencere veya engellenmiş depolama durumunda playground yine açılmalı ve çalışmalı. Test: Görev 6'daki `playground works without localStorage`.

---

### Görev 1: Proje iskeleti, eski kodun `legacy/` klasörüne taşınması, Netlify yapılandırması

**Files:**
- Move: `app/` → `legacy/app/`, `examples_old/` → silinir (git geçmişinde kalır)
- Delete from git: `node_modules/` (`.gitignore`'a eklenir)
- Replace: `package.json`. Eski bağımlılıklar kaldırılır; yerine `vite`, `react`, `react-dom`, `react-router-dom`, `paper`, `@mdx-js/rollup`, `typescript`, `vitest`, `@vitest/browser`, `@playwright/test`, `@vitejs/plugin-react`, CodeMirror paketleri eklenir.
- Create: `index.html`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts` (iki proje: `node` → `src/**/*.test.ts`, `browser` → `src/**/*.browser.test.ts(x)`), `playwright.config.ts` (webServer: `npm run preview`), `src/main.tsx`, `src/App.tsx`, `src/components/Layout.tsx` (üst menü: Home, Algorithms, Documentation, Playground), `src/pages/NotFound.tsx`, `src/styles/global.css`, `netlify.toml` (spec §9'daki içerik aynen), `public/images/*` (`legacy/app/public/images` içinden kopyalanır)
- Test: `src/App.browser.test.tsx`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces: `<Layout>` (sayfaları saran bileşen, `children` alır); router'da `/` ve `*` (NotFound) tanımlı. Sonraki görevler `src/App.tsx` içine route ekler.
- Produces: npm script'leri: `dev`, `build` (`tsc -b && vite build`), `preview`, `test`, `e2e`.

- [ ] **Step 1:** `git mv app legacy/app`, `git rm -r --cached node_modules`, `git rm -r examples_old`. `.gitignore`'a `node_modules`, `dist`, `test-results`, `playwright-report` eklenir.
- [ ] **Step 2:** Vite + React + TS iskeleti kurulur. `npm install` çalıştırılır ve `package-lock.json` commit edilir.
- [ ] **Step 3: Write the failing test.** `src/App.browser.test.tsx` içinde `renders layout and 404`: `/bu-yok` adresine yönlendirilmiş bir `MemoryRouter` ile `App` render edilir. Ardından `Algorithms` linkinin ve "Page not found" metninin göründüğü doğrulanır.
- [ ] **Step 4:** `npm test` çalıştırılır. Beklenen: FAIL.
- [ ] **Step 5:** `Layout` ve `NotFound` bileşenleri yazılır. `App`, `BrowserRouter`'ı `main.tsx` içinde kullanır; testte `MemoryRouter` ile sarılabilmesi için `App` yalnızca `<Routes>` içerir.
- [ ] **Step 6:** `npm test` çalıştırılır (beklenen: PASS). `npm run build` çalıştırılır (beklenen: `dist/index.html` oluşur).
- [ ] **Step 7:** `tests/e2e/smoke.spec.ts` içinde `home loads without console errors` testi yazılır: `/` açılır ve `page.on('console')` ile hiç `error` gelmediği doğrulanır. `npm run e2e` çalıştırılır. Beklenen: PASS.
- [ ] **Step 8: Commit.** Mesaj: `chore: scaffold Vite + React app, move legacy site to legacy/`

---

### Görev 2: Geometri temelleri ve Convex Hull

**Files:**
- Create: `src/geometry/types.ts`, `src/geometry/primitives.ts`, `src/geometry/algorithms/convexHull.ts`
- Test: `src/geometry/primitives.test.ts`, `src/geometry/algorithms/convexHull.test.ts`

**Interfaces:**
- Produces:
  - `type Pt = { x: number; y: number }`, `type Circle = { center: Pt; radius: number }`, `type Line = { slope: number; intercept: number }` (y = slope·x + intercept)
  - `subtract(a: Pt, b: Pt): Pt`, `dot(u: Pt, v: Pt): number`, `crossVec(u: Pt, v: Pt): number`, `distance(a: Pt, b: Pt): number`
  - `cross(o: Pt, a: Pt, b: Pt): number`: (a−o)×(b−o). >0 ise o→a→b sola (saat yönünün tersine) dönüştür; koordinat sisteminde y yukarı doğrudur.
  - `orientation(o: Pt, a: Pt, b: Pt): -1 | 0 | 1`: `EPS = 1e-9` toleransıyla.
  - `convexHull(points: Pt[]): Pt[]`: Andrew monotone chain. Noktalar x'e, eşitlikte y'ye göre sıralanır; tekrarlanan noktalar atılır. Kenar üzerindeki doğrusal noktalar zarfa **alınmaz**. Sonuç, en soldaki noktadan başlayıp **saat yönünde** ilerler (önce üst zarf soldan sağa, sonra alt zarf sağdan sola) ve ilk nokta sonda tekrarlanmaz.

- [ ] **Step 1: Write the failing tests.**
  - `primitives.test.ts`: `cross({0,0},{1,0},{0,1}) === 1`; `orientation` sola dönüşte 1, sağa dönüşte −1, doğrusal noktalarda 0 döner; `distance({0,0},{3,4}) === 5`.
  - `convexHull.test.ts`:
    - `square with interior point`: (0,0), (2,0), (2,2), (0,2), (1,1) → `[(0,0),(0,2),(2,2),(2,0)]`.
    - `collinear points on edge are dropped`: (0,0), (1,0), (2,0), (1,1) → 3 nokta.
    - `all collinear`: (0,0), (1,1), (2,2) → `[(0,0),(2,2)]`.
    - `duplicates`: (1,1), (1,1), (0,0) → 2 nokta.
    - `0/1/2 points`: `[]` → `[]`; tek nokta → aynı nokta; iki farklı nokta → ikisi.
    - `random 200 points`: rastgele noktalarda (rastgelelik sabit bir seed'le üretilir) her ardışık üçlü için `orientation(...) === -1` olur (zarf saat yönünde ve konvekstir) ve hiçbir nokta zarfın dışında kalmaz (her kenar için `orientation` ≤ 0).
- [ ] **Step 2:** `npm test -- src/geometry` çalıştırılır. Beklenen: FAIL (modül yok).
- [ ] **Step 3:** `primitives.ts` ve `convexHull.ts` yazılır.
- [ ] **Step 4:** `npm test -- src/geometry` çalıştırılır. Beklenen: PASS.
- [ ] **Step 5: Commit.** Mesaj: `feat(geometry): primitives and convex hull`

---

### Görev 3: Convex Hull adım üreteci ve sözde kod

**Files:**
- Create: `src/geometry/steps.ts`, `src/geometry/algorithms/convexHullSteps.ts`
- Test: `src/geometry/algorithms/convexHullSteps.test.ts`

**Interfaces:**
- Consumes: Görev 2'deki `Pt`, `orientation` ve `convexHull`.
- Produces:
  - `type Step<S> = { description: string; line: number; state: S }` (`steps.ts` içinde)
  - `type HullState = { sorted: Pt[]; upper: Pt[]; lower: Pt[]; current?: Pt; testing?: [Pt, Pt, Pt]; removed?: Pt; phase: "sort" | "upper" | "lower" | "done" }`
  - `CONVEX_HULL_PSEUDOCODE: string[]`. İçerik aynen şöyledir (indeksler 0'dan başlar):
    ```
    0  Sort the points by x-coordinate, resulting in p1, …, pn
    1  Put p1 and p2 in L_upper
    2  for i ← 3 to n
    3      Append pi to L_upper
    4      while L_upper has > 2 points and the last three do not make a right turn
    5          Delete the middle of the last three points from L_upper
    6  Put pn and pn−1 in L_lower
    7  for i ← n − 2 downto 1
    8      Append pi to L_lower
    9      while L_lower has > 2 points and the last three do not make a right turn
    10         Delete the middle of the last three points from L_lower
    11 Remove the first and last point from L_lower
    12 Append L_lower to L_upper; return L_upper
    ```
  - `convexHullSteps(points: Pt[]): Step<HullState>[]`. Adımlar şu sırayla üretilir: sıralama (line 0), başlangıç (1), her ekleme (3), her dönüş testi (4, `testing` dolu), her silme (5, `removed` dolu); aynısı alt zarf için (6–10); birleştirme (11–12, `phase: "done"`). Açıklamalar İngilizcedir ve noktalar sıralamadaki indeksleriyle anılır (`"p5, p6, p7 make a left turn: delete p6"`).

- [ ] **Step 1: Write the failing tests.**
  - `last step matches convexHull`: rastgele 50 nokta için son adımda `phase === "done"` olur ve `upper.concat(lower kırpılmış)` dizisi `convexHull(points)` sonucuna eşittir.
  - `line indices are valid`: her adımda `0 <= line < CONVEX_HULL_PSEUDOCODE.length`.
  - `every removal is preceded by a test`: `line === 5` olan her adımdan hemen önce `line === 4` olan bir adım gelir ve o adımın `testing[1]`'i, silme adımının `removed` noktasıyla aynıdır.
  - `degenerate inputs`: 0, 1 ve 2 nokta ile tamamen doğrusal noktalar için hata atılmaz, son adım `"done"` olur ve sonucu `convexHull` ile eşleşir.
  - `snapshots are independent`: k. adımın dizileri sonraki adımlarda değişmez (her adım kendi kopyasını taşır).
- [ ] **Step 2:** `npm test -- convexHullSteps` çalıştırılır. Beklenen: FAIL.
- [ ] **Step 3:** `convexHullSteps` yazılır. Algoritma Görev 2'dekiyle aynıdır; her adımda `structuredClone` ile anlık durum kaydedilir.
- [ ] **Step 4:** `npm test -- convexHullSteps` çalıştırılır. Beklenen: PASS.
- [ ] **Step 5: Commit.** Mesaj: `feat(geometry): convex hull step generator`

---

### Görev 4: Smallest Enclosing Disk, dualite ve monotonluk

**Files:**
- Create: `src/geometry/algorithms/smallestEnclosingDisk.ts`, `src/geometry/algorithms/duality.ts`, `src/geometry/algorithms/monotone.ts`
- Test: aynı adlarla `.test.ts`
- Referans (değiştirilmez): `legacy/app/views/partials/paperjs/smallestEnclosingDisk.js`, `circle.js`, `legacy/app/views/algorithms/duality/*.ejs`, `L-monoton.ejs`

**Interfaces:**
- Consumes: `Pt`, `Circle`, `Line`, `orientation`, `distance`.
- Produces:
  - `circleFrom2(a: Pt, b: Pt): Circle`
  - `circumcircle(a: Pt, b: Pt, c: Pt): Circle | null`: Noktalar doğrusalsa `null` döner. Kapalı formülle hesaplanır; nerdamer kullanılmaz.
  - `smallestEnclosingDisk(points: Pt[], random?: () => number): Circle`: de Berg 4.7'deki rastgele artımlı MiniDisc algoritması. 0 nokta için `{center:{0,0}, radius:0}`, 1 nokta için yarıçapı 0 olan daire döner. `circumcircle` null dönerse en uzak iki noktanın `circleFrom2` sonucu kullanılır.
  - `dualLine(p: Pt): Line`: `{ slope: p.x, intercept: -p.y }` (eski sayfadaki y = a·x − b dönüşümü).
  - `dualPoint(l: Line): Pt`: `{ x: l.slope, y: -l.intercept }`.
  - `findStabber(segments: [Pt, Pt][]): Line | null`: Dikey olmayan ve tüm parçaları kesen (uç nokta dahil) bir doğru arar. Yöntem: parça uç noktalarının her ikilisinden geçen dikey olmayan doğrular denenir ve tüm parçaları kesen ilk doğru döner. 0–1 parça için kesen bir doğru her zaman vardır.
  - `isMonotone(polygon: Pt[], angleDeg: number): boolean`: Poligon, açısı `angleDeg` olan L doğrusuna göre monoton mu? L'ye dik her doğru poligonu en fazla bir bağlı parçada kesmelidir. Eşdeğer biçimde: L yönündeki izdüşüm dizisinin döngüsel olarak tam bir yerel maksimumu ve tam bir yerel minimumu vardır.
  - `monotoneDirections(polygon: Pt[]): Array<[number, number]>`: Geçerli açı aralıkları; derece cinsinden, `[0, 180)` içinde ve sıralıdır. Kritik açılar kenarlara dik olan yönlerdir; her aralığın orta noktası `isMonotone` ile test edilir. Kenar açısına tam denk gelen sınırlar aralığa dahil edilmez.

- [ ] **Step 1: Write the failing tests.**
  - `smallestEnclosingDisk.test.ts`:
    - `two points` → merkez orta noktadır, yarıçap mesafenin yarısıdır.
    - `equilateral triangle` (0,0), (2,0), (1,√3) → merkez (1, √3/3), yarıçap 2/√3 (`toBeCloseTo`, 6 basamak).
    - `obtuse triangle` (0,0), (10,0), (5,1) → disk, (0,0)–(10,0) parçasının dairesidir.
    - `collinear` (0,0), (1,0), (5,0) → merkez (2.5,0), yarıçap 2.5.
    - `random 100 points` (sabit seed) → tüm noktalar `distance ≤ r + 1e-9` koşulunu sağlar.
    - `circumcircle returns null for collinear`.
  - `duality.test.ts`:
    - `dualLine({2,3})` → `{slope:2, intercept:-3}`; `dualPoint(dualLine(p))` p'yi geri verir.
    - Şu üç dikey parçayı kesen bir doğru bulunur ve döndürülen doğru üçünü de keser: x=0, 2, 4 konumlarında, y aralıkları [0,2], [1,3], [2,4].
    - `[(0,0),(0,1)]`, `[(1,5),(1,6)]`, `[(2,0),(2,1)]` için `null` döner.
  - `monotone.test.ts`:
    - `convex polygon` (kare) → `[[0, 180]]`.
    - `isMonotone` için U şeklinde poligon (0,0), (3,0), (3,3), (2,3), (2,1), (1,1), (1,3), (0,3): 0° için `true` döner (yatay L'ye göre monoton), 90° için `false` döner.
    - `monotoneDirections` U şekli için 0°'yi içeren ve 90°'yi içermeyen aralıklar döndürür.
- [ ] **Step 2:** `npm test -- src/geometry` çalıştırılır. Beklenen: yeni testler FAIL.
- [ ] **Step 3:** Üç modül yazılır.
- [ ] **Step 4:** `npm test -- src/geometry` çalıştırılır. Beklenen: PASS.
- [ ] **Step 5: Commit.** Mesaj: `feat(geometry): smallest enclosing disk, duality, monotonicity`

---

### Görev 5: Motor ve runtime (eski API ile uyumlu)

**Files:**
- Create:
  - `src/engine/scene.ts`
  - `src/engine/TextPoint.ts`
  - `src/engine/Points.ts`
  - `src/engine/Polygon.ts`
  - `src/engine/Vector.ts`
  - `src/engine/drawing.ts`
  - `src/engine/polygons.ts`
  - `src/engine/assets/predefinedPolygons.svg`, `legacy/app/views/partials/paperjs/pre_defined_polygons.svg` dosyasından kopyalanır.
  - `src/engine/api.ts`
  - `src/engine/runtime.ts`
- Test: `src/engine/runtime.browser.test.ts`
- Referans: `legacy/app/views/partials/paperjs/*.js`

**Interfaces:**
- Consumes: Görev 2 ve 4'teki geometri fonksiyonları (eski API sarmalayıcıları bunları çağırır).
- Produces:
  - `type OutputLine = { kind: "log" | "warn" | "error"; text: string }`
  - `createScene(canvas: HTMLCanvasElement): Scene`
    - `Scene = { paper: paper.PaperScope; clear(): void; dispose(): void; height: number }`
    - Canvas'ın iç boyutu sabittir (`width` ve `height` niteliklerinden okunur). y ekseni, aktif katmanın dönüşüm matrisi `Matrix(1,0,0,-1,0,height)` yapılarak ters çevrilir. Fare olaylarının doğru noktaya denk gelmesi için paper.js'in CSS ölçeklemesine dokunulmaz: canvas `style.width: 100%` ile küçültülür ve olay koordinatları paper.js tarafından iç koordinata çevrilir.
  - `buildApi(scene: Scene, output: (l: OutputLine) => void): Record<string, unknown>`. Asgari ad listesi aşağıdaki tablodadır.
  - `run(code: string, opts: { scene: Scene; output: (l: OutputLine) => void; extraCanvases?: Record<string, HTMLCanvasElement> }): { ok: true } | { ok: false; error: OutputLine & { line?: number } }`
    - Önce önceki çalıştırma temizlenir: `scene.clear()` çağrılır, `paper.view` ve `tool` işleyicileri kaldırılır, `TextPoint` sayacı sıfırlanır.
    - Sonra kod `paper.PaperScript.compile(code)` ile derlenir. Derlenen kod `new Function(...apiNames, ...paperNames, compiled + returnHandlers)` ile sarılıp çalıştırılır. `returnHandlers` bölümü, kullanıcı tanımladıysa `onMouseDown`, `onMouseDrag`, `onMouseUp`, `onMouseMove`, `onKeyDown`, `onKeyUp`, `onFrame` ve `onResize` fonksiyonlarını döndürür; runtime bunları `paper.tool` ve `paper.view` üzerine bağlar. paper.js'in kendi `PaperScript.execute` fonksiyonu da aynı yöntemi kullanır.
    - `console.log`, `warn` ve `error` yalnızca çalıştırma sırasında ve olay işleyicileri içinde `output`'a yönlendirilir. Bu, global `console` değiştirilerek değil, kapsama sarmalanmış bir `console` nesnesi enjekte edilerek yapılır.
    - Hatalar yakalanır. `line` alanı, derleme hatalarında paper'ın verdiği konumdan, çalışma hatalarında stack'teki `<anonymous>:L:C` bilgisinden çıkarılır. Çıkarılamıyorsa boş bırakılır.

**`api.ts` asgari ad listesi** (eski kodların kullandığı adlar):

| Ad | Davranış |
|---|---|
| `Points` | `createRandom(n, minX?, maxX?, minY?, maxY?)`, `sortX`, `sortY`, `drawPoints`, `shuffle`, `drawLine(p1,p2)`, `drawLines(points)`, `animateRandom(points, fn?)`, `animateVibrate(points, fn?)` |
| `TextPoint` | `new TextPoint(x, y)` veya `new TextPoint(point)`. Alanları: `id`, `pos` (paper.Point), `path`. Metotları: `draw()`, `toString()`. `mouseDragEvent` atanabilir. Sürüklenebilir. |
| `Polygon` | `new Polygon(name)`, `points: TextPoint[]`, `addPoint(p)`, `draw()`, `changePosition(delta)`; `mouseDragEvent` atanabilir |
| `Vector` | `paper.Point` uzantısı (eski `Vector`) |
| `convexHull(points: TextPoint[])` | `TextPoint` listesi döndürür; eski koddaki gibi **kapalı** bir çizgi verir (son eleman ilk elemana eşittir), böylece `Points.drawLines` kapalı bir şekil çizer. İçeride Görev 2'deki `convexHull` kullanılır. |
| `miniDisc(points)`, `getCenterAndRadius2(p1,p2)`, `getCenterAndRadius3(p1,p2,p3)`, `inCircle(center, radius, p)`, `drawCircle(circle)` | Eski adlar korunur. Hesaplar Görev 4'teki fonksiyonlarla yapılır; `center` bir `paper.Point` olur. |
| `add(p1,p2)`, `subtract(p1,p2)`, `dotProduct(v1,v2)`, `crossProduct(v1,v2)`, `isLeftTurn(list)` | Eski davranış. |
| `getRandomInt`, `range`, `shuffle` | Eski davranış. |
| `drawLine(p1,p2)`, `drawLines(points)` | `Points.drawLine` ve `Points.drawLines` ile aynıdır (örnek kodlar bu adları doğrudan kullanıyor). |
| `drawCoordinateSystem()`, `clearScreen()`, `clear()` | Eski davranış. `clear()`, `clearScreen()` ile aynıdır. |
| `createPolygon(name, position?, scaleFactor?)`, `createRandomPolygon()` | SVG `?raw` olarak içe aktarılır ve `project.importSVG(svgString)` ile yüklenir. Bilinmeyen bir ad verilirse `alert` çağrılmaz; output'a bir hata satırı yazılır ve `undefined` döner. |
| `printLog(x)`, `print(x)`, `clearLog()` | Çıktı paneline yazar veya paneli temizler. |
| `origin`, `drawables`, `getTextPoint(name)`, `mouseDown(point)`, `loop(event)` | Eski adlar. Kullanıcı `mouseDown` ya da `loop` tanımlarsa, varsayılan `onMouseDown` ve `onFrame` işleyicileri bunları çağırır. |
| Yeni adlar | `dualLine`, `dualPoint`, `findStabber`, `isMonotone`, `monotoneDirections`, `smallestEnclosingDisk`, `convexHullPts` (geometri sürümleri; girdi olarak `{x, y}` veya `TextPoint` alır) |
| paper.js | `Point`, `Size`, `Rectangle`, `Matrix`, `Path`, `PointText`, `Group`, `Color`, `project`, `view`, `tool`, `paper` |

`Array.prototype.delete` ve `Array.prototype.clear` yamaları, `runtime.ts` modülü ilk yüklendiğinde bir kez ve `enumerable: false` olacak şekilde eklenir.

- [ ] **Step 1: Write the failing tests** (`runtime.browser.test.ts`; her test kendi `<canvas width=775 height=360>` elemanını oluşturur):
  - `operators work`: `var p = new Point(1,2) + new Point(3,4); console.log(p.x)` kodunun çıktısı `"4"` olur.
  - `legacy convex hull demo`: `legacy/app/views/algorithms/convexHull.ejs` içindeki demo kodu çalıştırılır (`Points.createRandom(7)` → `convexHull` → `Points.drawLines`). Sonuç `ok: true` olur ve `project.activeLayer.children.length > 7` olur.
  - `legacy sample codes run`: `legacy/app/views/partials/paperjs/sampleCodes/` altındaki her dosya `---` ile ayrılmış bölümlere bölünür ve her bölüm ayrı ayrı çalıştırılır. Tüm bölümler `ok: true` döner. İstisna: `code3.js` içindeki `polygon.points.p0` ifadesi eski sitede de çalışmıyordu (`points` bir dizi). Bu örnek içerik görevinde `polygon.points[0]` olarak düzeltilir; bu testte de düzeltilmiş hali kullanılır.
  - `runtime error is reported`: `foo.bar()` → `ok: false`, `error.text` içinde `"foo"` geçer, `error.line === 1`.
  - `syntax error is reported`: `var = ;` → `ok: false`.
  - `run twice replaces handlers`: İlk çalıştırmada her karede bir sayaç artıran bir `onFrame` tanımlanır. İkinci çalıştırma `onFrame` tanımlamaz. İki kare beklendikten sonra sayacın artmadığı doğrulanır.
  - `createPolygon unknown name`: `createPolygon('nope')` çağrısı `alert` açmaz ve output'a `error` türünde bir satır yazar.
  - `y axis is flipped`: `new TextPoint(10, 10)` noktası, canvas'ın alt kenarına 10 piksel uzaklıkta çizilir (`path.bounds.center.y` iç koordinatta 10'dur ve görünüm koordinatında `height − 10`'dur).
- [ ] **Step 2:** `npm test -- --project browser src/engine` çalıştırılır. Beklenen: FAIL.
- [ ] **Step 3:** Motor dosyaları ve runtime yazılır. Eski davranış `legacy/` altındaki dosyalardan alınır; PaperScript operatörleri metot çağrılarına çevrilir.
- [ ] **Step 4:** Aynı test komutu çalıştırılır. Beklenen: PASS.
- [ ] **Step 5: Commit.** Mesaj: `feat(engine): paper.js engine and PaperScript runtime with legacy API`

---

### Görev 6: Editör, canvas ve çıktı bileşenleri; Playground sayfası

**Files:**
- Create: `src/components/GeometryCanvas.tsx`, `src/components/CodeEditor.tsx`, `src/components/OutputPanel.tsx`, `src/components/ErrorBoundary.tsx`, `src/components/CodeRunner.tsx`, `src/pages/Playground.tsx`, `src/content/playground/{polygonSquare,polygonRandom,polygonPointDrag,points}.js`
- Modify: `src/App.tsx` (`/playground` route'u)
- Test: `src/components/CodeRunner.browser.test.tsx`, `tests/e2e/playground.spec.ts`

**Interfaces:**
- Consumes: Görev 5'teki `createScene`, `run` ve `OutputLine`.
- Produces:
  - `<GeometryCanvas width height onReady={(scene: Scene) => void} id?>`: Bileşen bağlandığında `createScene` çağrılır, kaldırıldığında `scene.dispose()` çağrılır.
  - `<CodeEditor value onChange onRun>`: CodeMirror 6, JavaScript modu. Ctrl/Cmd+Enter `onRun`'ı tetikler.
  - `<OutputPanel lines: OutputLine[]>`: `error` satırları kırmızı gösterilir.
  - `<CodeRunner initialCode: string; storageKey?: string; canvas?: {width:number;height:number}; extraCanvases?: {id:string;width:number;height:number;label:string}[]; autoRun?: boolean>`:
    - Editör, canvas(lar), çıktı paneli ve Run/Reset butonlarını bir araya getirir. Varsayılan canvas boyutu 775×360'tır.
    - `storageKey` verilirse kod `localStorage`'a kaydedilir. Tüm erişimler `try/catch` içindedir.
    - Reset, kodu `initialCode`'a döndürür ve kaydı siler.
  - `<ErrorBoundary>`: Hata olduğunda "Something went wrong" mesajı ve "Reload" butonu gösterir.

- [ ] **Step 1: Write the failing tests.**
  - `CodeRunner.browser.test.tsx`:
    - `autoRun draws`: `initialCode="new Path.Circle({center:[50,50],radius:10,fillColor:'red'})"` ile canvas'ta bir çizim oluşur. Bunu doğrulamak için `onReady` ile alınan `scene.paper.project.activeLayer.children.length >= 1` kontrol edilir.
    - `error shows in panel`: `initialCode="foo()"` ile paneldeki metinde "foo" geçer.
    - `reset restores code`: Kod değiştirilip Reset'e basıldığında editör içeriği `initialCode`'a eşit olur.
  - `tests/e2e/playground.spec.ts`:
    - `playground runs templates`: Her şablon seçilir, Run'a basılır ve çıktı panelinde `error` satırı oluşmaz.
    - `code persists`: Kod değiştirilir, sayfa yenilenir ve kod aynı kalır.
    - `playground works without localStorage`: `page.addInitScript` ile `localStorage` erişimi `throw` edecek şekilde değiştirilir. Sayfa yine açılır ve Run çalışır.
- [ ] **Step 2:** `npm test` ve `npm run e2e -- playground` çalıştırılır. Beklenen: FAIL.
- [ ] **Step 3:** Bileşenler ve Playground sayfası yazılır. Playground düzeni: solda editör ve şablon seçici, sağda canvas, altta çıktı paneli; dar ekranda alt alta dizilir. Şablonlar `legacy/app/views/partials/paperjs/sampleCodes/` içinden alınır; `code3`'teki `p0` düzeltmesi burada yapılır.
- [ ] **Step 4:** Aynı testler çalıştırılır. Beklenen: PASS.
- [ ] **Step 5: Commit.** Mesaj: `feat: code runner components and playground page`

---

### Görev 7: Registry, algoritma sayfaları ve içeriğin taşınması (Kod sekmesi)

**Files:**
- Create: `src/registry.ts`, `src/pages/AlgorithmsIndex.tsx`, `src/pages/AlgorithmPage.tsx`, `src/pages/DualityIndex.tsx`, `src/content/algorithms/{convexHull,smallestEnclosingDisk,L-monoton,dualLine,checkStabber}/{index.mdx,demo.js}`, `src/types/mdx.d.ts`
- Modify: `src/App.tsx` (route'lar), `vite.config.ts` (MDX eklentisi), `src/components/Layout.tsx` (sayfa içeriği `<ErrorBoundary>` ile sarılır; `key` olarak `location.pathname` verilir, böylece sayfa değişince hata durumu sıfırlanır)
- Test: `src/registry.test.ts`, `tests/e2e/algorithms.spec.ts`

**Interfaces:**
- Consumes: Görev 6'daki `CodeRunner`.
- Produces:
  - `AlgorithmEntry` (spec §3.3) ve şu ek alan: `canvases?: {id:string;width:number;height:number;label:string}[]`. Bu alan, iki canvas kullanan eski demolar içindir (L-monoton: `canvas-1` ve `canvas-2`, 380×480; duality sayfaları: 360×480). Bu demolar ikinci canvas'a `document.getElementById('canvas-2')` ile eriştiği için id'ler eski sayfadakilerle aynı olmalıdır.
  - `algorithms: AlgorithmEntry[]`, `findAlgorithm(path: string): AlgorithmEntry | undefined`
  - `<AlgorithmPage entry>`: MDX metni ve sekmeler. Bu görevde yalnızca "Code" sekmesi vardır.

- [ ] **Step 1: Write the failing tests.**
  - `registry.test.ts`:
    - `paths are legacy paths`: Kayıtlardaki `path` değerleri Global Constraints'teki 5 algoritma URL'siyle aynı olur.
    - `slugs unique`: Slug'lar benzersizdir.
    - `findAlgorithm('/algorithms/nope') === undefined`.
  - `tests/e2e/algorithms.spec.ts`:
    - `each algorithm page runs its demo`: Her algoritma sayfası açılır; başlık görünür, konsolda hata olmaz, çıktı panelinde `error` satırı olmaz.
    - `/algorithms` sayfasında 5 kart ve "Duality" grubu görünür.
    - `/algorithms/duality` sayfasında 2 kart görünür.
    - `/algorithms/nope` adresinde 404 sayfası görünür.
    - `navigating between algorithms leaves no errors`: Convex Hull → L-monoton → Dual Line → Convex Hull sırasıyla menüden gezilir ve konsolda hata olmaz.
    - `drag works at 375px width`: Viewport 375×800 yapılır. Convex Hull sayfasında `points[0]` noktasının ekran konumu `window.__webcgalDebug` üzerinden bulunur. Bu kanca yalnızca `import.meta.env.DEV` veya `VITE_E2E` açıkken tanımlanır ve aktif sahneyi açar. Nokta 20 piksel sürüklenince `pos` değeri ölçek oranıyla uyumlu biçimde değişir (y ekseni yönü dahil).
- [ ] **Step 2:** Testler çalıştırılır. Beklenen: FAIL.
- [ ] **Step 3:** İçerik taşınır:
  - Her eski sayfadaki açıklama metni `index.mdx` dosyasına aktarılır. Kitap ve bölüm referansları korunur.
  - `<script type="text/paperscript">` içindeki kod `demo.js` dosyasına aktarılır. `all.js` ile dahil edilen kütüphane kodları demoya kopyalanmaz; bunlar API tarafından sağlanır. Yalnızca sayfaya özgü kod taşınır.
  - Üç büyük sayfa (L-monoton, dualLine, checkStabber) kendi fonksiyonlarını içerdiği için büyük ölçüde olduğu gibi taşınır. Yalnızca `reload.js` ve `window.*` gibi sayfa dışı kalıntılar temizlenir.
- [ ] **Step 4:** Registry, sayfalar ve route'lar yazılır. Testler çalıştırılır. Beklenen: PASS.
- [ ] **Step 5: Commit.** Mesaj: `feat: algorithm registry, pages and migrated content`

---

### Görev 8: Adım adım oynatıcı (Convex Hull)

**Files:**
- Create: `src/components/StepPlayer.tsx`, `src/components/PseudocodePanel.tsx`, `src/players/types.ts`, `src/players/convexHullPlayer.ts`
- Modify: `src/registry.ts` (`convexHull.player`), `src/pages/AlgorithmPage.tsx` ("Step by step" sekmesi; oynatıcısı olan algoritmalarda varsayılan sekmedir)
- Test: `src/components/StepPlayer.browser.test.tsx`, `tests/e2e/player.spec.ts`

**Interfaces:**
- Consumes: Görev 3'teki `convexHullSteps`, `CONVEX_HULL_PSEUDOCODE`, `Step` ve `HullState`; Görev 5'teki `Scene`; Görev 6'daki `GeometryCanvas`.
- Produces:
  - `PlayerModule<S>` (spec §5.2): `computeSteps`, `render(scene, step, points)`, `pseudocode`, `initialPoints()`. Convex Hull için `initialPoints` 10 rastgele nokta döndürür.
  - `<StepPlayer module: PlayerModule<any>>`:
    - **Durum:** `points`, `steps`, `index` ve `playing`.
    - **Hız:** 1–10 arası bir slider. Adımlar arası süre `1000 / speed` ms'dir.
    - **Butonlar:** erişilebilir adlarıyla "First", "Previous", "Play"/"Pause", "Next", "Last".
    - **Gösterge ve açıklama:** "Step k / n" göstergesi ve adımın açıklama metni.
    - **Klavye:** ← → ve Space ile kontrol edilir. Odak bir `input`, `textarea` veya `.cm-editor` içindeyse kısayollar devre dışıdır.
    - **Etkileşim:** "New random points" butonu ve nokta sürükleme adımları yeniden hesaplar ve `index`'i 0'a döndürür.
  - `<PseudocodePanel lines: string[] active: number>`: Aktif satırda `aria-current="step"` bulunur.
  - Renkler CSS değişkenleriyle tanımlanır ve render sırasında okunur: `--hull-current`, `--hull-testing`, `--hull-upper`, `--hull-lower`, `--hull-removed`.

- [ ] **Step 1: Write the failing tests.**
  - `StepPlayer.browser.test.tsx` (sabit 5 noktalı sahte bir modülle):
    - `next/previous change counter`: Next'e basınca "Step 2 / n" görünür; Previous'a basınca tekrar "Step 1 / n" görünür.
    - `last shows final step`: Last'e basınca "Step n / n" görünür ve aktif sözde kod satırı, son adımın `line` değeriyle aynıdır.
    - `play advances and stops at end`: Hız 10'a getirilip Play'e basılır; bir süre sonra `index === n-1` olur ve buton tekrar "Play" adını alır.
    - `keyboard`: `ArrowRight` bir adım ilerletir. Odak bir `textarea` içindeyken `ArrowRight` hiçbir şey yapmaz.
  - `tests/e2e/player.spec.ts`:
    - `/algorithms/convexHull` sayfasında "Step by step" sekmesi varsayılan olarak açılır.
    - Last'e basıldıktan sonra konsolda hata görünmez.
    - "New random points" butonuna basıldıktan sonra sayaç "Step 1 / " ile başlar.
- [ ] **Step 2:** Testler çalıştırılır. Beklenen: FAIL.
- [ ] **Step 3:** Bileşenler ve `convexHullPlayer` yazılır. `render`, sahneyi temizleyip `state` alanına göre çizim yapar: tüm noktalar ve etiketleri, üst ve alt zarf çizgileri, `current`, `testing` üçlüsü, `removed` (çarpı işaretiyle). Noktalar sürüklendiğinde `computeSteps` yeniden çağrılır.
- [ ] **Step 4:** Testler çalıştırılır. Beklenen: PASS.
- [ ] **Step 5: Commit.** Mesaj: `feat: step-by-step player for convex hull`

---

### Görev 9: Dokümantasyon

**Files:**
- Create: `src/content/docs/<item>.mdx` (15 öğe: `Polygon`, `TextPoint`, `Points`, `clearScreen`, `clearLog`, `draw`, `createPolygon`, `createRandomPolygon`, `createRandom`, `sort`, `shuffle`, `animate`, `loop`, `mouseDown`, `getCenterAndRadius`), `src/content/docs/index.ts` (kategoriler: objects, drawing_functions, polygon_functions, points_functions, misc_functions; her öğenin `name`, `category`, `content` ve `example?: string` alanları), `src/pages/Docs.tsx`, `src/pages/DocItem.tsx`
- Modify: `src/App.tsx`, `src/pages/Playground.tsx` (`?example=<item>` parametresi: yalnızca `docs/index.ts` içinde tanımlı örnekler yüklenir; bilinmeyen bir değer verilirse sessizce yok sayılır)
- Test: `src/content/docs/docs.test.ts`, `tests/e2e/docs.spec.ts`

**Interfaces:**
- Consumes: Görev 6'daki `CodeRunner` (her dokümantasyon öğesinde örneği gösteren küçük bir çalıştırıcı).
- Produces: `docs: DocEntry[]`, `findDoc(name): DocEntry | undefined`.

- [ ] **Step 1: Write the failing tests.**
  - `docs.test.ts`:
    - `all 15 legacy items present`: `legacy/app/data/documentationData.json` içindeki tüm adlar `docs` içinde bulunur.
    - `no link_to left`: Hiçbir MDX dosyasında `link_to(` ifadesi geçmez.
  - `docs.spec.ts`:
    - Her `/documentation/<item>` sayfası açılır, başlık görünür ve konsolda hata olmaz.
    - "Try it" linki `/playground?example=<item>` adresine gider ve editörde o öğenin örneği görünür.
    - `/playground?example=../../x` adresi varsayılan şablonla açılır.
- [ ] **Step 2:** Testler çalıştırılır. Beklenen: FAIL.
- [ ] **Step 3:** JSON içeriği MDX dosyalarına çevrilir. `link_to(a/b)` ifadeleri `[b](/a/b)` biçiminde Markdown linkine dönüştürülür. Sayfalar ve sol menü yazılır.
- [ ] **Step 4:** Testler çalıştırılır. Beklenen: PASS.
- [ ] **Step 5: Commit.** Mesaj: `feat: documentation pages`

---

### Görev 10: Ana sayfa, görünüm ve eski kodun kaldırılması

**Files:**
- Create: `src/pages/Home.tsx`, `src/components/HullBackground.tsx` (arka planda yavaşça hareket eden noktalar ve canlı zarf; `prefers-reduced-motion` açıksa sabit görüntü), `src/styles/theme.css`
- Modify: `src/App.tsx`, `README.md` (yeni kurulum ve geliştirme komutları; "yeni algoritma ekleme" bölümü: 3 adım ve dosya yolları)
- Delete: `legacy/`. Önce `legacy/` klasörüne başvuran testler güncellenir: Görev 5'teki testler eski demo ve örnek kodlar yerine `src/content/` altındaki kopyaları kullanır. Görev 9'daki `all 15 legacy items present` testinde ise 15 öğenin adı test dosyasına sabit bir liste olarak yazılır.
- Test: `tests/e2e/home.spec.ts`, `tests/e2e/visual.spec.ts`

**Interfaces:**
- Consumes: `algorithms` (kartlar), `CodeRunner` (ana sayfadaki kod örneği).

- [ ] **Step 1: Write the failing tests.**
  - `home.spec.ts`: Başlık görünür; Algorithms, Documentation ve Playground kartları ilgili adreslere gider; konsolda hata olmaz.
  - `visual.spec.ts`: Ana sayfa, `/algorithms/convexHull` ve `/playground`, 375 ve 1280 genişliklerinde açık ve koyu temada açılır. Hiçbirinde yatay kaydırma olmaz (`document.documentElement.scrollWidth <= window.innerWidth`).
- [ ] **Step 2:** Testler çalıştırılır. Beklenen: FAIL.
- [ ] **Step 3:** Ana sayfa ve tema yazılır, `legacy/` silinir, test yolları güncellenir.
- [ ] **Step 4:** Tüm doğrulamalar çalıştırılır: `npm test`, `npm run build`, `npm run e2e`. Beklenen: hepsi PASS.
- [ ] **Step 5: Commit.** Mesaj: `feat: home page, theme; remove legacy app`

---

### Görev 11: Netlify'da yayın

**Files:**
- Modify: yok (`netlify.toml` Görev 1'de eklendi). Gerekirse `README.md` dosyasına yayın adresi eklenir.

- [ ] **Step 1:** `npm run build` çalıştırılır. Beklenen: `dist/` oluşur.
- [ ] **Step 2:** Netlify MCP araçlarıyla `webcgal` adında bir site oluşturulur. Ad alınmışsa **durulur ve kullanıcıya alternatif sorulur**.
- [ ] **Step 3:** `dist/` klasörü bu siteye yayınlanır (production deploy).
- [ ] **Step 4: Yayın sonrası kontroller** (`curl -sI` ile):
  - `/` → 200
  - `/algorithms/convexHull` → 200 (SPA kuralı)
  - `/duality` → 301, `Location: /algorithms/duality`
  - `/smallestEnclosingDisk` → 301
  - Playwright duman testi (`tests/e2e/smoke.spec.ts`), `BASE_URL=https://webcgal.netlify.app` ile çalıştırılır. Beklenen: PASS.
- [ ] **Step 5:** Kullanıcıya site adresi verilir. Ayrıca GitHub reposunun Netlify'a bağlanması (otomatik yayın) ve isteğe bağlı `webcgal.org` alan adı için adımlar anlatılır.
- [ ] **Step 6: Commit** (README değiştiyse). Mesaj: `docs: add deployment URL`
