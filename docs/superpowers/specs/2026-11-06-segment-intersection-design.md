# Doğru Parçası Kesişimi (Süpürme Doğrusu): Tasarım

- **Tarih:** 2026-11-06
- **Durum:** İncelemede
- **Önceki spec:** `2026-11-06-webcgal-modernization-design.md` (mimari, motor, oynatıcı)
- **Kapsam:** Planlanan dört yeni algoritmanın (süpürme doğrusu → üçgenleme → Delaunay → Voronoi) ilki. Bu spec yalnızca ilkini ve onun gerektirdiği oynatıcı genellemesini kapsar.

## 1. Amaç ve bağlam

WebCgal'e de Berg et al., *Computational Geometry: Algorithms and Applications* (3. baskı) Bölüm 2.1'deki doğru parçası kesişimi algoritması (*FindIntersections*, Bentley–Ottmann süpürme doğrusu) eklenecek. Hedef kitle hesaplamalı geometri dersinin öğrencileri ve öğretim elemanlarıdır.

**Kullanıcı kararları:**
- Tam görselleştirme: canvas + **olay kuyruğu** paneli + **durum yapısı** paneli.
- Etkileşim: uç nokta sürükleme, rastgele parçalar ve dejenere durumları gösteren hazır örnekler. Serbest çizim ikinci sürüme bırakıldı.
- Dejenere durumlar: tam kapsam; kitabın ele aldıkları (bir noktadan 3+ parça, paylaşılan uç noktalar, yatay parçalar) **ve** kitabın varsayım dışı bıraktığı üst üste binen eşdoğrusal parçalar.

**Başarı ölçütleri:**
1. Öğrenci bir adımı seçtiğinde canvas'ta süpürme doğrusunun konumunu, panellerde kuyruğun ve durum yapısının o anki halini, sözde kodda ilgili satırı görür.
2. Hazır dejenere örneklerin her biri doğru sonucu verir.
3. Rastgele girdilerde süpürme sonucu kaba kuvvet sonucuyla birebir aynıdır.
4. Mevcut Convex Hull oynatıcısı davranış değiştirmeden çalışır; mevcut testler değişmeden geçer.
5. Sayfa, mevcut algoritma sayfalarıyla aynı yapıdadır ("Step by step" ve "Code" sekmeleri) ve "Code" sekmesinde `findIntersections` API'si kullanılabilir.

## 2. Geometri modülü ve veri yapıları

Tümü `src/geometry/` altında, DOM'dan ve paper.js'den bağımsız, birim testli.

### 2.1 Tipler
`src/geometry/types.ts`'e eklenir:
```ts
type Segment = { a: Pt; b: Pt };
type IntersectionPoint = { p: Pt; segments: number[] };                 // p'den geçen parçaların indeksleri
type Overlap = { a: Pt; b: Pt; segments: [number, number] };           // eşdoğrusal örtüşmenin ortak kısmı
type IntersectionResult = { points: IntersectionPoint[]; overlaps: Overlap[] };
```
Parçalar dizideki indeksleriyle anılır (s1…sn, 1 tabanlı gösterim; kodda 0 tabanlı).

### 2.2 Kesişim ilkelleri
`src/geometry/primitives.ts`'e eklenir:
- `segmentIntersection(s: Segment, t: Segment): { kind: 'point'; p: Pt } | { kind: 'overlap'; a: Pt; b: Pt } | null`
- Hesaplar `EPS` toleranslıdır. Uç noktaya değme kesişim sayılır. Eşdoğrusal parçalar tek noktada değiyorsa `point`, bir parça boyunca örtüşüyorsa `overlap` döner.
- Yardımcılar: `xAtY(s: Segment, y: number): number` (yatay parçada tanımsız; çağıran özel durumu ele alır), `upperEndpoint(s)`, `lowerEndpoint(s)`.

### 2.3 Süpürme kuralları (kitap, Bölüm 2.1)
- Yatay süpürme doğrusu yukarıdan aşağı iner (y azalır; koordinatlar y-yukarı matematik sistemindedir).
- Olay noktaları önce y azalan, eşitlikte x artan sırada işlenir. İki nokta `EPS` içinde eşitse aynı olaydır.
- Bir parçanın üst ucu y'si büyük olan uçtur; yatay parçada **sol** uçtur.

### 2.4 Olay kuyruğu
`src/geometry/algorithms/sweep/eventQueue.ts`
- Nokta → `U(p)` (üst ucu p olan parçaların indeksleri) eşlemesi. Aynı noktaya gelen olaylar birleşir; `U(p)` ekleme sırasıyla büyür ama tekrar içermez.
- Arayüz: `insert(p: Pt, upperOf?: number): void`, `popNext(): { p: Pt; upper: number[] } | undefined`, `has(p): boolean`, `toArray(): { p: Pt; upper: number[] }[]` (sıralı; paneller ve anlık durumlar için).
- Uygulama: ikili aramalı sıralı dizi. Dosya başında not: "Öğretim ölçeği (≤ ~30 parça) için yeterli; kitaptaki dengeli ağaç değil."

### 2.5 Durum yapısı
`src/geometry/algorithms/sweep/status.ts`
- Süpürme doğrusunu kesen parçaların soldan sağa sırası. Sıralama, verilen olay noktası `p = (px, py)` için şu karşılaştırıcıyla yapılır:
  1. Parçanın `y = py` doğrusundaki x değeri (`xAtY`). Yatay parça için `px` kullanılır.
  2. Eşitlikte (p'den geçen parçalar) süpürme doğrusunun **hemen altındaki** sıra: `y = py − δ` için x değeri; eşdeğer olarak eğime göre. Böylece olay işlendikten sonra sıra doğru olur.
  3. Yatay parça, p'den geçen parçaların **en sağına** yerleşir.
  4. Tamamen örtüşen eşdoğrusal parçalar indeksle ayrılır (küçük indeks solda).
- Arayüz: `insert(i, p)`, `remove(i)`, `findThrough(p): number[]` (p'yi içeren parçalar; `L(p) ∪ C(p)` bunlardan türetilir), `leftOf(p): number | undefined`, `rightOf(p): number | undefined`, `leftNeighbor(i)`, `rightNeighbor(i)`, `reorderAt(p)` (p'den geçen parçaları kuralla yeniden sıralar), `toArray(): number[]`.
- Uygulama: sıralı dizi; ekleme ve arama ikili aramayla. Aynı öğretim notu.

### 2.6 Ana algoritma
`src/geometry/algorithms/sweep/findIntersections.ts`
- `findIntersections(segments: Segment[]): IntersectionResult`
- Kitabın *FindIntersections*, *HandleEventPoint* ve *FindNewEvent* yapısı korunur:
  - Olay p için `U(p)` kuyruktan, `L(p)` ve `C(p)` durum yapısından (`findThrough`) alınır. `|U ∪ L ∪ C| ≥ 2` ise p bir kesişim noktasıdır ve raporlanır.
  - `L ∪ C` silinir, `U ∪ C` eklenir (sıra, süpürme doğrusunun hemen altına göre).
  - `U ∪ C` boşsa p'nin sol ve sağ komşuları test edilir; değilse en soldaki/en sağdaki yeni parça kendi dış komşusuyla test edilir.
  - *FindNewEvent(sl, sr, p)*: iki parça süpürme doğrusunun altında (ya da üstünde ama p'nin sağında) kesişiyorsa ve olay kuyrukta yoksa eklenir.
- **Örtüşme eki (kitabın ötesinde):** *FindNewEvent* içinde iki komşu parça eşdoğrusal ve örtüşüyorsa ortak parça `overlaps`'a bir kez eklenir (aynı çift için tekrar yok; `Set<"i,j">` ile). Örtüşmenin uç noktaları zaten uç nokta olayı olduğundan kuyruğa ek olay gerekmez. Örtüşen parçaların ortak uç noktaları, `points` listesine de `|U ∪ L ∪ C| ≥ 2` kuralıyla girer; bu kitapla tutarlıdır.
- 0 ve 1 parça için boş sonuç döner. Uzunluğu `EPS` altındaki (dejenere) parçalar nokta gibi ele alınır: üst ve alt ucu aynıdır; algoritma bunlarla da çökmemelidir.

### 2.7 Referans uygulama
`src/geometry/algorithms/sweep/bruteForceIntersections.ts`
- `bruteForceIntersections(segments): IntersectionResult`: tüm çiftleri `segmentIntersection` ile dener; nokta kesişimleri `EPS` toleransıyla birleştirir ve her noktada o noktadan geçen **tüm** parçaları listeler (yalnızca çiftten gelenleri değil). Örtüşmeler çift başına bir kez.
- Testlerde süpürme sonucuyla karşılaştırmak için `sameResult(a, b, eps)` yardımcı fonksiyonu: noktaları konuma göre eşleştirir, parça kümelerini karşılaştırır; örtüşmeleri uç noktalarına (sırasız) ve parça çiftine göre eşleştirir.

## 3. Adım üreteci ve durum modeli

### 3.1 Tek uygulama, iki çıktı
Algoritma bir kez yazılır ve isteğe bağlı bir kaydedici alır:
```ts
type Recorder<S> = (line: number, description: string, patch: Partial<S>) => void;
function runSweep(segments: Segment[], record?: Recorder<SweepState>): IntersectionResult;
```
- `findIntersections(segments)` = `runSweep(segments)`.
- `findIntersectionsSteps(segments): Step<SweepState>[]` = kaydedici ile `runSweep`; her kayıtta o anki tam durum (`queue.toArray()`, `status.toArray()`, bulunanlar, patch alanları) `structuredClone` ile saklanır. `patch` alanları (`current`, `U`, `L`, `C`, `testing`, `newEvent`, `reported`) yalnızca o adım için geçerlidir ve bir sonraki kayıtta sıfırlanır.
- Değişmez: son adımın `points` ve `overlaps` alanı `findIntersections` sonucuna eşittir.

### 3.2 Durum modeli
```ts
type SweepState = {
  phase: 'init' | 'event' | 'done';
  sweepY: number | null;
  queue: { p: Pt; upper: number[] }[];
  status: number[];
  current?: Pt;
  U?: number[]; L?: number[]; C?: number[];
  testing?: [number, number];
  newEvent?: Pt;
  reported?: IntersectionPoint | Overlap;
  points: IntersectionPoint[];
  overlaps: Overlap[];
};
```

### 3.3 Sözde kod
`SEGMENT_INTERSECTION_PSEUDOCODE: string[]`, kitabın üç prosedürü tek düz listede. Prosedür başlıkları vurgulanmayan satırlardır (`line` hiçbir adımda onları göstermez). Örtüşme eki iki satırdır ve `(extension)` etiketi taşır. Tam metin uygulama planında sabitlenir; satır sayısı yaklaşık 25.

### 3.4 Adım üretim kuralı
Her olay için şu sırayla adımlar üretilir:
1. Olayı çek: `current = p`, `sweepY = p.y`; açıklama "Next event p = (x, y)".
2. `U`, `L`, `C` belirlenir; açıklama kümeleri listeler.
3. `|U ∪ L ∪ C| ≥ 2` ise rapor adımı: `reported` dolu.
4. `L ∪ C` silinir: durum yapısı gösterilir.
5. `U ∪ C` eklenir: durum yapısı gösterilir; eklenenler panelde `new`.
6. Her komşu testi ayrı adım: `testing = [i, j]`; kesişim bulunursa `newEvent` dolu ve kuyruk güncel; örtüşme bulunursa `reported` örtüşmedir.
7. Kuyruk boşalınca `phase: 'done'`.

Başlangıçta bir `init` adımı (tüm üst uçlar kuyrukta, durum boş). 8 parça için tipik olarak 60–150 adım.

### 3.5 Açıklamalar
İngilizce. Parçalar `s3` biçiminde (1 tabanlı), noktalar yuvarlanmış tam sayı koordinatla `(142, 87)`.

### 3.6 Testler (Vitest, node)
- `primitives`: `segmentIntersection` için kesişen, paralel, eşdoğrusal ayrık, eşdoğrusal değen, kısmi örtüşen, tam örtüşen, özdeş, dikey ve yatay çiftler; uç noktaya değme.
- `eventQueue`: sıralama (y azalan, x artan), birleşme, `has`, `EPS` eşitliği.
- `status`: tek noktadan geçen parçaların doğrunun altındaki sırası, yatay parça en sağda, örtüşen parçalar indeksle, `reorderAt`.
- `findIntersections`:
  - Sabit örnekler: iki parça tek kesişim; üç parça tek noktada; dikey ve yatay; paylaşılan uç; uç noktanın başka parçanın iç noktasına değmesi; kısmi örtüşme; tam örtüşme; özdeş iki parça; 0 ve 1 parça; uzunluğu sıfır parça.
  - Rastgele 200 girdi (sabit seed, her biri 2–12 parça) için `sameResult(findIntersections, bruteForceIntersections)`.
  - Kitaptaki Şekil 2.x benzeri bir örnek: raporlanan noktaların sayısı ve her noktadaki parça kümeleri.
- `findIntersectionsSteps`:
  - Son adımın sonucu `findIntersections` ile aynı.
  - Her adımda `line` geçerli ve bir prosedür başlığı değil; `queue` sıralı; `status`, `sweepY` için karşılaştırıcıyla tutarlı.
  - Snapshot bağımsızlığı: bir adımın `status` dizisi mutasyona uğratıldığında diğer adımlar değişmez.
  - Her hazır örnek (Bölüm 4.3) için beklenen kesişim sayısı.

## 4. Oynatıcı genellemesi ve paneller

### 4.1 Modül arayüzü
`src/players/types.ts`:
```ts
type Panel = {
  title: string;
  rows: { text: string; highlight?: 'active' | 'testing' | 'new' }[];
  empty?: string;
};
type PlayerModule<S, I> = {
  computeSteps(input: I): Step<S>[];
  render(scene: Scene, step: Step<S>, input: I): void;
  pseudocode: string[];
  randomInput(): I;
  presets?: { name: string; input: I }[];
  handles(input: I): Pt[];
  moveHandle(input: I, index: number, p: Pt): I;
  panels?(step: Step<S>, input: I): Panel[];
  canvas?: { width: number; height: number };
};
```
- `StepPlayer` `input: I` tutar; sürükleme hedeflerini `handles()` ile bulur, `moveHandle()` ile girdiyi günceller (saf; eski girdi değişmez). Girdinin türünü bilmez.
- "New random points" butonu "New random input" olur. `presets` varsa yanında "Preset" açılır menüsü; seçim girdiyi değiştirir ve oynatıcıyı başa alır.
- `canvas` verilmezse 775×360. Oynatıcıdaki kopya sabitler kalkar.
- Convex Hull modülü uyarlanır: `handles = input`, `moveHandle` noktayı değiştirir, `randomInput` = eski `initialPoints`. Davranış değişmez.

### 4.2 Yan paneller
`src/components/StatePanel.tsx`: başlık + satır listesi; `highlight` değerine göre renk (`active`: vurgu rengi, `testing`: test rengi, `new`: başarı rengi); boşsa `empty` metni. Oynatıcı panelleri sözde kod panelinin altına dizer; dar ekranda hepsi alt alta. İçerik tamamen modülden gelir.

### 4.3 Süpürme modülü
`src/players/sweepLinePlayer.ts`
- `randomInput()`: 7 rastgele parça; uçlar canvas içinde %10 kenar boşluğuyla; uzunluğu 40 birimden kısa parçalar yeniden üretilir.
- `presets` (adlar aynen):
  1. "Three segments through one point"
  2. "Vertical and horizontal segments"
  3. "Shared endpoint"
  4. "Endpoint on a segment"
  5. "Overlapping segments"
  6. "Grid of six segments" (çok kesişim)
  Koordinatlar uygulama planında sabitlenir; her preset için beklenen `points.length` ve `overlaps.length` test edilir.
- `handles(segments)`: tüm uç noktalar, `[s0.a, s0.b, s1.a, …]` sırasıyla. `moveHandle(segments, k, p)`: `segments[⌊k/2⌋]`'nin `a` (k çift) ya da `b` (k tek) ucu.
- `render`: canvas temizlenir; parçalar ince çizgi, durum yapısındakiler kalın; `testing` çifti test rengiyle; süpürme doğrusu `sweepY`'de canvas genişliğinde kesikli çizgi; kuyruktaki olay noktaları içi boş küçük daire, `current` dolu; `points` dolu daire, `overlaps` kalın çizgi; `newEvent` küçük halka. Parça etiketleri (`s1`…) üst uca yakın.
- Renk değişkenleri (`src/styles/theme.css`, açık ve koyu): `--sweep-line`, `--sweep-event`, `--sweep-found`, `--sweep-testing`, `--sweep-overlap`, `--sweep-status`.
- `panels(step)`: "Event queue" (satır: `(x, y)   U = {s2, s5}`; `current` satırı `active`, `newEvent` satırı `new`; boş: "Queue is empty") ve "Status structure" (soldan sağa `s3   s1   s4`; `testing` çifti `testing`, bu adımda eklenenler `new`; boş: "Status is empty").

### 4.4 Etkileşim
Uç nokta sürüklenince adımlar yeniden hesaplanır ve oynatıcı başa döner. Klavye, hız, sayaç, "Step k / n" ve sözde kod paneli aynen.

### 4.5 Testler
- `StepPlayer.browser.test.tsx`: mevcut 4 test değişmeden geçer. Eklenenler: sahte bir `PlayerModule<_, Segment[]>` ile preset seçimi girdiyi değiştirir ve sayacı başa alır; `panels` çıktısı `StatePanel` olarak görünür ve `highlight` sınıfları doğru; `handles`/`moveHandle` sürüklemede çağrılır.
- `StatePanel.browser.test.tsx`: boş durum metni; vurgu sınıfları.

## 5. Sayfa, içerik, API, testler ve yayın

### 5.1 Registry
```ts
{
  slug: 'segmentIntersection',
  path: '/algorithms/segmentIntersection',
  name: 'Line Segment Intersection',
  thumbnail: '/images/segmentIntersection_tn.png',
  summary: 'Find all intersections of n line segments with a sweep line in O((n + k) log n) time.',
  content, demoCode, player
}
```
Menüde Convex Hull'dan hemen sonra. Küçük görsel: oynatıcının orta bir adımından Playwright ile alınan ekran görüntüsü, mevcut görsellerle aynı boyutta.

### 5.2 İçerik
`src/content/algorithms/segmentIntersection/index.mdx`: problem tanımı; kaba kuvvetin O(n²) olduğu ve çıktıya duyarlı O((n+k) log n) fikri; kitap referansı (Bölüm 2.1); olay kuyruğu ve durum yapısının rolü; kitabın varsayımlarının ötesinde örtüşen parçaların da ele alındığı notu; etkileşim ipuçları. Mevcut sayfalarla aynı uzunluk ve ton.

### 5.3 "Code" sekmesi ve API
Motor API'sine (`src/engine/api.ts`) eklenir:
- `findIntersections(segments)`, `bruteForceIntersections(segments)`: girdi `{a, b}` nesneleri (`paper.Point` ya da `{x, y}`); çıktı Bölüm 2.1 biçimi, noktalar `paper.Point`.
- `Segments.createRandom(n)`: `{a, b}` dizisi, canvas içinde.
- `Segments.draw(segments)`: parçaları çizer ve etiketler.
- `drawIntersections(result)`: noktaları ve örtüşmeleri işaretler.
`demo.js`: 7 rastgele parça çizer, `findIntersections` çağırır, kesişimleri işaretler, `console.log` ile sayısını yazar. Uç nokta sürükleme bu sekmede yok (ikinci sürüm).

### 5.4 Dokümantasyon
`misc_functions` altına `findIntersections` öğesi: açıklama, çalışan örnek, "Try it". `docs.test.ts` ve `docs.spec.ts` 16 öğeye güncellenir.

### 5.5 Testler
- e2e `segmentIntersection.spec.ts`: sayfa açılır ve varsayılan sekme "Step by step"; Last'ta konsolda hata yok ve "Status structure" paneli "Status is empty" gösterir; her preset seçimi sayacı "Step 1 /" yapar ve Last'ta canvas'taki kesişim işareti sayısı beklenen değerdir; uç nokta sürükleme adımları yeniden hesaplar; "Code" sekmesinde demo hatasız çalışır.
- `visual.spec.ts`: `/algorithms/segmentIntersection` eklenir.
- Mevcut tüm testler değişmeden geçer.

### 5.6 Dal ve yayın
- PR #3 (modern UI, dokümantasyon, legacy temizliği) birleştikten sonra `claude/admiring-mendel-0muoxd` dalı güncel `master`'dan yeniden başlatılır; bu özellik oraya işlenir ve ayrı bir PR açılır.
- Yayın: Netlify'a manuel (repo bağlanana kadar). Yayın sonrası canlıda sayfa ve demo kontrolü.

## 6. Kapsam dışı
- Serbest parça çizme ve silme.
- "Code" sekmesinde sürüklenebilir parçalar (`TextSegment`).
- Kaba kuvvet ile adım sayısı karşılaştırması.
- Dengeli ağaç tabanlı kuyruk ve durum yapısı.
- Sonraki algoritmalar (üçgenleme, Delaunay, Voronoi) ve mevcut dört algoritmaya oynatıcı eklenmesi.

## 7. Riskler
| Risk | Önlem |
|---|---|
| Dejenere durumlarda süpürme ile kaba kuvvet sonuçlarının ayrışması | Rastgele girdilere ek olarak her dejenere durum için sabit test; `sameResult` EPS toleranslı |
| Durum yapısı sıralamasının olay noktasında bozulması | `reorderAt(p)` ve her adımda sıralama tutarlılığı testi |
| Oynatıcı genellemesinin Convex Hull'u bozması | Mevcut testler değiştirilmeden geçmek zorunda; Convex Hull modülü önce uyarlanır, sonra yeni modül eklenir |
| Çok sayıda adım (grid preset) | Adım sayısı üst sınırı testi (≤ 500); gerekirse komşu testlerini olay başına tek adımda toplama seçeneği |
