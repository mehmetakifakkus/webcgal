# Poligon Üçgenleme (MakeMonotone + TriangulateMonotonePolygon): Tasarım

- **Tarih:** 2026-11-06
- **Durum:** İncelemede
- **Önceki spec'ler:** `2026-11-06-webcgal-modernization-design.md` (mimari), `2026-11-06-segment-intersection-design.md` (genel oynatıcı, paneller, süpürme veri yapıları)
- **Kapsam:** Planlanan dört algoritmanın ikincisi. Bu spec, de Berg Bölüm 3'ün iki algoritmasını tek sayfada, iki aşamalı tek oynatıcıyla ekler ve oynatıcıya "mod" ve "girdi doğrulama" desteği getirir.

## 1. Amaç ve bağlam

WebCgal'e de Berg et al., *Computational Geometry: Algorithms and Applications* (3. baskı) Bölüm 3'teki poligon üçgenleme eklenecek: önce basit poligon y-monoton parçalara bölünür (*MakeMonotone*, §3.2), sonra her parça doğrusal zamanda üçgenlenir (*TriangulateMonotonePolygon*, §3.3). Hedef kitle hesaplamalı geometri dersi öğrencileri ve öğretim elemanları.

**Kullanıcı kararları:**
- Tek sayfa (`/algorithms/triangulation`), iki aşamalı tek oynatıcı ve **aşama seçici**: Full / Partition only / Triangulation only.
- Girdi: rastgele basit poligon + hazır örnekler + köşe sürükleme; kendini kesen poligonlar için koruma (uyarı, adım hesaplanmaz, bırakınca son geçerli hale dönüş).
- Kapsam dışı: köşe ekleme/silme, serbest çizim, 3-boyama / sanat galerisi bekçileri, DCEL, mevcut L-monoton sayfasının taşınması.

**Varsayımlar:**
- Kitabın köşe sınıflandırması (start/end/split/merge/regular) ve helper mekanizması aynen.
- Kitabın sözlüksel sıralaması (önce büyük y, eşitse küçük x) aynı y'deki köşeleri çözer.
- "Triangulation only" modu girdiyi sessizce böler, yalnızca üçgenleme adımlarını gösterir.
- Sayfa yapısı diğer algoritma sayfalarıyla aynı ("Step by step" ve "Code" sekmeleri). Mevcut L-monoton sayfası değişmez; üçgenleme sayfasından ona link verilir.

**Başarı ölçütleri:**
1. Her basit poligon için n−2 üçgen; köşegenler poligonun içinde ve birbirini kesmiyor (doğrulayıcıyla test edilir).
2. Hazır örneklerde köşe sınıfları, köşegen ve üçgen sayıları beklenen değerlerde.
3. Sürüklemede poligon kendini keserse uyarı görünür, adımlar hesaplanmaz, bırakınca son geçerli girdiye dönülür.
4. 10 köşeli tipik girdide adım sayısı ≤ ~250; sınır testi ≤ 600.
5. Convex Hull ve Line Segment Intersection oynatıcıları davranış değiştirmez; mevcut testler değişmeden geçer.

## 2. Geometri modülü (`src/geometry/algorithms/triangulation/`)

DOM'dan ve paper.js'den bağımsız; Vitest node testleri. Tolerans: tüm parça/köşe karşılaştırmaları `GEOM_TOL` ile (segment intersection'daki kural).

### 2.1 Tipler (`src/geometry/types.ts`'e eklenir)
```ts
type Polygon = Pt[];                 // köşeler sırayla; işlenmeden önce CCW'ye normalize edilir
type Diagonal = [number, number];    // köşe indeksleri (küçük indeks önce)
type Triangle = [number, number, number];
type VertexType = 'start' | 'end' | 'split' | 'merge' | 'regular';
type TriangulationResult = {
  types: VertexType[];
  partitionDiagonals: Diagonal[];
  pieces: number[][];                // y-monoton parçalar, köşe indeksleri (CCW)
  triangulationDiagonals: Diagonal[];
  triangles: Triangle[];
};
```

### 2.2 Poligon yardımcıları (`polygon.ts`)
- `signedArea(polygon): number`, `ensureCCW(polygon): Polygon` (gerekirse ters çevirir; indeks eşlemesi için `reversed: boolean` da döner).
- `isSimple(polygon): boolean`: n < 3 → false; ardışık tekrarlanan köşe (samePt) → false; kenar çiftleri mevcut `segmentIntersection` ile test edilir, komşu kenarların paylaşılan ucu hariç; herhangi bir `point` ya da `overlap` → false.
- `above(p, q): boolean`: `p.y > q.y + GEOM_TOL` veya (`|p.y − q.y| ≤ GEOM_TOL` ve `p.x < q.x − GEOM_TOL`). Kitabın sözlüksel sırası.
- `interiorAngleReflex(polygon, i): boolean`: CCW poligonda `orientation(prev, v, next) === -1` (sağa dönüş) → yansıyan (> 180°). Eşdoğrusal (0) → yansıyan değil.
- `vertexType(polygon, i): VertexType` (kitap §3.2): her iki komşu da altındaysa (`above(v, prev) && above(v, next)`): yansıyan değilse `start`, yansıyansa `split`; her iki komşu da üstündeyse: yansıyan değilse `end`, yansıyansa `merge`; aksi halde `regular`.
- `vertexTypes(polygon): VertexType[]`.

### 2.3 MakeMonotone (`makeMonotone.ts`)
- `makeMonotone(polygon, record?): { diagonals: Diagonal[]; types: VertexType[] }`. Girdi CCW ve basit varsayılır (çağıran `ensureCCW` ve `isSimple` ile hazırlar).
- Olay kuyruğu: köşe indeksleri sözlüksel sırada (`above` ile sıralanmış dizi; dinamik ekleme yok).
- Durum yapısı: süpürme doğrusunu kesen **kenarlar** (kenar i = v_i → v_{i+1}), soldan sağa. Mevcut `StatusStructure` (segment intersection) kenarları parça olarak alır; `compareAt(segments, p)` aynen. Helper'lar ayrı `Map<number, number>` (kenar → köşe).
- Beş *Handle\*Vertex* prosedürü kitaptaki gibi; "soldan hemen komşu kenar e_j" için `status.leftOf(v)`. Köşegen eklenirken `(min, max)` sırasıyla kaydedilir; aynı köşegen iki kez eklenmez.
- Sonuç köşegenleri eklenme sırasıyla döner.

### 2.4 Parçalara ayırma (`split.ts`)
- `splitByDiagonals(polygon, diagonals): number[][]`: başlangıçta tek parça `[0..n−1]`; her köşegen `(a, b)` için a ve b'yi birlikte içeren parça bulunur ve `[a..b]` ile `[b..a]` döngüsel dilimlerine bölünür. O(n) arama; dosya başında "DCEL yerine basit bölme; öğretim ölçeği" notu. Parçalar CCW sırasını korur.
- Her parça için `isMonotone(piece, 90)` (mevcut `monotone.ts`) testlerde doğrulanır.

### 2.5 TriangulateMonotonePolygon (`triangulateMonotone.ts`)
- `triangulateMonotone(polygon, piece: number[], record?): Diagonal[]`. Kitap §3.3: parçanın köşeleri sözlüksel sırada birleştirilir (`merged: number[]`), en üstten en alta sol/sağ zincir etiketleri (`chain: ('left'|'right')[]`), yığınla köşegenler. Girdi y-monoton varsayılır.
- Üç köşeli parça → boş dizi.

### 2.6 Ana fonksiyon (`triangulate.ts`)
- `triangulate(polygon): TriangulationResult`: `ensureCCW`; `isSimple` değilse `Error('polygon must be simple')`; n < 3 → `Error('polygon needs at least 3 vertices')`; `makeMonotone` → `splitByDiagonals` → her parça `triangulateMonotone` → tüm köşegenlerle `splitByDiagonals` yeniden → her parça 3 köşeli → `triangles`.
- Girdi ters yönlüyse (`reversed`), çıktı indeksleri **girdinin** indekslerine geri çevrilir.

### 2.7 Doğrulayıcı (`verify.ts`, test yardımcıları)
- `isValidTriangulation(polygon, diagonals): { ok: boolean; reason?: string }`: `diagonals.length === n − 3`; her köşegen iki köşe arasında ve kenar değil; köşegenin orta noktası poligonun içinde (`pointInPolygon`, ray casting) ve köşegen hiçbir kenarı iç noktada kesmiyor (uçlar hariç); köşegenler birbirini iç noktada kesmiyor.
- `randomStarPolygon(rng, n, cx, cy, rMin, rMax): Polygon`: eşit aralıklı açılar + gürültü, rastgele yarıçaplar; her zaman basit. Testlerde ve oynatıcının `randomInput`'unda kullanılır (oynatıcı `Math.random` ile).

### 2.8 Dejenere durumlar
- Aynı y'deki köşeler: sözlüksel sıra (kitap). Hazır örnek "Same-y vertices" bunu gösterir.
- Eşdoğrusal ardışık köşeler: iç açı 180° → yansıyan değil → `regular` (ya da komşuların konumuna göre start/end). Üçgenleme bunları normal köşe gibi ele alır; `isValidTriangulation` orta nokta testini kenar üstü köşegenler için toleranslı yapar.
- Üçgen girdi: 0 köşegen, 1 üçgen. n < 3: hata.

## 3. Adım üreteci, durum modeli ve modlar

### 3.1 Kaydedici
Segment intersection'daki yaklaşım: `makeMonotone` ve `triangulateMonotone` isteğe bağlı `record(line, description, patch, ctx)` alır. `triangulationSteps(polygon, mode): Step<TriangulationState>[]` ikisini kaydediciyle çağırıp zincirler; `triangulate` kaydedicisiz aynı yolu kullanır. Değişmez: son adımın köşegen kümeleri `triangulate(polygon)` sonucuna eşittir.

### 3.2 Durum modeli
```ts
type TriangulationMode = 'full' | 'partition' | 'triangulate';
type TriangulationState = {
  phase: 'init' | 'partition' | 'triangulate' | 'done';
  types: VertexType[];
  sweepY: number | null;
  queue: number[];                                  // sıradaki köşeler (sözlüksel)
  status: { edge: number; helper: number }[];       // soldan sağa
  current?: number;
  edgeLeft?: number;
  partitionDiagonals: Diagonal[];
  pieces: number[][];
  activePiece?: number;
  merged?: number[];
  chain?: ('left' | 'right')[];
  cursor?: number;                                  // u_j (köşe indeksi)
  stack: number[];
  triangulationDiagonals: Diagonal[];
  reported?: Diagonal;
};
```
Her adım `structuredClone`. Patch alanları `current`, `edgeLeft`, `cursor`, `reported` yalnızca o adım için; `current` aynı köşenin tüm adımlarında kalır (segment intersection kuralı), `cursor` aynı u_j'nin adımlarında kalır.

### 3.3 Modlar
- `full`: init (köşe sınıfları) → bölme adımları → her parça için üçgenleme adımları → done.
- `partition`: init → bölme adımları → done (done durumunda `pieces` dolu).
- `triangulate`: init (bölme sessizce yapılmış; `partitionDiagonals` ve `pieces` init'te dolu; açıklama "Partition into monotone pieces (not shown in this mode)") → üçgenleme adımları → done.
- Done açıklaması: "Done: k diagonals, n−2 triangles" (`partition` modunda "Done: k diagonals, m monotone pieces").

### 3.4 Sözde kod
`TRIANGULATION_PSEUDOCODE: string[]`, tek düz liste, başlıklar vurgulanmaz:
- *MakeMonotone(P)* (kitabın 7 satırı), *HandleStartVertex*, *HandleEndVertex*, *HandleSplitVertex*, *HandleMergeVertex*, *HandleRegularVertex* (kitaptaki satırlar; toplam ~22), *TriangulateMonotonePolygon(P)* (kitabın ~12 satırı). Toplam ~40 satır; tam metin ve indeksler uygulama planında sabitlenir.
- `PSEUDOCODE_SECTIONS = { partition: [from, to], triangulate: [from, to] }`; `partition` modunda üçgenleme satırları, `triangulate` modunda bölme satırları soluk gösterilir.

### 3.5 Adım üretim kuralı
- **Init:** "Classify the vertices: 2 start, 2 end, 1 split, 1 merge, 4 regular" (line: MakeMonotone'un ilk satırı).
- **Bölme, her köşe için:** "Next vertex v5 (split)" → ilgili Handle prosedürünün her satırı ayrı adım: kenar ekle ("Insert e5 into T with helper v5"), kenar sil, helper ata ("Set helper(e3) = v5"), köşegen ekle ("Add diagonal v5–v2", `reported` dolu), merge köşesi helper kontrolü ("helper(e2) = v4 is a merge vertex → add diagonal").
- **Üçgenleme, her parça için:** "Triangulate piece 2 of 3: v1 v4 v7 v9" → "Merge the two chains: v1 v9 v4 v7" → yığın başlangıcı → her u_j: "u5 and the top of the stack are on different chains" / "same chain" → pop + köşegen adımları (`reported`) → push → son köşe adımları.
- Tipik 10 köşe: ~120–200 adım; sınır testi ≤ 600 (presetler + 20 rastgele 12 köşeli).

### 3.6 Hazır örnekler (`presets.ts`)
Koordinatlar uygulama planında sabitlenir (775×360 canvas, y-yukarı); her birinin beklenen köşe sınıfı sayıları, köşegen sayısı (n−3) ve üçgen sayısı (n−2) test edilir:
1. "Textbook polygon": kitap Şekil 3.5'e benzer, ≥ 2 split ve ≥ 2 merge köşesi, ~12 köşe.
2. "Already monotone": yalnızca start/end/regular; bölme köşegen eklemez.
3. "Comb": tarak; çok sayıda split/merge.
4. "Same-y vertices": sözlüksel sıralamayı gösteren dejenere örnek (aynı y'de 3+ köşe).
5. "Triangle": 3 köşe; 0 köşegen, 1 üçgen.

### 3.7 Testler (Vitest, node)
- `polygon`: `isSimple` (basit, kendini kesen, tekrarlanan köşe, 2 köşe), `ensureCCW`, `vertexType` sabit örnekte beş sınıf.
- `makeMonotone`: presetlerde köşegen sayıları; her parça `isMonotone(piece, 90)`; rastgele 200 yıldız poligon (5–20 köşe, sabit seed) için parçaların hepsi monoton ve köşegenler `isValidTriangulation`'ın köşegen koşullarını sağlar.
- `triangulateMonotone`: monoton sabit örnekler; köşegen sayısı n−3.
- `triangulate`: rastgele 200 poligon → `isValidTriangulation` ok ve `triangles.length === n−2`; ters yönlü (CW) girdi aynı sonucu (indeksler girdiye göre) verir; basit olmayan → hata; n<3 → hata; üçgen → 1 üçgen.
- `triangulationSteps`: son durum `triangulate` ile eşleşir (üç modda); `line` geçerli ve başlık değil; `partition` modunda üçgenleme satırı, `triangulate` modunda bölme satırı hiç vurgulanmaz; `reported` köşegen aynı adımın listesinde; snapshot bağımsızlığı; adım sınırı ≤ 600.

## 4. Oynatıcı genişletmesi ve üçgenleme modülü

### 4.1 Genel oynatıcıya ekler (`src/players/types.ts`, `src/components/StepPlayer.tsx`, `PseudocodePanel.tsx`)
- `modes?: { id: string; label: string }[]`; `computeSteps(input: I, mode?: string)`. Modlar varsa kontrol satırında "Mode" etiketli açılır menü; varsayılan ilk mod. Mod değişince adımlar yeniden hesaplanır, sayaç başa döner, oynatma durur. Sürükleme, preset ve "New random input" **modu korur**.
- `dimmedLines?(mode?: string): number[]` → `PseudocodePanel` `dimmed` prop'u (soluk satırlar; `aria-current` davranışı değişmez).
- `validate?(input: I): string | null`. Metin dönerse: oynatıcı canvas'ın üstünde `role="alert"` kırmızı şerit gösterir, transport butonlarını ve mod/preset menülerini devre dışı bırakır, canvas'ta `module.render` son geçerli adımla değil **`module.renderInvalid?.(scene, input)`** ile (varsa; yoksa yalnızca tutamaçlar) çizilir. Sürüklemede her ara konum `validate` edilir: geçersizse tutamaç fareyi takip eder, uyarı görünür, adımlar hesaplanmaz; fare bırakıldığında girdi son geçerli haline döner ve uyarı kalkar. Preset ve rastgele girdiler her zaman geçerlidir.
- `validate` tanımlamayan modüller (Convex Hull, Line Segment Intersection) için davranış değişmez; mevcut testler değişmeden geçer.

### 4.2 Üçgenleme modülü (`src/players/triangulationPlayer.ts`)
`PlayerModule<TriangulationState, Polygon>`:
- `randomInput()`: `randomStarPolygon(Math.random, 8–12 köşe, merkez (387, 180), yarıçap 60–150)`.
- `presets`: §3.6. `modes`: `[{ id: 'full', label: 'Full' }, { id: 'partition', label: 'Partition only' }, { id: 'triangulate', label: 'Triangulation only' }]`.
- `validate`: `isSimple` değilse "The polygon must be simple (no crossing edges)".
- `handles` = köşeler; `moveHandle` köşeyi taşır (saf).
- `renderInvalid`: poligon kenarları kırmızı, köşeler tutamaç.
- `render`: `scene.clear()`; poligon dolgusu açık ton + kenarlar; köşeler sınıfına göre sembol ve renk (start: dolu kare, end: içi boş kare, split: yukarı üçgen, merge: aşağı üçgen, regular: daire) ve etiket `v1…`; bölme aşamasında süpürme doğrusu (kesikli), `current` vurgulu, `status` kenarları kalın ve her kenardan helper köşesine ince kesikli çizgi, `edgeLeft` test rengi; bölme köşegenleri `--tri-partition`, üçgenleme köşegenleri `--tri-diagonal`; üçgenleme aşamasında aktif parça vurgulu dolgu, yığındaki köşeler numaralı halka, `cursor` dolu; done'da üçgenler hafif dolgulu. Renk değişkenleri `--tri-start`, `--tri-end`, `--tri-split`, `--tri-merge`, `--tri-regular`, `--tri-partition`, `--tri-diagonal`, `--tri-sweep`, `--tri-active` (açık/koyu aynı; canvas beyaz).
- `panels(step)`: bölme aşamasında "Event queue" (`v7 (split)`; `current` aktif) ve "Status structure" (`e3   helper: v4`; `edgeLeft` testing, bu adımda eklenen `new`; boş: "Status is empty"); üçgenleme aşamasında "Pieces" (`piece 2: v1 v4 v7 v9`; aktif olan `active`) ve "Stack" (üstten alta; push edilen `new`; boş: "Stack is empty"); init/done'da "Vertex types" (`v1  start`, …).
- `hint`: "Drag the vertices to change the polygon (it must stay simple). Keys: ← → to step, Space to play or pause."

### 4.3 Testler
- `StepPlayer.browser.test.tsx` (sahte modüllerle): mod menüsü adımları yeniden hesaplar ve sayacı sıfırlar; sürükleme ve preset modu korur; `validate` uyarı şeridi görünür, butonlar devre dışı, bırakınca girdi son geçerli hale döner ve uyarı kalkar; `validate` tanımlamayan modülde şerit hiç yok.
- `PseudocodePanel`: `dimmed` satırlara sınıf ekler.
- `triangulationPlayer.browser.test.ts`: rastgele girdi basit ve CCW, 8–12 köşe; render saf; aşamaya göre panel başlıkları; preset ve mod adları; `validate` kendini kesen poligonda metin döner.

## 5. Sayfa, içerik, API, testler ve yayın

### 5.1 Registry
`slug 'triangulation'`, `path '/algorithms/triangulation'`, `name 'Polygon Triangulation'`, `summary 'Partition a simple polygon into y-monotone pieces with a sweep, then triangulate each piece in linear time.'`, menüde Line Segment Intersection'dan sonra, Smallest Enclosing Disk'ten önce; `thumbnail '/images/triangulation_tn.png'` (413×232; `scripts/thumbnail.mjs` slug/preset/adım parametreli hale getirilir); `player`, `content`, `demoCode`, `canvases: [{ id: 'canvas-1', width: 775, height: 360, label: '' }]`.

### 5.2 İçerik (`index.mdx`, ~300–400 kelime)
Sanat galerisi motivasyonu (bir paragraf; teoremin ⌊n/3⌋ bekçi sonucu bir cümle; "3-boyama bu sayfada gösterilmiyor"); köşe sınıfları ve helper fikri; iki aşama ve karmaşıklık (O(n log n) + O(n)); kitap referansı "This page follows chapter 3, *Polygon Triangulation*, of Computational Geometry: Algorithms and Applications, 3rd ed., by de Berg et al."; link `[L-monotone Polygon](/algorithms/L-monoton)` ("what monotone means"); etkileşim ipuçları (modlar, presetler, köşe sürükleme, basitlik koşulu).

### 5.3 "Code" sekmesi ve API (`src/engine/api.ts`, yeni `src/engine/triangulation.ts`)
- `triangulate(polygon)`, `makeMonotone(polygon)`: girdi `Polygon` nesnesi (motorun `Polygon` sınıfı; `points[i].pos`), nokta dizisi (`Point`/`{x,y}`/`[x,y]`) ya da `TextPoint` dizisi; çıktı `{ types, partitionDiagonals, pieces, triangulationDiagonals, triangles }` (`makeMonotone` yalnızca `types`, `diagonals`, `pieces`). Girdi doğrulaması segment intersection'daki gibi açık mesajla; basit olmayan poligon → "triangulate: the polygon must be simple (no crossing edges)".
- `drawDiagonals(polygon, diagonals, color?)`, `drawTriangles(polygon, triangles)` (hafif dolgu); `drawables`'a eklenir.
- `demo.js`: `drawCoordinateSystem(); polygon = createRandomPolygon(); polygon.draw(); var result = triangulate(polygon); drawDiagonals(polygon, result.partitionDiagonals, 'red'); drawDiagonals(polygon, result.triangulationDiagonals, 'blue'); console.log(result.triangles.length + ' triangle(s), ' + result.partitionDiagonals.length + ' partition diagonal(s)');` Mevcut `createRandomPolygon` yıldız-şekilli üretir (basit), `createPolygon('square')` gibi hazır şekiller de geçerli.

### 5.4 Dokümantasyon
`misc_functions` altına `triangulate` öğesi (17. öğe): `triangulate`, `makeMonotone`, `drawDiagonals`, `drawTriangles` aynı sayfada; örnek = demo.js; "Try it".

### 5.5 Testler
- e2e `triangulation.spec.ts`: sayfa açılır (h1 "Polygon Triangulation", varsayılan sekme "Step by step", "Mode" menüsü üç seçenekli); her preset Last'ta açıklama metninde beklenen "Done: k diagonals, n−2 triangles"; mod "Partition only" Last'ta "monotone pieces" metni; köşe sürükleme adımları yeniden hesaplar; bir köşe poligonu kesecek konuma sürüklenince `role="alert"` görünür, bırakınca kaybolur ve köşe geri döner; "Code" sekmesi demosu hatasız ve çıktı satırı `/\d+ triangle\(s\)/`.
- `visual.spec.ts` sayfayı ekler; `algorithms.spec`/`home.spec` kart sayısı 7; docs 17 öğe, "Try it" 11.
- Mevcut testler değişmeden geçer (Convex Hull ve Line Segment Intersection oynatıcı testleri dahil).

### 5.6 Dal ve yayın
Dal `master`'dan (PR #4 birleşmiş) yeniden başlatıldı. Sayfa görevi bitince PR + Netlify ön izleme yayını; dokümantasyon, README ve son inceleme aynı PR'a. Yayın sonrası canlı kontrol.

## 6. Kapsam dışı
- Köşe ekleme/silme; serbest poligon çizimi.
- 3-boyama ve sanat galerisi bekçi yerleştirme.
- DCEL; monoton olmayan parçaların doğrudan üçgenlenmesi.
- L-monoton sayfasının yeni oynatıcıya taşınması.
- Sonraki algoritmalar (Delaunay, Voronoi).

## 7. Riskler
| Risk | Önlem |
|---|---|
| Helper/köşegen mantığında kitaptan sapma (özellikle merge köşeleri) | Preset tabanlı sabit testler + rastgele 200 poligonda her parçanın `isMonotone` doğrulaması |
| `splitByDiagonals`'ın köşegeni yanlış parçaya uygulaması | Her köşegenin uçlarını birlikte içeren tek parça var; test: bölme sonrası parça köşe sayıları toplamı = n + 2k |
| Sürüklemede geçersiz poligon durumunun oynatıcıyı tutarsız bırakması | `validate` yolu browser ve e2e testleriyle; son geçerli girdi `inputRef`'te tutulur |
| Sözde kod ~40 satırla panelin uzaması | Mod-dışı satırlar soluk; panel zaten sayfa genişliğinin %36'sı; 375px'te alt alta |
| Mevcut oynatıcıların bozulması | `modes`/`validate`/`dimmedLines` isteğe bağlı; mevcut testler değişmeden geçmek zorunda |
