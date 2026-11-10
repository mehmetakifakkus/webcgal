# En Küçük Kapsayan Disk (MiniDisc) Adım Oynatıcısı: Tasarım

- **Tarih:** 2026-11-10
- **Durum:** İncelemede
- **Önceki spec'ler:** `2026-11-07-delaunay-design.md` (`{ points, order }` girdisi, sıra normalizasyonu, oynatıcı kalıbı), `2026-11-06-triangulation-design.md` (paneller), `2026-11-07-voronoi-design.md` (alt yol / GitHub Pages)
- **Kapsam:** Mevcut `/algorithms/smallestEnclosingDisk` sayfasına adım oynatıcısı ve tam içerik; eski algoritmanın kitaba bire bir uyarlanması.

## 1. Amaç ve bağlam

de Berg et al. §4.7'nin (*Smallest Enclosing Discs*) rastgele artımlı algoritması üç iç içe prosedürüyle (MiniDisc, MiniDiscWithPoint, MiniDiscWith2Points) adım adım gösterilecek. Sayfa bugün tek cümlelik bir MDX ve bir kod demosundan ibaret; `src/geometry/algorithms/smallestEnclosingDisk.ts` alt çağrılarda noktaları yeniden karıştırıyor (kitapta tek permütasyon tüm seviyelerde kullanılır).

**Kullanıcı kararları:**
- Tam özyineleme gösterilir: her nokta testi, her çağrı ve dönüş ayrı adım; "Call stack" paneli.
- Girdi `{ points, order }`: tek rastgele permütasyon, üç prosedür de aynı sırayı izler; sürüklemede sıra korunur.

**Varsayımlar:**
- Tek mod. Yinelenen noktalara izin verilir (algoritma doğru çalışır; uyarı yok).
- Yeni API fonksiyonu yok; `miniDisc` / `smallestEnclosingDisk` aynı sonucu verir (en küçük disk tektir).

**Başarı ölçütleri:**
1. Rastgele ve dejenere girdilerde sonuç `isMinimalDisk` ile doğrulanır ve küçük n'de O(n⁴) kaba kuvvetle aynı diski verir.
2. Presetlerde sabitlenmiş disk, test ve güncelleme sayıları tutar.
3. 25 rastgele noktada adım sayısı ≤ 600 (20 seed).
4. Mevcut testler değişmeden geçer (sayım ve sayfa beklentileri hariç).

## 2. Geometri modülü (`src/geometry/algorithms/minidisc/`)

### 2.1 Çekirdek (`minidisc.ts`)
- `minidisc(points: Pt[], order?: number[], record?: MdRecorder): MiniDiscResult`, `MiniDiscResult = { disk: Circle | null; boundary: number[]; tests: number; updates: number }`.
  - `MiniDisc(P)`: D₂ = p₁p₂ çaplı disk; i = 3..n için pᵢ ∉ Dᵢ₋₁ ise Dᵢ = `MiniDiscWithPoint({p₁…pᵢ₋₁}, pᵢ)`.
  - `MiniDiscWithPoint(P, q)`: D₁ = q p₁ çaplı disk; j = 2..|P| için pⱼ ∉ Dⱼ₋₁ ise Dⱼ = `MiniDiscWith2Points({p₁…pⱼ₋₁}, pⱼ, q)`.
  - `MiniDiscWith2Points(P, q₁, q₂)`: D₀ = q₁q₂ çaplı disk; k = 1..|P| için pₖ ∉ Dₖ₋₁ ise Dₖ = q₁, q₂, pₖ'dan geçen çember.
  - Üç prosedür de `order`'ın ön eklerini kullanır (alt çağrıda yeniden karıştırma yok).
  - `tests` = toplam "nokta diskte mi?" testi; `updates` = disk değişikliği sayısı (başlangıç diskleri hariç, iç çağrıdan dönen ve satır 20'deki yeni diskler dahil); `boundary` = son diski belirleyen 2 veya 3 nokta indeksi.
- **İçerde testi:** `distance(c, p) ≤ r · (1 + 1e-9) + 1e-9`.
- **Eşdoğrusal q₁, q₂, r:** kitap bu durumun oluşmadığını kanıtlar; güvenlik için mevcut "en uzak çiftin çap diski" yedeği korunur.
- **Sıra normalizasyonu:** Delaunay ile aynı kural (geçersiz ve tekrarlanan indeksler atılır, eksikler artan sırayla sona eklenir). `defaultOrder(n, seed = n)`: mulberry32 permütasyonu (`delaunay.ts`'teki `mulberry32` yeniden kullanılır).
- **Dejenere:** n = 0 → `disk: null`; n = 1 → yarıçap 0, `boundary: [0]`; yinelenen noktalar serbest.
- `src/geometry/algorithms/smallestEnclosingDisk.ts`: `smallestEnclosingDisk(points, random)` tek permütasyon çekip `minidisc` çağıran ince sarmalayıcı olur (n = 0'da eski `{center:(0,0), radius:0}` davranışı korunur). `circleFrom2`, `circumcircle` yerinde kalır; mevcut testleri değişmez.

### 2.2 Doğrulayıcı (`verify.ts`)
- `isMinimalDisk(points, disk): { ok: boolean; reason?: string }`: tüm noktalar içeride; sınırdaki noktalar (|d − r| ≤ 1e-7 · max(1, r)) ya çap oluşturan bir çift içerir ya da merkez, sınırdaki üç noktanın üçgeninin içindedir (kapalı). Mesajlar "outside", "not minimal".
- `bruteForceDisk(points): Circle` — tüm çiftler ve üçlülerden içeren en küçük disk (yalnızca testlerde, n ≤ 12).

### 2.3 Testler (node)
`minidisc.test.ts`: iki nokta, dar üçgen (3 sınır), geniş açılı üçgen (2 sınır), eşdoğrusal 5 nokta, yinelenen noktalar, n = 0/1; rastgele 200 küme × 3 sıra → `isMinimalDisk` ve sıralar arası aynı disk; 100 küçük küme kaba kuvvetle eşit; `smallestEnclosingDisk` sarmalayıcısı aynı diski verir; sıra normalizasyonu.

## 3. Adımlar ve durum

### 3.1 Sözde kod (`pseudocode.ts`, 22 satır, başlıklar `[0, 8, 15]`)
```
0  MiniDisc(P)
1      Compute a random permutation p_1, …, p_n of P
2      Let D_2 be the smallest enclosing disc for {p_1, p_2}
3      for i ← 3 to n
4          if p_i ∈ D_{i−1}
5              then D_i ← D_{i−1}
6              else D_i ← MiniDiscWithPoint({p_1, …, p_{i−1}}, p_i)
7      return D_n
8  MiniDiscWithPoint(P, q)
9      Let D_1 be the smallest disc with q and p_1 on its boundary
10     for j ← 2 to n
11         if p_j ∈ D_{j−1}
12             then D_j ← D_{j−1}
13             else D_j ← MiniDiscWith2Points({p_1, …, p_{j−1}}, p_j, q)
14     return D_n
15 MiniDiscWith2Points(P, q_1, q_2)
16     Let D_0 be the smallest disc with q_1 and q_2 on its boundary
17     for k ← 1 to n
18         if p_k ∈ D_{k−1}
19             then D_k ← D_{k−1}
20             else D_k ← the disc with q_1, q_2 and p_k on its boundary
21     return D_n
```

### 3.2 Durum modeli (`miniDiscState.ts`)
```ts
type Frame = {
  proc: 'MiniDisc' | 'WithPoint' | 'With2Points';
  fixed: number[];        // [] | [q] | [q1, q2] (q2 = yeni nokta, q1 = dış çağrının q'su)
  prefix: number;         // bu çağrının P'si: order[0..prefix)
  index: number;          // döngüde sıradaki konum (order indeksi)
  disk: Circle;
};
type MiniDiscState = {
  phase: 'init' | 'run' | 'done';
  order: number[];
  stack: Frame[];          // dış → iç
  disk: Circle | null;     // en içteki çağrının diski
  current?: number;
  testing?: { point: number; inside: boolean };
  newDisk?: Circle;
  returned?: Circle;
  tests: number;
  updates: number;
};
```
Her adım `structuredClone`; `current`, `testing`, `newDisk`, `returned` tek adımlıktır.

### 3.3 Kayıt satırları
| Satır | Açıklama |
|---|---|
| 1 | "Order: v4, v9, v1, …" |
| 2 / 9 / 16 | "D₂: smallest disc of v4 and v9" / "D₁: smallest disc with v7 and v4 on its boundary" / "D₀: smallest disc with v3 and v7 on its boundary" |
| 4 / 11 / 18 | "v6 is inside D → keep D" / "v6 is outside D → it must lie on the boundary of the new disc" |
| 6 / 13 | "Call MiniDiscWithPoint with q = v6" / "Call MiniDiscWith2Points with q₁ = v6, q₂ = v2" |
| 20 | "D: disc through v6, v2 and v8" (`newDisk`) |
| 14 / 21 | "Return D (r = 118.2) to MiniDisc" / "… to MiniDiscWithPoint" (`returned`) |
| 7 | "Done: smallest disc through v2, v5 and v7 (r = 128.4), 31 tests, 6 updates" (iki sınır noktasında "through v2 and v5", tek noktada "through v1") |

Yarıçap bir ondalıkla; etiketler `v1…`. Çağrıdan sonraki ilk adım iç prosedürün başlangıç diski (9 veya 16).

### 3.4 Adım üreteci ve presetler
- `miniDiscSteps(points, order): Step<MiniDiscState>[]`; n ≤ 1 → satır 1 ve 7.
- `MINIDISC_PRESETS: { name; points; order; expected: { boundary: number; radius: number; tests: number; updates: number } }[]` (koordinatlar spec'te sabit, `expected` uygulamada hesaplanıp sabitlenir):
  1. "Random example": (239,209),(297,115),(347,245),(398,166),(448,94),(484,216),(535,151),(326,173),(434,245),(383,108); order `defaultOrder(10, 10)`.
  2. "Two far points": (234,180),(540,180),(332,161),(429,206),(384,174),(462,154); order [2,3,4,5,0,1] (uç noktalar en sonda → her ikisi de dışarıda düşer).
  3. "Acute triangle": (260,250),(510,240),(390,40),(380,160),(330,190),(440,180); order `defaultOrder(6, 6)`.
  4. "Points on a circle": 8 nokta `(387 + 140cos(kπ/4), 180 + 140sin(kπ/4))`; order `defaultOrder(8, 8)`.
  5. "Bad order": 10 nokta `(387 + rₖcos(2.4k), 180 + rₖsin(2.4k))`, rₖ = 15 + 14k; order [0..9] (merkezden dışa → neredeyse her nokta dışarıda).
  6. "Collinear": (228,180),(293,180),(390,180),(468,180),(546,180); order [2,1,3,0,4].
- Her presetin son diski canvas'a sığar: r ≤ 165, merkez ± r 775×360 içinde, kenar payı ≥ 10 (Random example, Two far points ve Collinear 1–3. görevde bu koşulu sağlamıyordu; ölçeklenip (387, 180) merkezine taşındı, Acute triangle 40 birim aşağı kaydırıldı; sıralar ve sınır sayıları aynı).
- Testler: `last step matches minidisc` (presetler + 30 rastgele); satırlar geçerli ve başlık değil; `testing` yalnızca 4/11/18'de; `newDisk` yalnızca 20'de; `returned` yalnızca 14/21'de; yığın derinliği çağrı adımında +1, dönüşte −1; anlık görüntüler bağımsız; preset sayıları; 25 rastgele nokta ≤ 600 adım (20 seed).

## 4. Oynatıcı modülü (`src/players/miniDiscPlayer.ts`)

`PlayerModule<MiniDiscState, MiniDiscInput>`, `MiniDiscInput = { points: Pt[]; order: number[] }` (`types.ts`).
- `randomInput()`: `randomPointSet(Math.random, 12, {x0: 93, y0: 43, x1: 682, y1: 317}, 25)`, `order = defaultOrder(12, Math.floor(Math.random()*1e9))`. `validate` yok. `handles = points`; `moveHandle` noktayı taşır, `order` korunur. `canvas` 775×360.
- `hint`: "Drag the points to change the input; the order stays. Keys: ← → to step, Space to play or pause."
- **Render** (`scene.clear()` her çağrıda): en içteki çağrının ön ekindeki test edilmiş noktalar dolu, diğerleri içi boş; `current` r = 7; sabit sınır noktaları (en içteki çerçevenin `fixed`'i) `--md-fixed` halka; dış çerçevelerin diskleri ince kesikli `--md-outer`; güncel disk 2px `--md-disk`, hafif dolgu; `testing` noktası içerideyse `--md-inside`, dışarıdaysa `--md-outside`; `newDisk` 3px `--md-new`; `returned` 3px `--md-new` kesikli; done'da son disk 3px, `boundary` noktaları halkalı. Etiketler `v1…`.
- **Paneller:** "Call stack" (`MiniDisc · i = 7 of 12`, `MiniDiscWithPoint(q = v7) · j = 3 of 6`, `MiniDiscWith2Points(q₁ = v7, q₂ = v3) · k = 1 of 2`; en içteki `active`; boş "Not started"), "Order" (permütasyon sırasıyla `v4` satırları; `current` `active`; en içteki çerçevenin sabit noktaları `new`; diğerleri vurgusuz), "Disc" (`centre (387.0, 180.0)`, `radius 140.0`, `defined by v2, v5, v7`, `tests 31 · updates 6`; boş "No disc yet").
- **Renkler** (`theme.css`, açık/koyu aynı): `--md-disk #1a5fb4`, `--md-outer #9aa0a6`, `--md-fixed #9141ac`, `--md-inside #26a269`, `--md-outside #c01c28`, `--md-new #e66100`.
- **Testler (browser):** rastgele girdi kuralları; render saf; test adımında nokta rengi sonuca uyar; çağrı içindeki adımda kesikli dış çember sayısı = `stack.length − 1`; done diski `minidisc().disk` ile aynı; `moveHandle` sırayı korur; paneller faz faz; altı preset adı.

## 5. Sayfa, testler ve yayın

- **Registry:** `smallestEnclosingDisk` girdisine `player`; canvas 775×360; `summary 'Find the smallest disc containing a point set by randomized incremental construction, step by step.'`; küçük görsel yeniden üretilir (`thumbnail:smallestEnclosingDisk`, preset "Random example", son adım). Yol ve eski `/smallestEnclosingDisk` yönlendirmesi değişmez.
- **İçerik (MDX):** problem ve tekliği; artımlı fikir (yeni nokta dışarıdaysa yeni diskin sınırındadır, Lemma 4.14); üç prosedürün nedeni (sabit sınır noktaları); rastgele sıranın beklenen O(n) süresi ve "Bad order" karşı örneği; kitap cümlesi "This page follows section 4.7, *Smallest Enclosing Discs*, of Computational Geometry: Algorithms and Applications, 3rd ed., by de Berg et al."; etkileşim ipuçları; mevcut Wikipedia bağlantısı korunur.
- **API:** değişmez; `demo.js` aynen kalır (canvas boyutu registry'den gelir).
- **Testler:** e2e `smallestEnclosingDisk.spec.ts` (sayfa "Call stack" paneliyle Step sekmesinde açılır; her preset `expected`'tan üretilen done metnine ulaşır; sürükleme oynatıcıyı yeniden başlatır; Code demosu çalışır); `visual.spec` sayfa; mevcut eski URL yönlendirme testi geçer.
- **e2e alt yol desteği:** `BASE_URL` bir alt yol içerdiğinde (`https://…/webcgal/`) testlerdeki `/…` yolları bu alt yola göre çözülür (Playwright `baseURL` sonunda `/`, testlerde yardımcı ya da göreli yollar); kök adreste davranış değişmez.
- **Yayın:** PR birleşince GitHub Pages otomatik yayınlar; canlı sitede smoke + yeni e2e çalıştırılır. Sayfa görevi bitince ekran görüntüleri yerel `/webcgal/` derlemesinden alınır.

## 6. Kapsam dışı
Ayrı "Shuffle order" düğmesi (oynatıcı altyapısı değişir); 3B veya ağırlıklı en küçük disk; LP-tipi genelleme; yeni API fonksiyonu.

## 7. Riskler
| Risk | Önlem |
|---|---|
| Sınır noktası tolerans hatası (döngüde gereksiz güncelleme) | Ölçeğe göreli içerde testi; çember preseti; kaba kuvvet karşılaştırması |
| Çağrı yığını kayıtlarının tutarsızlığı | Yığın derinliği testleri; çağrı/dönüş eşleşmesi |
| Eski API davranışının değişmesi | Mevcut `smallestEnclosingDisk` testleri değişmeden geçer; sarmalayıcı testi |
| Canvas boyut değişikliğinin kod demosunu bozması | Code sekmesi e2e testi |
