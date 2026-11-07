# Voronoi Diyagramı (Delaunay İkiliğinden): Tasarım

- **Tarih:** 2026-11-07
- **Durum:** İncelemede
- **Önceki spec'ler:** `2026-11-07-delaunay-design.md` (Delaunay, `circumcenter`, presetler, oynatıcı kalıbı), `2026-11-06-triangulation-design.md` (modlar), `2026-11-06-segment-intersection-design.md` (paneller)
- **Kapsam:** Planlanan dört algoritmanın dördüncüsü ve sonuncusu.

## 1. Amaç ve bağlam

WebCgal'e Voronoi diyagramı eklenecek. Diyagram, de Berg et al. Bölüm 7'nin (*Voronoi Diagrams*) tanımıyla ve §9.2'deki ikilikle **Delaunay üçgenlemesinden türetilir**: her üçgenin çevrel merkezi bir Voronoi köşesi, her Delaunay kenarının ikilisi bir Voronoi kenarı (zarf kenarları için ışın). Fortune'un süpürme çizgisi (§7.2) bu sayfada uygulanmaz; metinde anlatılır.

**Kullanıcı kararları:**
- Algoritma: Delaunay ikiliği (Fortune değil).
- Oynatıcı adımları köşe → kenar sırasıyla (Teorem 9.6'i bire bir gösterir); hücreler sonda toplanır.
- Dejenere girdilerde **sadık diyagram**: çakışan çevrel merkezler tek köşede birleştirilir, sıfır uzunluklu kenarlar atılır; eşdoğrusal girdide ardışık noktaların orta dikmeleri çizilir.

**Varsayımlar:**
- Girdi yalnızca nokta kümesi (`{ points }`); Delaunay varsayılan sırayla hesaplanır (genel konumda sonuç sıradan bağımsız; eşçember durumda birleştirme sonucu sıradan bağımsız kılar).
- Noktalar sürüklenebilir; 2 canvas biriminden yakın çift reddedilir.
- Mod yalnızca Delaunay'ın arka planda çizilip çizilmemesini belirler; adımlar aynıdır.

**Başarı ölçütleri:**
1. Rastgele ve dejenere girdilerde `isVoronoi` doğrular: her köşe komşu sitelerine eşit uzaklıkta ve başka hiçbir siteye daha yakın değil; her kenarın orta noktası iki sitesine eşit uzaklıkta; Euler ilişkisi.
2. Presetlerde beklenen köşe/kenar/hücre sayıları (ızgara 9 köşe; çember 1 köşe + 8 ışın; eşdoğrusal 4 doğru).
3. Işın ve doğrular canvas kutusuna kırpılır; çizilen hiçbir nokta canvas dışına taşmaz.
4. adım sayısı = 1 + T + E + n + 1 (Delaunay üçgen ve kenar sayıları); 25 noktada ≤ 140.
5. Mevcut oynatıcılar ve testler değişmez (sayım güncellemeleri hariç).

## 2. Geometri modülü (`src/geometry/algorithms/voronoi/`)

### 2.1 Tipler (`src/geometry/types.ts`'e eklenir)
```ts
export type VoronoiEdge = { sites: [number, number]; a: number; b: number | null; dir?: Pt }
//  b === null → a'dan dir yönünde ışın (dir birim vektör)
export type VoronoiLine = { sites: [number, number]; p: Pt; dir: Pt }   // yalnızca eşdoğrusal girdide
export type VoronoiCell = { site: number; vertices: number[]; rays?: [number, number] }
//  vertices CCW; rays = açık hücrenin iki ışınının edges indeksleri (giriş, çıkış)
export type VoronoiResult = {
  vertices: Pt[]; edges: VoronoiEdge[]; lines: VoronoiLine[]; cells: VoronoiCell[];
  triangles: Triangle[]; vertexOfTriangle: number[]
}
export type VoronoiInput = { points: Pt[] }
```

### 2.2 Algoritma (`voronoi.ts`)
- `voronoi(points: Pt[], record?: VorRecorder): VoronoiResult`
  1. `delaunay(points)` → üçgenler, kenarlar, zarf.
  2. **Köşeler:** her üçgenin `circumcenter`'ı. Birleştirme toleransı `MERGE_TOL = 1e-6 · D`, `D` = nokta kümesinin sınırlayıcı kutusunun köşegeni (en az 1). Yeni merkez mevcut bir köşeye `MERGE_TOL` içinde ise aynı köşe indeksi atanır (`vertexOfTriangle[t]`).
  3. **Kenarlar:** kenar → üçgen haritası (`Map<string, number[]>`, anahtar `"i,j"` i<j) ile her Delaunay kenarı için:
     - iki üçgen: `a = vertexOfTriangle[t]`, `b = vertexOfTriangle[t']`; `a === b` ise kenar atlanır (sıfır uzunluk);
     - tek üçgen (zarf): `a` üçgenin köşesi, `b = null`, `dir` = `p_i p_j`'nin orta dikmesi boyunca, üçgenin üçüncü köşesi `p_k`'dan **uzağa** bakan birim vektör (`dot(dir, p_k − mid) < 0`).
  4. **Eşdoğrusal girdi** (üçgen yok, n ≥ 2): noktalar doğru boyunca sıralanır; ardışık çiftler için `lines` = orta nokta + doğruya dik birim yön. `vertices`, `edges`, `cells` boş. n = 0 → her şey boş; n = 1 → köşe/kenar yok, tek hücre.
  5. **Hücreler:** her site için kendisine değen kenarlar (ve ışınlar) toplanır; köşeler siteye göre açıyla CCW sıralanır. Kapalı hücre: `vertices` döngüsel. Açık hücre (zarf sitesi): iki ışın; `vertices` giriş ışınının köşesinden çıkış ışınının köşesine CCW; `rays = [giriş, çıkış]`. Eşçember birleştirmesi sonrası aynı köşe birden çok kez listelenmez.
- Hata: çakışan nokta → `delaunay`'ın `Error('points must be distinct')` aynen geçer.
- Sıra bağımsızlığı: sonuç `delaunay`'ın varsayılan sırasına dayanır; birleştirme sayesinde eşçember kümelerde de köşe/kenar kümesi tektir (testle doğrulanır: üç farklı `order` ile aynı köşe ve kenar kümesi).

### 2.3 Kırpma (`clip.ts`)
- `Box = { x0, y0, x1, y1 }`.
- `clipSegment(a, b, box): [Pt, Pt] | null`, `clipRay(a, dir, box): [Pt, Pt] | null`, `clipLine(p, dir, box): [Pt, Pt] | null` — Liang–Barsky parametrik kırpma (`t ∈ [0,1]`, `[0,∞)`, `(−∞,∞)`).
- `clipPolygonToBox(poly: Pt[], box): Pt[]` — Sutherland–Hodgman; açık hücre = canvas kutusunun, sitenin Voronoi komşularının orta dikme yarım düzlemleriyle kırpılması (kesin); `cellPolygon(points, result, cell, box): Pt[]` bunu yapar (kapalı hücrede yalnızca köşeler kırpılır).

### 2.4 Doğrulayıcı (`verify.ts`)
- `isVoronoi(points, result): { ok: boolean; reason?: string }`:
  - her köşe `u`: ona değen üçgenlerin tüm siteleri `u`'ya eşit uzaklıkta (tolerans `1e-6 · D`), hiçbir site daha yakın değil;
  - her kenar/ışın: orta noktası (ışında `a + dir · D`) iki sitesine eşit uzaklıkta ve diğer sitelerden uzak değil (eşit uzaklıkta başka site olabilir yalnızca köşede, orta noktada olamaz);
  - her ışının `dir`'i orta dikme doğrultusunda ve zarfın dışına doğru;
  - hücreler: her site tam bir hücrede; kapalı hücre sayısı = iç site sayısı (`n − hullBoundaryCount`);
  - Euler: `V − E + F = 1` (sonsuz köşe hariç tutularak, `F = n`, `E` ışınlar dahil) — eşdoğrusal durumda `lines.length === n − 1`.
- `randomPointSet` Delaunay modülünden yeniden kullanılır.

### 2.5 Testler (Vitest, node)
- `clip.test.ts`: içeride/kesen/dışarıda parçalar; ışın her yönde; doğru; çokgen kırpma (üçgen kutuyla).
- `voronoi.test.ts`: kare → 1 köşe, 4 ışın, 4 açık hücre; ızgara 4×4 → 9 köşe (birleştirme), 12 ışın; çember 8 → 1 köşe, 8 ışın; eşdoğrusal 5 → 4 doğru; `collinear plus one` → 3 köşe; n=0,1,2; çakışma hatası; rastgele 200 küme `isVoronoi` ok ve üç sırayla aynı köşe/kenar kümesi; `dir` dışa bakar (zarf dışında bir nokta örnekleniyor); hücre köşeleri CCW.
- `verify.test.ts`: doğru/yanlış (köşe kaydırılmış) sonuç; Euler.

## 3. Adımlar ve durum

### 3.1 Sözde kod (`pseudocode.ts`, başlık `[0]`)
```
0  VoronoiFromDelaunay(P)
1      Compute the Delaunay triangulation DT(P)
2      for each triangle t of DT(P)
3          Create a Voronoi vertex at the circumcenter of t
4          (if it coincides with an existing vertex, merge them)
5      for each edge p_i p_j of DT(P)
6          if p_i p_j is shared by two triangles t and t'
7              Add the Voronoi edge between the vertices of t and t' (skip it if they coincide)
8          else (p_i p_j is a hull edge of the single triangle t)
9              Add a ray from the vertex of t along the perpendicular bisector of p_i p_j, away from t
10     if P is collinear, the Voronoi edges are the perpendicular bisectors of consecutive points
11     Collect, for each site, its incident edges in counter-clockwise order to form its cell
12     return the Voronoi diagram
```

### 3.2 Durum modeli (`voronoiState.ts`)
```ts
type VoronoiState = {
  phase: 'delaunay' | 'vertices' | 'edges' | 'collinear' | 'cells' | 'done';
  showDelaunay: boolean;                 // mod; computeSteps her adıma yazar
  triangles: Triangle[];                 // sabit
  delaunayEdges: [number, number][];     // sabit
  vertices: Pt[];                        // o ana kadar
  vertexOfTriangle: (number | null)[];
  edges: VoronoiEdge[];                  // o ana kadar
  lines: VoronoiLine[];
  cells: VoronoiCell[];                  // cells/done fazında dolar
  currentTriangle?: number; circle?: { center: Pt; radius: number }; merged?: number[];
  currentEdge?: [number, number]; newEdge?: number; skipped?: boolean;
  currentLine?: number; currentSite?: number;
};
```
Her adım `structuredClone`; yama alanları (`current*`, `circle`, `merged`, `newEdge`, `skipped`) tek adımlıktır.

### 3.3 Kayıt satırları
| Satır | Açıklama biçimi |
|---|---|
| 1 | "Delaunay triangulation: 9 triangles, 16 edges" (eşdoğrusal: "Delaunay triangulation: no triangles, the points are collinear") |
| 3 | "Triangle v1 v4 v7 → Voronoi vertex u3 at (312.4, 180.0)" (`circle` yaması) |
| 4 | "Triangle v4 v7 v8 shares its circumcenter with u3 → merged" (`merged` = o köşeye bağlı üçgenler) |
| 7 | "Edge v1–v4 is shared by u3 and u5 → Voronoi edge u3–u5" / "Edge v4–v7: both triangles share the vertex u3 → no edge" (`skipped`) |
| 9 | "Hull edge v1–v2 → ray from u3 away from v4" |
| 10 | "Points are collinear: bisector of v1–v2" |
| 11 | "Cell of v4: u3 u5 u6 u2" / "Cell of v1 is unbounded: ∞ u3 u5 ∞" |
| 12 | "Done: 7 vertices, 16 edges, 9 cells (4 unbounded)" (eşdoğrusal: "Done: 4 bisectors, 5 unbounded cells") |

Koordinatlar bir ondalıkla. Etiketler: siteler `v1…`, köşeler `u1…`.

### 3.4 Adım üreteci ve presetler
- `voronoiSteps(points, showDelaunay = true): Step<VoronoiState>[]`. Adım sayısı = 1 + T + E + n + 1 (eşdoğrusal: 1 + (n−1) + n + 1).
- `VORONOI_PRESETS: { name; points; expected: { vertices; edges; cells; unbounded } }[]`: "Textbook example", "Square grid 4×4", "Points on a circle", "Two clusters", "Collinear plus one" (koordinatlar `DELAUNAY_PRESETS`'ten içe aktarılır) ve "Collinear" ((150,100),(300,100),(450,100),(600,100),(700,100); expected vertices 0, edges 0, `lines` 4). `expected` değerleri uygulamada hesaplanıp sabitlenir; testler `isVoronoi` ile birlikte doğrular.
- Testler: `last step matches voronoi`; `lines valid, never heading`; `newEdge only on lines 7/9`, `merged only on line 4`; `step count = 1 + T + E + n + 1`; `showDelaunay propagates`; `snapshots independent`; `preset counts`; 25 noktada ≤ 141 adım (= 147 − 2h).

## 4. Oynatıcı modülü (`src/players/voronoiPlayer.ts`)

`PlayerModule<VoronoiState, VoronoiInput>`.
- `modes`: `[{ id: 'with-delaunay', label: 'With Delaunay' }, { id: 'voronoi-only', label: 'Voronoi only' }]`; `computeSteps(input, mode)` = `voronoiSteps(points, mode !== 'voronoi-only')`.
- `randomInput()`: `randomPointSet(Math.random, 12, {x0: 93, y0: 43, x1: 682, y1: 317}, 25)`. `validate`: 2 canvas biriminden yakın çift → "Points must be distinct". `handles = points`; `moveHandle` noktayı taşır. `canvas` 775×360; `hint`: "Drag the points to change the input. Keys: ← → to step, Space to play or pause."
- **Render** (her çağrıda `scene.clear()`): siteler dolu daire r=4 + `v1…`; `showDelaunay` ise Delaunay kenarları 1px `--vor-delaunay`; Voronoi köşeleri 5px kare `--vor-vertex`, köşe sayısı ≤ 20 ise `u1…` etiketleri; kenarlar 1.5px `--vor-edge`; ışın `clipRay`, doğru `clipLine` ile `{0,0,775,360}` kutusuna kırpılır (kırpma null ise çizilmez); `currentTriangle` dolgu `--vor-current` alpha .25 + `circle` ince kesikli; `merged` üçgenler aynı dolgu; `currentEdge` (Delaunay kenarı) 3px `--vor-current`; `newEdge` 3px `--vor-new`; `skipped` ise `currentEdge` 3px `--vor-skip` kesikli; `currentLine` 3px `--vor-new`; `cells`/`done`: her hücre `cellPolygon(..., box)` ile kırpılmış çokgen, dolgu `--vor-cell-<site % 8>` alpha .18 (`currentSite` alpha .4); `done`'da tüm kenarlar üstte yeniden çizilir. Eşdoğrusal durumda `done` hücreleri: ardışık doğrular arası şeritler (kutu kırpmalı; uçlarda yarım düzlemler) — `cellPolygon` eşdoğrusal dalı: siteye en yakın iki doğru (veya biri) ile kutu kesişimi.
- **Paneller** (`panels(step)`): "Vertices" (`u3 ← v1 v4 v7`; birleşmiş: `u3 ← v1 v4 v7, v4 v7 v8`; `currentTriangle`'ın köşesi `active`, bu adımda oluşan `new`; boş "No vertices yet"), "Edges" (`v1–v4 → u3–u5`; ışın `v1–v2 → u3 → ∞`; atlanan `v4–v7 → (skipped)` `testing`; doğru `v1–v2 → bisector`; yeni `new`; boş "No edges yet"), "Cells" (`v4: u3 u5 u6 u2`; açık `v1: ∞ u3 u5 ∞`; `currentSite` `active`, yeni `new`; boş "No cells yet"; yalnızca cells/done fazında gösterilir, önceki fazlarda `empty` ile).
- **Renkler** (`theme.css`, açık/koyu aynı): `--vor-delaunay #c7cad1`, `--vor-edge #1a5fb4`, `--vor-vertex #1a5fb4`, `--vor-current #e66100`, `--vor-new #26a269`, `--vor-skip #c01c28`, `--vor-cell-0…7`: `#8ecae6 #ffb703 #90be6d #f4a261 #cdb4db #a8dadc #e9c46a #b5e48c`.
- **Testler (browser):** rastgele girdi 12 nokta, çiftler ≥ 25; `validate` 1 birim reddeder / 2 kabul; render saf; köşe adımında kesikli `Path.Circle`; ışın adımında çizilen tüm segment uçları kutu içinde; `done`'da dolgulu çokgen sayısı = `voronoi().cells.length`; paneller faz faz (vertices: "No edges yet"; cells'te "Cells" satır sayısı); mod değişince adım sayısı aynı, Delaunay çizgi sayısı farklı; preset adları (6).

## 5. Sayfa, API, dokümantasyon, testler ve yayın

- **Registry:** `slug 'voronoi'`, `path '/algorithms/voronoi'`, `name 'Voronoi Diagram'`, Delaunay'dan sonra (9. kart); `summary 'Build the Voronoi diagram of a point set from its Delaunay triangulation: circumcenters become vertices, dual edges become edges.'`; `thumbnail '/images/voronoi_tn.png'` (`--slug voronoi --preset "Textbook example"`, son adım); tek 775×360 canvas.
- **İçerik (MDX):** tanım (site, hücre, en yakın site), köşe = üç siteye eşit uzaklık = boş çember, ikilik (Teorem 9.6), neden Delaunay'dan türetildiği + Fortune'a bir cümle (bölüm 7, O(n log n)), dejenere durumlar, kitap referansı "This page follows chapter 7, *Voronoi Diagrams*, and section 9.2 of Computational Geometry: Algorithms and Applications, 3rd ed., by de Berg et al.", etkileşim ipuçları, `[Delaunay Triangulation](/algorithms/delaunay)` linki.
- **API** (`src/engine/voronoi.ts`, `API_NAMES`'e `voronoi`, `drawVoronoi`, `voronoiCells`): `voronoi(points)` → `{ vertices, edges, cells, lines }` (kırpılmamış; `edges[k].dir` ile ışın); `drawVoronoi(points, result, color = 'black', box = {x0:0,y0:0,x1:775,y1:360})` — kenarlar 1.5px, ışın/doğrular kutuya kırpılır, dolgu yok; `voronoiCells(points, result, box?)` → `Point[][]` (site sırasıyla kırpılmış hücre çokgenleri). Hatalar `voronoi:` önekiyle: `points must be distinct`, `expected an array of points (item N is not a point)` (N 1 tabanlı). `demo.js`: `var points = Points.createRandom(12); var result = voronoi(points); drawVoronoi(points, result); console.log(result.vertices.length + ' vertex/vertices, ' + result.edges.length + ' edge(s), ' + result.cells.length + ' cell(s)');`
- **Dokümantasyon:** `misc_functions` altına `voronoi` (19. öğe; `drawVoronoi` ve `voronoiCells` aynı sayfada); docs 19 / "Try it" 13.
- **Testler:** e2e `voronoi.spec.ts` (sayfa "Vertices" paneliyle açılır; presetlerin `Done: …` metinleri; mod değişimi adım sayısını korur; sürükleme yeniden başlatır; çakıştırma uyarısı ve geri dönüş; Code demosu `/^\d+ vertex\/vertices, \d+ edge\(s\), \d+ cell\(s\)$/`), `visual.spec` sayfa, kart 9, docs 19 / 13. Mevcut testler değişmez.
- **Yayın:** sayfa görevi bitince PR + Netlify ön izleme (hesap kredisi engelliyorsa bildirilir); dokümantasyon, README, son inceleme aynı PR'a.

## 6. Kapsam dışı
Fortune'un süpürme çizgisi; ağırlıklı / en uzak nokta / yüksek dereceli Voronoi; tıklamayla nokta ekleme; hücre alanı ve komşuluk sorguları; Delaunay sayfasında Voronoi katmanı.

## 7. Riskler
| Risk | Önlem |
|---|---|
| Eşçember kümelerde yanlış birleştirme (tolerans çok dar/geniş) | `MERGE_TOL` ölçeğe göreli; ızgara/çember presetleri + rastgele ızgara alt kümeleriyle `isVoronoi` |
| Işın yönü içeri bakar | `dot(dir, p_k − mid) < 0` kuralı + doğrulayıcıda dışa bakma testi |
| Açık hücre çokgeni kutuyu yanlış kapatır | `cellPolygon` birim testleri (köşe hücreleri, kutu köşelerini içerenler); done'da alan toplamı = kutu alanı testi |
| Eşdoğrusal şeritler | ayrı dal, `Collinear` preseti, alan toplamı testi |
