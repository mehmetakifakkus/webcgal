# kd-Ağacı ve Dik Aralık Sorgusu: Tasarım

- **Tarih:** 2026-11-10
- **Durum:** İncelemede
- **Önceki spec'ler:** `2026-11-10-smallest-enclosing-disk-design.md` (oynatıcı kalıbı, alt yol e2e), `2026-11-06-triangulation-design.md` (modlar, soluk satırlar), `2026-11-07-voronoi-design.md` (kırpma, `clip.ts`)
- **Kapsam:** de Berg et al. Bölüm 5'ten (*Orthogonal Range Searching*) yalnızca kd-ağacı (§5.2). Aralık ağacı (range tree) ve fractional cascading ayrı bir sayfa olarak sonraki turda.

## 1. Amaç ve bağlam

Yeni bir algoritma sayfası: kd-ağacının kurulması (BuildKdTree) ve dik dikdörtgen sorgusu (SearchKdTree) adım adım; düzlem ve ağaç aynı canvas'ta yan yana çizilir, aktif düğüm her iki yerde de vurgulanır.

**Kullanıcı kararları:**
- Bu turda yalnızca kd-ağacı; aralık ağacı ayrı sayfa.
- Düzlem ve ağaç tek canvas'ta (sol düzlem, sağ ağaç).

**Varsayımlar:**
- Girdi `{ points, query }`; noktalar ve sorgu dikdörtgeninin iki köşesi sürüklenebilir.
- Eşit koordinatlar "bileşik sayı" (composite number) sıralamasıyla çözülür; yinelenen noktalar serbest.
- Üç mod: "Build and query", "Build only", "Query only".

**Başarı ölçütleri:**
1. Sorgu sonucu kaba kuvvet filtresiyle aynı (rastgele 200 küme × rastgele dikdörtgen, eşit koordinatlar dahil).
2. Ağaç yüksekliği ⌈log₂ n⌉; her nokta tam bir yaprakta; her düğümün bölgesi ebeveyninin bölgesi içinde.
3. Presetlerde sabitlenmiş sayılar (rapor, ziyaret, tam içerde alt ağaç, budanan alt ağaç) tutar.
4. 16 noktada adım sayısı ≤ 80; 30 noktada ≤ 150.
5. Mevcut testler değişmeden geçer (sayım güncellemeleri hariç); e2e `/webcgal/` alt yolunda da çalışır.

## 2. Geometri modülü (`src/geometry/algorithms/kdtree/`)

### 2.1 Tipler ve kurulum (`kdTree.ts`)
```ts
type Box = { x0: number; y0: number; x1: number; y1: number }   // clip.ts'teki Box yeniden kullanılır
type KdNode =
  | { kind: 'leaf'; id: number; depth: number; point: number; region: Box }
  | { kind: 'split'; id: number; depth: number; axis: 'x' | 'y'; value: number;
      left: KdNode; right: KdNode; region: Box; size: number }
type KdTree = { root: KdNode | null; nodes: number; depth: number; box: Box }
```
- `buildKdTree(points, box = PLANE_BOX, record?)`: kitabın BuildKdTree'si. Tek nokta → yaprak. Çift derinlik → x ekseni: noktalar `(x, y)` sözlüksel sıralanır, P₁ = ilk ⌈n/2⌉ nokta, `value` = P₁'in son noktasının x'i; tek derinlik → y ekseni, `(y, x)` sözlüksel, aynı kural. Sol çocuğun bölgesi `value` hattının solu/altı (dahil), sağınki sağı/üstü.
- `id`'ler ön sıra (pre-order) numaraları; `nodes` = toplam düğüm sayısı (2n − 1); `depth` = en derin yaprağın derinliği.
- n = 0 → `root: null`; n = 1 → tek yaprak.
- `PLANE_BOX = { x0: 15, y0: 15, x1: 455, y1: 345 }` (oynatıcının düzlem kutusu). API `box` olarak noktaların sınırlayıcı kutusunu 10 birim payla kullanır; bölgeler yalnızca çizim ve "içinde/kesişir" testleri içindir, sonuç kutudan bağımsızdır.

### 2.2 Sorgu (`search.ts`)
- `searchKdTree(points, tree, R, record?)` → `{ reported: number[]; visited: number; inside: number; pruned: number }` (`reported` artan sırada).
- Kitabın SearchKdTree'si: yaprak → nokta R'deyse raporla; değilse region(lc) R içindeyse ReportSubtree(lc), yoksa region(lc) R ile kesişiyorsa SearchKdTree(lc); aynısı rc için. Bölge R ile kesişmiyorsa alt ağaç budanır (`pruned`).
- R kapalı dikdörtgen (sınırdaki noktalar dahil); bölge testleri de kapalı. "İçinde" = bölge R'nin içinde (sınırlar dahil); "kesişir" = kapalı kümeler kesişir.
- `visited` = SearchKdTree'nin çağrıldığı düğüm sayısı (kök dahil); `inside` = ReportSubtree çağrısı sayısı; `pruned` = atlanan alt ağaç sayısı.

### 2.3 Doğrulama ve testler
- `verify.ts`: `checkKdTree(points, tree)` → `{ ok; reason? }` (her nokta tam bir yaprakta; yaprak sayısı n; yükseklik ⌈log₂ n⌉; her düğümün bölgesi ebeveyninkinin içinde; sol alt ağaçtaki tüm noktalar `value` hattının solunda/altında veya üzerinde, sağdakiler bileşik sırada ötesinde). `bruteForceRange(points, R)`.
- Testler (node): tek nokta, iki nokta, eşit x'ler (dikey çizgi üzerinde 5 nokta), ızgara, yinelenen noktalar, n = 0; rastgele 200 küme × 5 dikdörtgen sorgu = kaba kuvvet; yükseklik; `checkKdTree`; sınırdaki noktalar raporlanır; R bir doğru parçası (genişlik 0).

## 3. Adımlar ve durum

### 3.1 Sözde kod (`pseudocode.ts`, 21 satır, başlıklar `[0, 10]`)
```
0  BuildKdTree(P, depth)
1      if P contains only one point
2          then return a leaf storing this point
3      else if depth is even
4          then split P with a vertical line ℓ through the median x-coordinate into P_1 (left of or on ℓ) and P_2 (right of ℓ)
5          else split P with a horizontal line ℓ through the median y-coordinate into P_1 (below or on ℓ) and P_2 (above ℓ)
6      v_left ← BuildKdTree(P_1, depth + 1)
7      v_right ← BuildKdTree(P_2, depth + 1)
8      create a node v storing ℓ, with v_left and v_right as its children
9      return v
10 SearchKdTree(v, R)
11     if v is a leaf
12         then report the point stored at v if it lies in R
13     else if region(lc(v)) is fully contained in R
14         then ReportSubtree(lc(v))
15     else if region(lc(v)) intersects R
16         then SearchKdTree(lc(v), R)
17     if region(rc(v)) is fully contained in R
18         then ReportSubtree(rc(v))
19     else if region(rc(v)) intersects R
20         then SearchKdTree(rc(v), R)
```

### 3.2 Durum (`kdState.ts`)
```ts
type KdNodeView = { id: number; parent: number | null; side: 'left' | 'right' | null; depth: number;
                    region: Box; axis?: 'x' | 'y'; value?: number; point?: number; size: number }
type KdState = {
  phase: 'build' | 'query' | 'done';
  nodes: KdNodeView[];            // o ana kadar oluşturulan düğümler (id sırasında)
  current?: number;               // aktif düğüm id
  test?: { child: number; relation: 'inside' | 'intersects' | 'disjoint' };
  visited: number[]; reported: number[]; inside: number[]; pruned: number[];   // düğüm id'leri / nokta indeksleri
  newlyReported?: number[];
  counts: { visited: number; inside: number; pruned: number };
};
```
Her adım `structuredClone`; `current`, `test`, `newlyReported` tek adımlık.

### 3.3 Kayıt satırları
| Satır | Açıklama |
|---|---|
| 4 / 5 | "Split v1, v2, …, v10 at x = 320.0 (median): 5 left, 5 right" (10'dan fazla nokta: "Split 14 points at …"; eşit değer varsa sonuna " — ties broken by y" / "by x") |
| 2 | "Leaf v7" |
| 9 | "kd-tree ready: 19 nodes, depth 4" (yalnızca kurulumun son adımı) |
| 11 / 12 | "Leaf v3 lies in R → report" / "Leaf v3 lies outside R" |
| 13 / 14, 17 / 18 | "region(lc) lies in R → report its 3 points" (`test.relation = 'inside'`) |
| 15 / 16, 19 / 20 | "region(rc) intersects R → descend" / "region(rc) is disjoint from R → skip" |
| son | "Done: 6 points reported, 9 nodes visited, 2 subtrees reported whole, 4 subtrees skipped" |

Koordinatlar bir ondalıkla; tekil/çoğul biçimler ("1 point", "1 node", "1 subtree").

### 3.4 Modlar ve adım üreteci
- `kdSteps(input, mode)`: `mode = 'full'` → kurulum + sorgu; `'build'` → yalnızca kurulum (son adım satır 9; sözde kodda 10–20 soluk); `'query'` → ağaç ilk adımda tam (satır 9 "kd-tree ready…" ile başlar), ardından sorgu (0–9 soluk).
- Adım üreteci kurulum ve sorgu kaydedicilerini birleştirir; `nodes` sorgu fazında tam ağaçtır.

### 3.5 Presetler (`presets.ts`)
`KD_PRESETS: { name; input: { points; query }; expected: { reported; visited; inside; pruned; nodes; depth } }[]` (koordinatlar sabit; `expected` uygulamada hesaplanıp sabitlenir):
1. "Textbook example": (60,280),(110,90),(150,200),(200,320),(240,60),(280,170),(330,260),(370,110),(410,300),(430,40); query {x0:130, y0:100, x1:370, y1:280} (the original {130,80,350,280} contains no region fully inside R).
2. "Square grid 4×4": x ∈ {80,180,280,380} × y ∈ {60,140,220,300}, satır satır; query {150,100,330,260}.
3. "Clusters": (80,90),(100,140),(120,70),(140,120),(90,170),(150,160),(130,100),(340,230),(360,290),(390,250),(410,300),(350,270),(400,220),(380,320); query {60,50,170,190}.
4. "Points on a diagonal": (40 + 50k, 40 + 38k), k = 0..7; query {120,100,300,260}.
5. "Query covers everything": Textbook noktaları; query {15,15,455,345}.
6. "Empty query": Textbook noktaları; query {300,180,320,200}.
- Testler: son adım `searchKdTree` ile aynı; satırlar geçerli ve başlık değil; `test` yalnızca 13–20 satırlarında; mod `build`'de sorgu adımı yok, `query`'de kurulum adımı yalnızca ilk adım; anlık görüntüler bağımsız; preset sayıları; adım sınırları (§1.4, 20 seed).

## 4. Oynatıcı modülü (`src/players/kdTreePlayer.ts`)

`PlayerModule<KdState, KdInput>`, `KdInput = { points: Pt[]; query: Box }` (`types.ts`).
- **Yerleşim:** düzlem `PLANE_BOX` (solda); ağaç x 475–765, y 20–340 (sağda); x = 465'te ince ayırıcı çizgi.
- **Tutamaçlar:** önce noktalar, sonra sorgu dikdörtgeninin sol-alt ve sağ-üst köşesi; tümü `PLANE_BOX`'a kırpılır. `moveHandle` köşelerde dikdörtgeni normalize eder (x0 ≤ x1, y0 ≤ y1).
- **randomInput:** `PLANE_BOX` içinde 14 nokta (en az 20 aralık; `randomPointSet`), alanı düzlemin %25–40'ı olan rastgele dikdörtgen.
- **Modlar:** `[{ id: 'full', label: 'Build and query' }, { id: 'build', label: 'Build only' }, { id: 'query', label: 'Query only' }]`; `dimmedLines`: build → 10–20, query → 0–9.
- **Render — düzlem:** bölme çizgileri kendi bölgelerine kırpılarak, dikey `--kd-x`, yatay `--kd-y` 1.5px; aktif düğümün bölgesi `--kd-current` alpha .15; tamamı raporlanan alt ağaçların bölgeleri `--kd-report` alpha .15; budanan bölgeler `--kd-pruned` alpha .2; sorgu dikdörtgeni 2px kesikli `--kd-query`, köşe tutamaçları 7px kare; raporlanan noktalar dolu `--kd-report`, budanmış bölgelerdeki noktalar soluk, diğerleri dolu koyu; etiketler `v1…` (≤ 20 noktada).
- **Render — ağaç:** düğüm konumu: y = 20 + derinlik · (320 / max(1, depth)); x = 475 + (sıra içi konum + 0.5) · (290 / yaprak sayısı) (yaprakların sırası; iç düğüm iki çocuğunun ortası). İç düğüm 12×12 kare (eksen rengiyle kenar), yaprak r = 5 daire; kenarlar 1px; etiketler (düğüm ≤ 24 ise) iç düğümde `x = 320`, yaprakta `v7`. Aktif düğüm `--kd-current` dolgu, ziyaret edilenler kalın kenar, tam içerde alt ağaçlar `--kd-report`, budananlar `--kd-pruned`. Kurulumda yalnızca oluşturulmuş düğümler.
- **Paneller:** "Node" (`x = 320.0 · depth 0 · region [15, 455] × [15, 345]`; yaprakta `leaf v7 · (280.0, 170.0)`; boş "No node yet"), "Query" (`region(lc) ∩ R: intersects` satırı test adımında; `reported 4 · visited 7 · inside 1 · skipped 2`; boş "Query not started"), "Reported" (`v3` satırları, bu adımda eklenenler `new`; boş "Nothing reported yet").
- **Renkler** (`theme.css`, açık/koyu aynı): `--kd-x #1a5fb4`, `--kd-y #c01c28`, `--kd-current #e66100`, `--kd-query #9141ac`, `--kd-report #26a269`, `--kd-pruned #9aa0a6`.
- **hint:** "Drag the points or the two corners of the query rectangle. Keys: ← → to step, Space to play or pause."
- **Testler (browser):** rastgele girdi kuralları; render saf; tüm noktalar ve tutamaçlar düzlem kutusunda; kurulum adımında ağaçta çizilen düğüm sayısı = `nodes.length`; done'da raporlanan noktalar kaba kuvvetle aynı; "Query only" ilk adımda tam ağaç; köşe taşıma dikdörtgeni normalize eder; paneller faz faz; altı preset adı.

## 5. Sayfa, API, dokümantasyon, testler ve yayın

- **Registry:** `slug 'kdTree'`, `path '/algorithms/kdTree'`, `name 'kd-Tree Range Search'`, Smallest Enclosing Disk'ten sonra (kitap sırası); `summary 'Build a kd-tree by alternating median splits and answer a rectangular range query, step by step.'`; `thumbnail '/images/kdTree_tn.png'` (`thumbnail:kdTree`, preset "Textbook example", son adım); tek 775×360 canvas.
- **İçerik (MDX):** problem (veritabanı sorgusu, dik aralık); 1B fikir bir paragraf (dengeli ağaç ve split düğümü); kd-ağacının kurulması (dönüşümlü medyan bölme, O(n log n) kurulum, O(n) bellek); region(v) ve sorgu (içinde → ReportSubtree, kesişiyor → in, ayrık → atla); O(√n + k) sorgu süresinin nedeni (bir dikey doğru yalnızca O(√n) bölgeyi keser); eşit koordinatlar ve bileşik sayılar; aralık ağacına bir cümle (ayrı sayfa gelecek); kitap cümlesi "This page follows section 5.2, *Kd-Trees*, of Computational Geometry: Algorithms and Applications, 3rd ed., by de Berg et al."; etkileşim ipuçları. Teorem/lemma numaraları yalnızca doğrulanmışsa.
- **API** (`src/engine/kdTree.ts`, `API_NAMES`'e `kdTree`, `rangeQuery`, `drawKdTree`): `kdTree(points)` → `{ root, depth, size }` (salt okunur; düğümler `{ axis, value, left, right }` / `{ point }`, indeksler girdiye göre); `rangeQuery(points, tree, rect)` → R'deki nokta indeksleri (rect `{x0,y0,x1,y1}` ya da iki nokta); `drawKdTree(points, tree, color = 'black')` bölme çizgilerini bölgelerine kırpılmış çizer (kutu: noktaların sınırlayıcı kutusu, 10 birim pay). Hatalar `kdTree:` / `rangeQuery:` / `drawKdTree:` önekli, öğe indeksi 1 tabanlı (`expected an array of points (item N is not a point)`; `rangeQuery: expected a rectangle {x0, y0, x1, y1} or two points`; `rangeQuery: expected the result of kdTree(points) for the same points`).
- **demo.js:** `var points = Points.createRandom(30); var tree = kdTree(points); drawKdTree(points, tree); var hits = rangeQuery(points, tree, { x0: 200, y0: 100, x1: 500, y1: 300 }); console.log(hits.length + ' point(s) in the range');` (raporlanan noktaları renklendiren bir satır dahil olabilir; çıktı biçimi sabit).
- **Dokümantasyon:** `misc_functions` altına `kdTree` (20. öğe; `rangeQuery`, `drawKdTree` aynı sayfada); docs 20 / "Try it" 14.
- **Testler:** e2e `kdTree.spec.ts` (sayfa "Node" paneliyle açılır; her preset `expected`'tan üretilen done metnine ulaşır; mod değişimi adım sayısını tutarlı değiştirir; nokta ve köşe sürükleme oynatıcıyı yeniden başlatır (BASE_URL ile skip); Code demosu `/^\d+ point\(s\) in the range$/`); `visual.spec` sayfa; kart 10; docs 20 / 14. Hepsi `/webcgal/` alt yolunda da çalışır.
- **Yayın:** sayfa görevi bitince PR + yerel `/webcgal/` derlemesinden ekran görüntüleri; birleşmeden sonra GitHub Pages otomatik yayınlar, canlı site e2e ile kontrol edilir.

## 6. Kapsam dışı
Aralık ağacı ve fractional cascading (ayrı sayfa); 3B ve daha yüksek boyutlu kd-ağaçları; ekleme/silme; en yakın komşu araması.

## 7. Riskler
| Risk | Önlem |
|---|---|
| Eşit koordinatlarda yanlış bölme / boş alt küme | Bileşik sözlüksel sıralama; dikey çizgi ve ızgara testleri; `checkKdTree` |
| Bölge testlerinde sınır hataları | Kapalı kümeler; sınırdaki nokta ve genişliği 0 dikdörtgen testleri; kaba kuvvet karşılaştırması |
| Ağaç çiziminin büyük n'de taşması | Etiket eşiği (24 düğüm); yaprak aralığına göre ölçekleme; 30 noktalık render testi |
| Köşe tutamaçlarının noktalarla karışması | Tutamaç sırası sabit (noktalar, sonra iki köşe); köşeler kare çizilir |
