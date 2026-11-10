# Sanat Galerisi Problemi (Fisk'in ⌊n/3⌋ Kamerası): Tasarım

- **Tarih:** 2026-11-10
- **Durum:** İncelemede
- **Önceki spec'ler:** `2026-11-06-triangulation-design.md` (üçgenleme modülü, basitlik koruması), `2026-11-10-kd-tree-design.md` (modlar, tutamaç kuralları, alt yol e2e)
- **Kapsam:** de Berg et al. §3.1 (*Guarding and Triangulations*): Chvátal'ın sanat galerisi teoremi ve Fisk'in ispatı; yeni sayfa, oynatıcı, API, dokümantasyon.

## 1. Amaç ve bağlam

n köşeli basit bir çokgen (galeri) için en fazla ⌊n/3⌋ köşe kamerasıyla tüm alanı gören bir yerleşim: çokgen üçgenlenir, köşeler üç renge boyanır (her üçgenin üç köşesi farklı renk), en az kullanılan rengin köşelerine kamera konur. Sayfa bunu adım adım gösterir ve kullanıcıya aynı çokgende kendi kameralarını yerleştirip Fisk'i geçmeye çalışabileceği bir mod sunar.

**Kullanıcı kararları:**
- İki mod: "Fisk's construction" (adım adım) ve "Place your own cameras" (sandbox).
- Sandbox'ta kameralar yalnızca köşelere konur (köşeye tıklayınca aç/kapa).

**Varsayımlar:**
- Girdi `{ polygon, cameras }`; `cameras` köşe indeksleri, yalnızca sandbox'ta kullanılır; mod değişince çokgen korunur.
- Fisk modunda köşeler sürüklenebilir (basitlik koruması, bırakınca son geçerli şekle dönüş); sandbox'ta sürükleme yok.
- Görünürlük: bir nokta, kameradan ona giden doğru parçası çokgenin içinde (sınır dahil) kalıyorsa görülür.

**Başarı ölçütleri:**
1. Rastgele 200 basit çokgende: 3-boyama geçerli (her üçgende üç farklı renk), seçilen renk sınıfı ≤ ⌊n/3⌋, Fisk kameraları alanı tamamen görür.
2. Görünürlük çokgeni örneklemeyle doğrulanır (çokgen içinde rastgele noktalar: "kamera görür" ⇔ "görünürlük çokgeninin içinde").
3. "Comb" presetinde Fisk 4 kamera kullanır ve hiçbir 3 köşe kamerası alanı örtmez (kapsamlı arama testi).
4. Presetlerde sabitlenmiş kamera sayıları ve done metinleri tutar.
5. Diğer oynatıcıların davranışı değişmez; mevcut testler geçer (sayım güncellemeleri hariç); e2e `/webcgal/` alt yolunda da çalışır.

## 2. Geometri modülü (`src/geometry/algorithms/artGallery/`)

### 2.1 Yeniden kullanım
`triangulate(polygon)` (→ `triangles`), `isSimple`, `ensureCCW`, `pointInPolygon`, `diagonalInside`, `randomStarPolygon` (`src/geometry/algorithms/triangulation/`). Yeni üçgenleme kodu yazılmaz.

### 2.2 Dual ağaç ve 3-boyama (`fisk.ts`)
- `dualTree(triangles): { adjacency: number[][]; shared: Map<string, [number, number]> }` — iki üçgen iki ortak köşe paylaşıyorsa komşu; basit çokgende n − 2 düğümlü bir ağaçtır.
- `fisk(polygon, record?): FiskResult`, `FiskResult = { triangles: Triangle[]; colors: (0 | 1 | 2)[]; order: number[]; counts: [number, number, number]; chosen: 0 | 1 | 2; cameras: number[] }`.
  - Çokgen önce `ensureCCW`; indeksler girdiye göre kalır.
  - Başlangıç üçgeni: en küçük indeksli köşeyi içeren üçgenlerden en küçük indeksli üçgen; köşeleri artan indeks sırasıyla 0, 1, 2.
  - Dual ağaçta derinlik öncelikli gezinti (komşular üçgen indeksi sırasıyla); her yeni üçgenin üçüncü köşesi eksik rengi alır. `order` = gezinti sırasındaki üçgenler.
  - `chosen` = en az köşeli renk (eşitlikte küçük renk numarası); `cameras` = o rengin köşeleri, artan.
- Kaydedici satırları §3.2.

### 2.3 Görünürlük (`visibility.ts`)
- `sees(polygon, a: Pt, b: Pt): boolean` — `ab` parçası çokgenin içinde mi (sınır dahil; köşelerden geçen ve kenar boyunca uzanan durumlar dahil).
- `visibilityPolygon(polygon, v: number): Pt[]` — v köşesindeki kameranın gördüğü bölge, CCW. Yöntem: v'den diğer her köşeye ve her köşenin ±ε açılı yanlarına ışın; her ışın için en yakın sınır kesişimi; v'nin iç açısı dışında kalan ışınlar atılır; noktalar v etrafında açıya göre sıralanır. O(n²) (n ≤ 40 için yeterli). ε = 1e-7 radyan.
- Geometri katmanı alan birleşimi hesaplamaz; kapsama yüzdesi oynatıcıda paper.js boolean işlemleriyle (bkz. §4).

### 2.4 Testler (node)
- `dualTree`: n − 2 düğüm, n − 3 kenar, bağlı (ağaç).
- `fisk`: üçgen, kare, Textbook polygon, rastgele 200 basit çokgen (`randomStarPolygon`, n 3–30): geçerli 3-boyama; `cameras.length ≤ ⌊n/3⌋`; her üçgenin bir köşesi kamera; CW girdi aynı sonuç.
- `visibilityPolygon`: dışbükey çokgende tüm çokgen; L şekli bilinen sonuç; rastgele 50 çokgen × her köşe × 200 örnek nokta: `sees` ⇔ `pointInPolygon(visibility)` (sınıra 1e-6 yakın örnekler atlanır).
- "Comb" preseti: Fisk 4 kamera; tüm üçlü köşe kümeleri denenir, hiçbiri örtmez (örtme: örnek ızgarasındaki her iç nokta en az bir kameradan görülür).

## 3. Adımlar ve durum

### 3.1 Sözde kod (`pseudocode.ts`, 10 satır, başlık `[0]`)
```
0  ArtGallery(P)
1      Triangulate P into n − 2 triangles
2      Build the dual tree: a node per triangle, an arc per diagonal
3      Colour the three vertices of a first triangle with three different colours
4      for each further triangle t, in depth-first order of the dual tree
5          two vertices of t are shared with its parent and already coloured
6          give the third vertex of t the colour that is missing
7      Let c be the colour used least often (at most ⌊n/3⌋ vertices)
8      Place a camera at every vertex of colour c
9      return the cameras
```

### 3.2 Durum ve kayıt (`galleryState.ts`)
```ts
type GalleryState = {
  mode: 'fisk' | 'sandbox';
  phase: 'triangulate' | 'dual' | 'color' | 'choose' | 'place' | 'done' | 'sandbox';
  triangles: Triangle[];
  dualEdges: [number, number][];          // üçgen indeksleri (2. adımdan itibaren)
  colors: (0 | 1 | 2 | null)[];
  current?: number;                        // aktif üçgen
  newlyColored?: number[];
  counts?: [number, number, number];
  chosen?: 0 | 1 | 2;
  cameras: number[];
  visibility: Pt[][];                      // kameraların görünürlük çokgenleri
};
```
| Satır | Açıklama |
|---|---|
| 1 | "Triangulation: 12 triangles, 11 diagonals" |
| 2 | "Dual tree: 12 nodes, 11 arcs" |
| 3 | "First triangle v1 v2 v3: v1 red, v2 green, v3 blue" |
| 6 | "Triangle v4 v7 v5: v5 gets blue" |
| 7 | "Colour counts: red 5, green 4, blue 5 → green" |
| 8 | "Place cameras at v2, v6, v9, v13" |
| 9 | "Done: 4 cameras for 14 vertices (⌊14/3⌋ = 4)" (tekil: "1 camera") |
Renk adları "red", "green", "blue" (0, 1, 2).

### 3.3 Sandbox adımı
Tek adım, satır 9 (tüm sözde kod soluk; adım satırı oynatıcı tarafından soluk gösterilir); açıklama: kamera yoksa "No cameras yet: click a corner to place one"; örtmüyorsa "3 cameras · 92% covered"; örtüyorsa "Room covered with 3 cameras (Fisk's bound: ⌊14/3⌋ = 4)" (tekil "1 camera"). Yüzde `coverage()` ile (bkz. §4); durum kameraları, görünürlük çokgenlerini ve `coverage` sonucunu (`{ percent, covered, perCamera }`) taşır.

### 3.4 Presetler (`presets.ts`)
`GALLERY_PRESETS: { name; polygon: Pt[]; expected: { cameras: number; n: number } }[]`, hepsi 775×360 canvas içinde, en az 15 birim kenar payı, basit:
1. "Comb": 12 köşe (4 diş), öyle tasarlanır ki dişlerin uçları birbirini görmez ve hiçbir 3 köşe kamerası örtmez (§2.4 testi); Fisk 4.
2. "Textbook polygon": `TRIANGULATION_PRESETS`'teki aynı adlı çokgen (kopya).
3. "Convex room": düzgün 9-gen, merkez (387, 180), yarıçap 140; Fisk 3 (tek kamera yeterli olduğu metinde vurgulanır).
4. "L-shaped gallery", 5. "Star", 6. "Spiral corridor": uygulamada tasarlanır, basit ve canvas içinde; beklenen kamera sayıları hesaplanıp sabitlenir.
- `gallerySteps(input, mode)`: 'fisk' → §3.2 adımları; 'sandbox' → tek adım. `structuredClone`.
- Testler: son adım `fisk()` ile aynı; satırlar geçerli ve başlık değil; 6. satır adımlarında üç köşe farklı renk; `newlyColored` yalnızca 3 ve 6'da; preset sayıları; adım sayısı = n + 3 (Fisk); anlık görüntüler bağımsız.

## 4. Oynatıcı modülü (`src/players/artGalleryPlayer.ts`)

`PlayerModule<GalleryState, ArtGalleryInput>`, `ArtGalleryInput = { polygon: Pt[]; cameras: number[] }` (`types.ts`); canvas 775×360.
- **Modlar:** `[{ id: 'fisk', label: "Fisk's construction" }, { id: 'sandbox', label: 'Place your own cameras' }]`; `dimmedLines('sandbox')` = 0–9.
- **Tutamaçlar:** köşeler (her iki modda). Fisk'te `moveHandle` köşeyi taşır; sandbox'ta `moveHandle` girdiyi değiştirmeden döndürür ve yeni `clickHandle(input, i)` o köşedeki kamerayı aç/kapa yapar (kameralar artan sırada tutulur).
- **validate:** basit değilse "The polygon must be simple (no crossing edges)"; `renderInvalid` üçgenleme oynatıcısındaki gibi.
- **randomInput:** `randomStarPolygon` ile 10–16 köşe, canvas içinde; kamera yok.
- **Render (Fisk):** çokgen 2px; üçgenleme köşegenleri 1px `--ag-diag`; dual ağaç (2. adımdan) üçgen ağırlık merkezleri arasında ince kesikli; `current` üçgeni hafif dolgu `--ag-current`, dual düğümü vurgulu; boyanmış köşeler `--ag-c0/1/2` dolu daire, boyanmamışlar içi boş; 7. adımda seçilen sınıf halkalı; 8. adımdan itibaren kameralar (10px kare simge) ve görünürlük çokgenleri yarı saydam `--ag-view` (alpha .25); etiketler `v1…`.
- **Render (sandbox):** çokgen; kameraların görünürlük çokgenleri yarı saydam; örtülmeyen alan (çokgen eksi görünürlük çokgenlerinin birleşimi, paper.js `unite`/`subtract`) `--ag-uncovered` alpha .35; kamera simgeleri; diğer köşeler küçük daire.
- **Paneller:** "Colours" (renk başına `red: v1 v4 v7 v10 · 4`; seçilen `active`, bu adımda boyananın satırı `new`; boş "No vertex coloured yet"), "Cameras" (`v4 sees 38% of the room`; boş "No cameras yet"), "Coverage" (`n = 14 · ⌊n/3⌋ = 4 · cameras 3 · covered 92%`). Yüzdeler paper.js alanlarından, tam sayıya yuvarlanır (örtülen alan ≥ %99.95 ise "100%").
- **Sandbox açıklaması ve yüzdeler:** adım üreteci üretir (StepPlayer değişmez): `coverage(polygon, cameras)` (`visibility.ts`) çokgen içindeki 5 birimlik ızgara noktalarını `sees` ile test eder; yüzde = görülen örnek / tüm örnek, tam sayıya yuvarlanır; hiç görülmeyen örnek yoksa "covered". Kamera başına yüzde aynı yolla. paper.js boolean işlemleri yalnızca kırmızı örtülmemiş alanın çizimi içindir.
- **Renkler** (`theme.css`, açık/koyu aynı): `--ag-c0 #c01c28`, `--ag-c1 #26a269`, `--ag-c2 #1a5fb4`, `--ag-diag #9aa0a6`, `--ag-current #e66100`, `--ag-view #f5c211`, `--ag-uncovered #c01c28`.
- **hint** (oynatıcı altyapısında tek metin): "Drag the corners to change the room; in the camera mode, click a corner to place or remove a camera. Keys: ← → to step, Space to play or pause."
- **Testler (browser):** rastgele girdi basit; render saf; Fisk son adımda kamera sayısı ≤ ⌊n/3⌋ ve örtülmeyen alan 0; 3-boyama adımında her üçgenin köşeleri farklı renk; sandbox `clickHandle` aç/kapa; sandbox `moveHandle` değiştirmez; kamera yokken örtülmeyen alan > 0; paneller faz faz; preset adları.

## 5. Altyapı, sayfa, API, dokümantasyon, testler ve yayın

- **StepPlayer:** `PlayerModule`'e isteğe bağlı `clickHandle?(input: I, index: number): I`; StepPlayer, bir tutamaca basılıp 3 px'ten az hareketle bırakıldığında (ve modül `clickHandle` tanımlıyorsa) onu çağırır ve adımları yeniden hesaplar. Tanımlamayan oynatıcılarda davranış aynen sürer. Bir StepPlayer browser testi.
- **Registry:** `slug 'artGallery'`, `path '/algorithms/artGallery'`, `name 'Art Gallery Problem'`, Polygon Triangulation'dan hemen sonra; `summary 'Guard any simple polygon with at most ⌊n/3⌋ cameras: triangulate, 3-colour the vertices, and use the smallest colour class.'`; `thumbnail '/images/artGallery_tn.png'` (preset "Comb", son adım); tek 775×360 canvas. GitHub Pages rota kopyaları registry'den otomatik gelir.
- **İçerik (MDX):** problem (galeri, kamera, görünürlük); en az kamera sayısının NP-zor olduğu; Chvátal'ın ⌊n/3⌋ teoremi (yeterli ve tarak örneğinde gerekli); Fisk'in ispatı (üçgenleme, dual ağaç, 3-boyama, en küçük sınıf); O(n log n); "Convex room" ile sınırın en iyi olmadığı; sandbox hedefi ("try to beat Fisk"); kitap cümlesi "This page follows section 3.1, *Guarding and Triangulations*, of Computational Geometry: Algorithms and Applications, 3rd ed., by de Berg et al."; `[Polygon Triangulation](/algorithms/triangulation)` bağlantısı. Teorem numaraları yalnızca doğrulanmışsa.
- **API** (`src/engine/artGallery.ts`, `API_NAMES`'e `artGallery`, `visibilityPolygon`, `drawArtGallery`): `artGallery(polygon)` → `{ cameras, colors, triangles }` (girdiye göre indeksler); `visibilityPolygon(polygon, i)` → `Point[]`; `drawArtGallery(polygon, result, color = 'black')` kameraları ve görünürlük bölgelerini çizer. Girdi doğrulama üçgenleme API'siyle aynı (`toPolygon`); hatalar `artGallery:` / `visibilityPolygon:` / `drawArtGallery:` önekli ("the polygon must be simple", öğe indeksi 1 tabanlı, `visibilityPolygon: vertex index out of range`).
- **demo.js:** rastgele yıldız çokgen (`Polygon.createRandom`/mevcut yardımcı), Fisk kameraları, `drawArtGallery`, `console.log(result.cameras.length + ' camera(s) for ' + n + ' vertices')`.
- **Dokümantasyon:** `misc_functions` altına `artGallery` (21. öğe; `visibilityPolygon`, `drawArtGallery` aynı sayfada); docs 21 / "Try it" 15.
- **Testler:** e2e `artGallery.spec.ts` (sayfa "Colours" paneliyle açılır; her preset `expected`'tan üretilen done metnine ulaşır; Comb 4 kamera; sandbox'ta bir köşeye tıklayınca açıklama "1 camera · …" olur (BASE_URL ile değil, gerçek tıklama, debug kancası gerekmiyorsa skip yok); Code demosu); `visual.spec`; kart 11; docs 21 / 15. Hepsi `/webcgal/` alt yolunda da.
- **Yayın:** sayfa görevi bitince PR + yerel `/webcgal/` derlemesinden ekran görüntüleri; birleşmeden sonra GitHub Pages; canlı e2e.

## 6. Kapsam dışı
En az kamera sayısı (NP-zor); iç nokta kameraları; delikli galeriler; dik (ortogonal) galeriler (⌊n/4⌋); kenar kameraları.

## 7. Riskler
| Risk | Önlem |
|---|---|
| Görünürlük çokgeninde dejenere durumlar (ışın köşeden geçer, kenar boyunca) | ±ε yan ışınlar; örnekleme testi; kolineer köşeli presetler |
| paper.js boolean işlemlerinin sayısal kırılganlığı | Yalnızca görüntü/yüzde için; ≥ %99.95 → "100%"; Fisk doğruluğu geometri testlerinde |
| StepPlayer tıklama/sürükleme karışması | 3 px eşiği; `clickHandle` yoksa eski davranış; StepPlayer testi |
| Comb'un gerçekten 4 gerektirmesi | Kapsamlı üçlü arama testi |
