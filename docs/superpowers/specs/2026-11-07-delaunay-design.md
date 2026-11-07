# Delaunay Üçgenlemesi (Rastgele Artımlı Ekleme): Tasarım

- **Tarih:** 2026-11-07
- **Durum:** İncelemede
- **Önceki spec'ler:** `2026-11-06-segment-intersection-design.md` (genel oynatıcı, paneller), `2026-11-06-triangulation-design.md` (modlar, doğrulama, soluk satırlar)
- **Kapsam:** Planlanan dört algoritmanın üçüncüsü. Voronoi (dördüncü) bunun komşuluk yapısı ve `circumcenter` üzerine kurulacak.

## 1. Amaç ve bağlam

WebCgal'e de Berg et al. Bölüm 9'un (*Delaunay Triangulations*) rastgele artımlı algoritması (§9.3) eklenecek: sembolik köşeli büyük üçgen, her noktanın konumlandırılıp eklenmesi, *LegalizeEdge* ile kenar çevirmeleri, sonunda sembolik köşelerin silinmesi.

**Kullanıcı kararları:**
- Nokta konumlandırma basit taramayla; kitabın DAG'ı (tarih yapısı) sayfa metninde anlatılır, gösterilmez.
- Kitabın sembolik köşeleri p₋₁, p₋₂ ve onlara özel yasallık/yön kuralları aynen uygulanır.

**Varsayımlar:**
- Girdi: nokta kümesi + ekleme sırası (`{ points, order }`); noktalar sürüklenebilir, sıra korunur.
- Tek mod (mod altyapısı kullanılmaz). Çevrel çember yalnızca test edilen kenar için gösterilir.
- Dejenere durumlar: eşçember dört nokta → çember üzerindeki nokta "yasal" sayılır (çevirme yok); eşdoğrusal eklemede kenar-üstü (dörde bölme) yolu; tekrarlanan nokta reddedilir.

**Başarı ölçütleri:**
1. Rastgele ve dejenere girdilerde sonuç boş çevrel çember özelliğini sağlar; üçgen sayısı `2n − 2 − h`; üçgenler zarfı örter.
2. Hazır örneklerde beklenen üçgen ve çevirme sayıları.
3. Sürüklemede adımlar yeniden hesaplanır, sıra korunur; çakışan noktalar uyarıyla reddedilir.
4. 12 noktada adım sayısı ≤ ~200; sınır testi ≤ 600 (25 nokta dahil).
5. Mevcut oynatıcılar ve testler değişmez.

## 2. Geometri modülü (`src/geometry/algorithms/delaunay/`)

### 2.1 İlkeller (`src/geometry/primitives.ts`'e eklenir)
- `inCircle(a: Pt, b: Pt, c: Pt, d: Pt): -1 | 0 | 1`: (a, b, c) CCW varsayılır; d çevrel çemberin içinde +1, üzerinde 0, dışında −1. 3×3 determinant; tolerans ölçeğe göreli: `|det| ≤ GEOM_TOL · (ölçek)⁴` benzeri bir sınırla 0 (ölçek = köşelerin d'ye uzaklıklarının maksimumu). (a, b, c) CW verilirse işaret çevrilir.
- `circumcenter(a: Pt, b: Pt, c: Pt): Pt | null` (eşdoğrusalsa null). Mevcut `circumcircle` ile tutarlı; Voronoi için.

### 2.2 Sembolik köşeler ve yön (`symbolic.ts`)
- `P_MINUS_1 = -1`, `P_MINUS_2 = -2`.
- `p₀` = sözlüksel en üst nokta: önce büyük y, eşitse büyük x (kitap §9.3: "lexicographically highest"). `lexHigher(p, q)`.
- Kitap §9.3'ün kuralı: sembolik köşeler, sözlüksel olarak p₋₂ < p₋₁ < tüm gerçek noktalar olacak şekilde "uzakta" kabul edilir. `orient(points, i, j, k): -1 | 0 | 1`: üçü de gerçekse `orientation`; sembolik içerenler için kitabın (sayfa 204–205) tablosu: p₋₁ içeren bir doğrunun "solu/sağı" sözlüksel karşılaştırmayla belirlenir; tam karar tablosu uygulama planında sabitlenir ve testlerle (kitabın örneği) doğrulanır.
- `pointInTriangle(points, tri, p)`: üç `orient` ile; tam kenar üstü (0) durumunda hangi kenar olduğu döner.

### 2.3 Üçgen ağı (`mesh.ts`)
```ts
type Tri = { v: [number, number, number]; n: [number, number, number]; alive: boolean }; // v CCW; n[e] = v[e] karşısındaki komşu, −1 yok
class TriangleMesh {
  tris: Tri[];
  locate(points, p): { t: number; edge?: number };   // canlı üçgenleri tarar
  split3(t, p): [number, number, number];            // yeni üçgen indeksleri
  split4(t, edge, p): [number, number, number, number];
  flip(t, edge): { a: number; b: number; newEdge: [number, number] };  // komşu üçgenle çevir
  alive(): number[];
  edges(): [number, number][];
  snapshot(): { v: [number, number, number]; alive: boolean }[];
}
```
Komşuluk güncellemeleri her işlemde doğrulanabilir (`checkAdjacency()` testlerde).

### 2.4 Algoritma (`delaunay.ts`)
- `delaunay(points: Pt[], order?: number[], record?: Recorder): DelaunayResult`
  - `DelaunayResult = { triangles: [number, number, number][] (CCW); edges: [number, number][] (i<j, sıralı); hull: number[] (CCW); flips: number }`.
  - Adımlar: p₀ seçimi; başlangıç üçgeni (p₀, p₋₁, p₋₂); kalan noktalar `order` sırasıyla (varsayılan: `seed = n` ile mulberry32 permütasyonu); her p_r: `locate` → `split3`/`split4` → etkilenen 3/4 kenar için `legalizeEdge` (açık yığın, LIFO); sonunda sembolik köşeli üçgenler atılır.
  - `isIllegal(points, p_r, edge=(i,j), k)`: kitap §9.3: dört köşe de gerçekse `inCircle(tri(i,j,k)… , p_r) === 1`; aksi halde kenar yasal **ancak ve ancak** `min(k, p_r) < min(i, j)` (sembolik indeksler negatif olduğundan kitabın kuralı doğrudan çıkar); kitabın "p_r ve k'nin her ikisi gerçek, i veya j sembolik" durumu dahil tüm kombinasyonlar bu tek kurala indirgenir (kitap, Lemma 9.?'nin ardından bunu belirtir). Çember üzerinde (0) → yasal.
  - `order` p₀'ı içeriyorsa çıkarılır; p₀ dışında eksik nokta varsa sona eklenir (sürükleme sonrası p₀ değişimi için).
- Dejenere: tekrarlanan nokta (`samePt`) → `Error('points must be distinct')`; n < 3 → `triangles: []`, `edges` (n=2 tek kenar), `hull` tüm noktalar; tüm noktalar eşdoğrusal → üçgen yok, ardışık kenarlar.

### 2.5 Doğrulayıcı (`verify.ts`)
- `isDelaunay(points, triangles): { ok: boolean; reason?: string }`: her üçgen CCW; her üçgen için diğer tüm noktalar `inCircle ≤ 0`; üçgen sayısı `2n − 2 − h` (h = `convexHull(points).length`, eşdoğrusal zarf noktaları hariç; kitap formülü); alanlar toplamı = zarf alanı (toleranslı); kenar kümesi tutarlı (her iç kenar tam iki üçgende, zarf kenarları bir).
- `randomPointSet(rng, n, box, minDist)`: reddet-yeniden-üret; testlerde ve oynatıcıda.

### 2.6 Testler (Vitest, node)
- `inCircle`: içeride/dışarıda/üzerinde, CW giriş işaret çevirimi; `circumcenter`.
- `symbolic`: kitabın örnekleriyle `orient` tablosu; `pointInTriangle` sembolik üçgenlerde.
- `mesh`: `split3`/`split4`/`flip` sonrası `checkAdjacency`.
- `delaunay`: kare (eşçember) → 2 üçgen; 4×4 ızgara → 18 üçgen, hepsi `isDelaunay`; 8 nokta çember üzerinde → 6 üçgen; rastgele 200 küme (seed'li, n 3–40) × 3 farklı sıra → `isDelaunay` ve sıralar arasında aynı kenar kümesi (genel konumda); "collinear plus one" → kenar-üstü yolu, geçerli; tüm eşdoğrusal n=5 → 0 üçgen, 4 kenar; tekrar → hata; n=1,2.

## 3. Adım üreteci ve durum modeli

### 3.1 Kaydedici
`delaunay(points, order, record?)` tek uygulama; `delaunaySteps(points, order): Step<DelaunayState>[]` kaydediciyle. Değişmez: son adımın üçgenleri `delaunay()` ile aynı.

### 3.2 Durum modeli
```ts
type DelaunayState = {
  phase: 'init' | 'insert' | 'legalize' | 'cleanup' | 'done';
  p0: number;
  order: number[];                       // p0 hariç ekleme sırası
  inserted: number[];                    // eklenenler (p0 dahil)
  triangles: { v: [number, number, number]; alive: boolean }[];  // sembolik köşeliler dahil; cleanup'tan sonra yalnızca gerçekler
  current?: number;
  located?: { t: [number, number, number]; edge?: [number, number] };
  testing?: { edge: [number, number]; opposite: number; legal: boolean };
  circle?: { center: Pt; radius: number };   // yalnızca dört köşe gerçekse
  flipped?: { from: [number, number]; to: [number, number] };
  stack: [number, number][];              // LegalizeEdge yığını, üst sonda
  flips: number;
};
```
Her adım `structuredClone`. Patch alanları (`located`, `testing`, `circle`, `flipped`) yalnızca o adım için; `current` aynı noktanın adımlarında kalır (ekleme + yasallaştırma), bir sonraki "Insert" ya da cleanup'ta sıfırlanır.

### 3.3 Sözde kod (`pseudocode.ts`)
Kitap §9.3, tek düz liste (~22 satır): *DelaunayTriangulation(P)*: p₀ seçimi, p₋₁/p₋₂ ve başlangıç üçgeni, rastgele permütasyon, `for r ← 1 to n`: konumlandırma, "p_r üçgenin içinde" → üç kenar ekle, "p_r kenarın üstünde" → dört kenar ekle, ilgili kenarlar için LegalizeEdge çağrıları, sembolik köşeleri silme, return. *LegalizeEdge(p_r, p_i p_j, T)*: "if p_i p_j is illegal", komşu üçgen p_i p_j p_k, çevir, iki yeni kenar için LegalizeEdge. Tam metin ve indeksler planda; başlıklar vurgulanmaz.

### 3.4 Adım kuralı
- Init: "p₀ = v5 is the lexicographically highest point; start with the triangle p₀ p₋₁ p₋₂".
- Her p_r: "Insert p_r = v3 (3 of 11)" → "v3 lies inside triangle (v5, v2, p₋₁)" / "v3 lies on edge v5–v2" → "Split into three triangles" / "…four triangles" → yığına kenarlar → her kenar: "Test edge v5–v2 (opposite v7): v7 is inside the circumcircle → illegal" (`circle` dolu, gerçek köşelerde) / "…outside → legal" / "edge v5–p₋₁ with p₋₁: legal by the symbolic rule" → çevirme: "Flip v5–v2 to v3–v7; push v5–v7 and v7–v2".
- Cleanup: "Remove p₋₁ and p₋₂ with all their edges"; done: "Done: 17 triangles, 12 flips".
- Açıklamalarda sembolik köşeler `p₋₁`/`p₋₂`, gerçek noktalar `v1…`.

### 3.5 Hazır örnekler (`presets.ts`, koordinatlar ve `order` planda sabit)
1. "Textbook example" (~9 nokta, kitap Şekil 9.8 benzeri)
2. "Square grid 4×4" (16 nokta; eşçember dörtlüler)
3. "Points on a circle" (8 nokta, tümü eşçember)
4. "Two clusters" (2×6 nokta)
5. "Collinear plus one" (4 eşdoğrusal + 1)
Her biri için beklenen `triangles.length` ve `flips` test edilir.

### 3.6 Testler
Son adım = `delaunay()`; `line` geçerli ve başlık değil; `flipped` yalnızca çevirme adımında ve `flips` sayacı adım adım +1; `testing.legal` ↔ `inCircle` (gerçek köşelerde); `stack` LIFO; `current` kalıcılığı; snapshot bağımsızlığı; preset sayıları; adım sınırı ≤ 600 (presetler + 20 rastgele n=12 + 5 rastgele n=25).

## 4. Oynatıcı modülü (`src/players/delaunayPlayer.ts`)

Oynatıcı altyapısı değişmez. `PlayerModule<DelaunayState, DelaunayInput>`, `DelaunayInput = { points: Pt[]; order: number[] }`.
- `randomInput()`: 12 nokta, canvas içinde %12 kenar boşluğu, çiftler arası ≥ 25; `order` = p₀ hariç rastgele permütasyon.
- `presets`: §3.5. `validate`: birbirine 2 canvas biriminden yakın bir çift varsa "Points must be distinct"; aksi halde null.
- `handles = points`; `moveHandle` noktayı taşır, `order` korunur (p₀ değişimi §2.4 kuralıyla çözülür).
- `canvas` 775×360; `hint`: "Drag the points to change the input; the insertion order stays. Keys: ← → to step, Space to play or pause."
- `render`: sembolik köşeli üçgenler çizilmez; sembolik köşeye giden kenarlar, gerçek köşeden p₋₁ için sol-üste, p₋₂ için sağ-alta (sembolik geometri p₋₁'i batıya, p₋₂'yi doğuya koyar) 30px kesikli ışın; henüz eklenmemiş noktalar içi boş daire, eklenenler dolu; `current` r=7 vurgulu; `located` üçgen dolgu; `testing.edge` 3px (`legal` ise `--del-legal`, değilse `--del-illegal`); `circle` ince kesikli çember; `flipped.to` 3px `--del-flip`; cleanup/done'da gerçek üçgenler hafif dolgu, zarf 2px. Etiketler `v1…`. Renkler `--del-edge`, `--del-current`, `--del-located`, `--del-legal`, `--del-illegal`, `--del-flip`, `--del-circle`, `--del-hull` (açık/koyu aynı).
- `panels(step)`: "Insertion order" (`v3` satırları; `current` `active`, eklenenler `new`), "Flip stack" (`v5–v2`; test edilen `testing`; boş: "Stack is empty"), "Triangles" (gerçek üçgenler `v1 v4 v7`; `located` `active`, bu adımda oluşanlar `new`; boş: "No triangles yet").

Testler (browser): rastgele girdi kuralları; `moveHandle` sıra korur ve p₀ değişince hatasız; `validate`; render saf; çevrel çember adımında kesikli daire; done'da dolgulu üçgen sayısı = `delaunay().triangles.length`; paneller; preset adları.

## 5. Sayfa, API, dokümantasyon, testler ve yayın

- **Registry:** `slug 'delaunay'`, `path '/algorithms/delaunay'`, `name 'Delaunay Triangulation'`, Polygon Triangulation'dan sonra; `summary 'Build the Delaunay triangulation of a point set by random incremental insertion and edge flips.'`; `thumbnail '/images/delaunay_tn.png'`; tek 775×360 canvas.
- **İçerik:** tanım (boş çevrel çember; en küçük açıyı en büyük yapar), yasal kenar ve çevirme, rastgele artımlı algoritma, p₋₁/p₋₂ ve nedenleri, kitap referansı "This page follows chapter 9, *Delaunay Triangulations*, of Computational Geometry: Algorithms and Applications, 3rd ed., by de Berg et al.", DAG'ın anlatımı ve bu sayfada basit tarama kullanıldığı notu, Voronoi ikiliğine bir cümle, etkileşim ipuçları.
- **API** (`src/engine/delaunay.ts`): `delaunay(points)` → `{ triangles, edges, hull }` (girdi `TextPoint[]`/Point/{x,y}/[x,y]; hata "delaunay: points must be distinct" / "delaunay: expected an array of points (item N is not a point)"), `drawTriangulation(points, result, color='black')` (kenarlar 1.5px + dolgu alpha .08), `circumcircle(a, b, c)` → `{ center, radius }` (eşdoğrusal → null). `demo.js`: `var points = Points.createRandom(12); var result = delaunay(points); drawTriangulation(points, result); console.log(result.triangles.length + ' triangle(s), ' + result.edges.length + ' edge(s)');`
- **Dokümantasyon:** `misc_functions` altına `delaunay` (18. öğe; `drawTriangulation` ve `circumcircle` aynı sayfada).
- **Testler:** e2e `delaunay.spec.ts` (sayfa, presetlerin "Done: k triangles, m flips", sürükleme, eşçember preset hatasız, Code demosu), `visual.spec` sayfa, kart 8, docs 18 / "Try it" 12. Mevcut testler değişmez.
- **Dal ve yayın:** sayfa görevi bitince PR + ön izleme; dokümantasyon, README, son inceleme aynı PR'a.

## 6. Kapsam dışı
DAG görselleştirmesi; Voronoi (ayrı spec); tıklamayla nokta ekleme/silme; kalıcı "çevrel çemberleri göster" modu; kısıtlı Delaunay.

## 7. Riskler
| Risk | Önlem |
|---|---|
| Sembolik köşe kuralının yanlış uygulanması (zarfta hatalı kenar) | Doğrulayıcı tüm noktalar için boş çember + üçgen sayısı formülü; rastgele 200 küme × 3 sıra |
| Komşuluk güncellemelerinde hata | Her mesh işleminden sonra `checkAdjacency` (testlerde) |
| Eşçember noktalarda sonsuz çevirme döngüsü | Çember üzerinde → yasal; çevirme sayısı ≤ üst sınır testi |
| Sürükleme p₀'ı değiştirdiğinde sıra tutarsızlığı | §2.4 kuralı + test |
