# WebCgal Modernizasyonu: Tasarım

- **Tarih:** 2026-11-06
- **Durum:** İncelemede
- **Kapsam:** 1. aşama (taşıma + adım adım oynatıcı altyapısı + Netlify yayını)

## 1. Amaç ve bağlam

WebCgal, hesaplamalı geometri algoritmalarını tarayıcıda canlı olarak gösteren bir eğitim sitesidir. Bugünkü sürüm 2016–2017'de yazılmış bir Express + EJS + paper.js (PaperScript) uygulamasıdır. Sunucu dinamik bir iş yapmaz; yalnızca şablonları birleştirir.

**Kullanıcılar ve amaç:**
- **Öğretim:** Bir hesaplamalı geometri dersinde algoritmaların adım adım izlenmesi ve kodla denenmesi.
- **Sandbox:** Ziyaretçilerin hazır fonksiyonlarla kendi geometri kodlarını yazıp çalıştırabilmesi.

**Başarı ölçütleri (1. aşama):**
1. Mevcut 5 algoritma sayfası, playground ve dokümantasyon yeni yapıda çalışır.
2. Eski demo kodları ve playground örnekleri değiştirilmeden yeni runtime'da hatasız çalışır.
3. Convex Hull sayfasında adım adım oynatıcı (ileri/geri/oynat/hız) ve vurgulanan sözde kod vardır.
4. Yeni bir algoritma eklemek; bir geometri dosyası, bir içerik klasörü ve registry'ye bir satırla yapılabilir.
5. Site Netlify'da `webcgal` adıyla yayındadır (`https://webcgal.netlify.app`).
6. `npm test` ve uçtan uca duman testleri geçer.

## 2. Teknoloji kararları

| Konu | Karar | Gerekçe |
|---|---|---|
| Build | Vite | Hızlı, basit, statik çıktı (`dist/`) |
| UI | React + TypeScript | En geniş ekosistem (CodeMirror, MDX); katkı verecek kişilerin bildiği yapı |
| Yönlendirme | React Router | SPA; eski URL'ler korunur |
| İçerik | MDX (`@mdx-js/rollup`) | Açıklama metni Markdown'da, içine React bileşenleri gömülebilir |
| Çizim | paper.js (güncel npm sürümü) | Mevcut kod ve API buna dayanıyor |
| Editör | CodeMirror 6 | Modern, modüler |
| Birim testleri | Vitest | Vite ile uyumlu |
| Uçtan uca testler | Playwright | Sayfa ve canvas duman testleri |
| Stil | Sade CSS (CSS Modules veya tek global CSS), açık/koyu tema | Ek UI kütüphanesi gerekmez |
| Barındırma | Netlify (statik) | Sunucu gerekmez |

**Değerlendirilip seçilmeyenler:**
- **Astro:** İçerik için güçlü, ama tercih SPA yönünde oldu.
- **Next.js:** Sunucu özelliklerine ihtiyaç yok, gereğinden ağır.
- **Svelte:** Ekosistemi ve MDX karşılığı daha zayıf.

**Kaldırılanlar:** Express, EJS, nodemon, pm2, reload, jQuery, w3.css, eski CSS dosyaları, Universal Analytics kodu (2023'ten beri çalışmıyor), `examples_old/`, repoya eklenmiş `node_modules/`.

## 3. Mimari

Proje aynı repoda sıfırdan kurulur. Eski uygulama, taşıma süresince referans olarak `legacy/` klasörüne taşınır ve taşıma tamamlanınca silinir.

```
src/
├── geometry/                 # Saf geometri: paper.js'e ve DOM'a bağımlı değil
│   ├── primitives.ts             # cross, dot, orientation, isLeftTurn, distance…
│   └── algorithms/
│       ├── convexHull.ts             # convexHull() + convexHullSteps()
│       ├── smallestEnclosingDisk.ts
│       ├── monotone.ts               # L-monoton kontrolü
│       └── duality.ts                # dual line, stabber kontrolü
├── engine/                   # paper.js katmanı
│   ├── scene.ts                  # canvas kurulumu, y ekseni ters çevirme, temizleme
│   ├── TextPoint.ts, Polygon.ts, Vector.ts
│   ├── drawing.ts                # drawLines, drawCircle, Points.* yardımcıları…
│   ├── api.ts                    # kullanıcı koduna açılan API'nin tek listesi
│   └── runtime.ts                # PaperScript derle + çalıştır + çıktı yakala
├── components/
│   ├── GeometryCanvas.tsx
│   ├── CodeEditor.tsx            # CodeMirror 6
│   ├── OutputPanel.tsx
│   ├── StepPlayer.tsx
│   ├── PseudocodePanel.tsx
│   └── ErrorBoundary.tsx
├── content/
│   ├── algorithms/<slug>/
│   │   ├── index.mdx                 # açıklama metni
│   │   ├── demo.js                   # sayfadaki varsayılan PaperScript kodu
│   │   └── pseudocode.ts             # (oynatıcısı olanlarda) sözde kod satırları
│   ├── docs/<item>.mdx               # API dokümantasyonu
│   └── playground/*.js               # hazır örnek kodlar
├── pages/                    # Home, AlgorithmsIndex, AlgorithmPage, Docs, DocItem, Playground, NotFound
├── registry.ts               # algoritmaların listesi (slug, ad, grup, görsel, açıklama, içerik/oynatıcı bağlantıları)
└── main.tsx, App.tsx         # router
public/
├── images/                   # mevcut küçük görseller, logo, favicon
└── _redirects                # Netlify SPA kuralı (netlify.toml ile birlikte)
tests/e2e/                    # Playwright testleri
netlify.toml
```

### 3.1 Katman sorumlulukları

- **`geometry/`:** Girdi olarak düz `{x, y}` nesneleri alır, sonuç döndürür. Çizim veya DOM kodu içermez. Adım üreten sürümler (`*Steps`) her adım için bir snapshot döndürür (bkz. §5). Tüm birim testleri bu katmanı hedefler.
- **`engine/`:** paper.js ile çizim ve etkileşim (nokta sürükleme vb.). Kullanıcıya açılan API (`Points`, `TextPoint`, `Polygon`, `Vector`, `drawLines`, `convexHull`…) burada tanımlanır ve `api.ts` dosyasında tek bir listede toplanır. Kütüphane kodu PaperScript operatörleri yerine paper.js metotlarını kullanır (`a.add(b)`, `a.multiply(k)`).
- **`components/`:** React bileşenleri. paper.js kapsamı (`PaperScope`) her canvas için ayrı oluşturulur ve bileşen kaldırılınca temizlenir.
- **`content/`:** Ders metni, demo kodu ve sözde kod. Kod içermeyen değişiklikler (metin düzeltmeleri) yalnızca bu klasörde yapılır.

### 3.2 Yönlendirme ve URL'ler

| URL | Sayfa |
|---|---|
| `/` | Ana sayfa |
| `/algorithms` | Algoritma listesi |
| `/algorithms/:slug` | Algoritma sayfası (`convexHull`, `smallestEnclosingDisk`, `L-monoton`) |
| `/algorithms/duality` | Duality grup sayfası |
| `/algorithms/duality/:slug` | `dualLine`, `checkStabber` |
| `/documentation`, `/documentation/:item` | Dokümantasyon |
| `/playground` | Playground |
| `/duality`, `/smallestEnclosingDisk` | `netlify.toml` içinde 301 ile `/algorithms/...` adresine |
| diğer | 404 sayfası |

Eski URL'ler ve slug'lar (büyük/küçük harfler dahil) aynen korunur.

### 3.3 Registry

```ts
type AlgorithmEntry = {
  slug: string;              // "convexHull"
  path: string;              // "/algorithms/convexHull"
  name: string;              // "Convex Hull"
  group?: "duality";
  thumbnail: string;         // "/images/convexHull_tn.png"
  summary: string;
  content: () => Promise<MDXModule>;    // lazy import
  demoCode: () => Promise<string>;      // ?raw import
  player?: () => Promise<PlayerModule>; // yalnızca oynatıcısı olanlarda
};
```

Algoritma listesi, menü ve yönlendirme bu tek listeden üretilir. Bugünkü `linkData.json` dosyasının yerini alır.

## 4. Kod çalıştırma (runtime) ve editör

**Akış:**
1. Algoritma sayfası veya playground açıldığında `demoCode` editöre yüklenir ve bir kez otomatik çalıştırılır.
2. Kullanıcı **Çalıştır** butonuna (veya Ctrl/Cmd+Enter'a) bastığında `runtime.run(code, scope)` çağrılır:
   1. Sahne temizlenir (çizimler, olay dinleyicileri, `drawables`, `TextPoint` sayacı).
   2. Kod `paper.PaperScript.compile` ile derlenir; böylece `p1 + p2` ve `pos += delta * [1, -1]` gibi operatörler çalışır.
   3. Derlenen kod, `api.ts` içindeki tüm adların ve paper.js nesnelerinin (`Point`, `Path`, `view`, `project`…) parametre olarak verildiği bir fonksiyon içinde çalıştırılır. Kullanıcı `import` yazmaz.
   4. Kullanıcı kodundaki `console.log`, `console.warn` ve `console.error` çağrıları, çalışma süresince **çıktı paneline** yönlendirilir.
3. **Sıfırla** butonu editörü `demoCode` içeriğine geri döndürür.
4. Playground'da editör içeriği `localStorage` içinde saklanır. Erişim `try/catch` ile korunur; depolama kullanılamazsa sessizce atlanır.

**Uyumluluk:** Eski API adları korunur: `Points.createRandom`, `Points.sortX`, `Points.drawLines`, `TextPoint`, `Polygon`, `Vector`, `convexHull`, `smallestEnclosingDisk`, `crossProduct`, `dotProduct`, `Array.prototype.delete` ve dokümantasyondaki diğer öğeler. `Array.prototype.delete` eski kodlar için korunur ama yeni kodda önerilmez. Bu yama yalnızca runtime ilk yüklendiğinde bir kez uygulanır.

**Bilinen sınırlar (1. aşamada çözülmeyecek):**
- Sonsuz döngüye giren bir kod sekmeyi dondurur. paper.js DOM'daki canvas'a ihtiyaç duyduğu için kodu ayrı bir worker'da çalıştırmak pratik değil. İleride derlenen koda döngü sayacı eklenebilir.
- Kod yalnızca kullanıcının kendi tarayıcısında, kendi yazdığı haliyle çalışır. URL ile kod paylaşımı eklenirse güvenlik ayrıca ele alınacaktır.

## 5. Adım adım oynatıcı

İlk aşamada yalnızca **Convex Hull** için uygulanır. Diğer 4 algoritmaya aynı altyapıyla sonraki aşamalarda eklenecektir.

### 5.1 Veri modeli

```ts
type Step<S> = {
  description: string; // "p5, p6, p7 sağa dönüş yapıyor, p6 siliniyor"
  line: number;        // sözde kodda vurgulanacak satır (0 tabanlı)
  state: S;            // o adımdaki tam durum (snapshot)
};

// Convex Hull'a özel durum
type HullState = {
  sorted: Pt[];
  upper: Pt[];
  lower: Pt[];
  current?: Pt;
  testing?: [Pt, Pt, Pt];
  removed?: Pt;
  phase: "sort" | "upper" | "lower" | "done";
};

function convexHullSteps(points: Pt[]): Step<HullState>[];
```

- Tüm adımlar bir kerede hesaplanır. Her adım kendi tam durumunu taşıdığı için çizim durumsuzdur: k. adıma geçmek yalnızca o adımın `state` alanını yeniden çizmek demektir. Bu sayede geri gitmek de kolaydır.
- **Değişmez:** Son adımdaki zarf `convexHull(points)` sonucuna eşittir. Birim testleri bunu doğrular.

### 5.2 Oynatıcı modülü

Her oynatıcılı algoritma bir `PlayerModule` sağlar:

```ts
type PlayerModule<S> = {
  computeSteps(points: Pt[]): Step<S>[];
  render(scene: Scene, step: Step<S>, points: Pt[]): void; // engine/ üzerinden çizer
  pseudocode: string[];
  initialPoints(): Pt[];   // örn. 10 rastgele nokta
};
```

`<StepPlayer>` genel bir bileşendir ve algoritmaya özel hiçbir şey bilmez.

### 5.3 Arayüz

- **Kontroller:** ⏮ başa dön, ◀ önceki, ▶/⏸ oynat/duraklat, ▶ sonraki, ⏭ sona git; hız slider'ı; "Adım k / n" göstergesi.
- **Klavye:** ← / → ile önceki/sonraki adım, Space ile oynat/duraklat. Kısayollar, editörde yazı yazılırken devre dışı kalır.
- **Açıklama:** O anki adımın `description` metni canvas'ın altında gösterilir.
- **Sözde kod paneli:** Sağda yer alır; o anki adımın `line` satırı vurgulanır.
- **Renkler:** İşlenen nokta, test edilen üçlü, üst zarf, alt zarf ve silinen nokta farklı renklerle gösterilir. Renkler açık ve koyu temada okunur kalır.
- **Etkileşim:** Kullanıcı bir noktayı sürüklediğinde veya "Yeni rastgele noktalar" butonuna bastığında adımlar yeniden hesaplanır ve oynatıcı başa döner.
- **Sekmeler:** Algoritma sayfasında "Adım adım" (oynatıcı + sözde kod) ve "Kod" (editör + çıktı) sekmeleri bulunur. Oynatıcısı olmayan algoritmalarda yalnızca "Kod" görünür.

## 6. Sayfalar ve içerik

- **Ana sayfa:** Arka planda canlı bir Convex Hull demosu ve kısa bir tanıtım; algoritmalara, dokümantasyona ve playground'a giden kartlar.
- **Algoritmalar:** Registry'den üretilen kartlar; Duality alt sayfaları kendi başlığı altında gruplanır.
- **Algoritma sayfası:** MDX açıklama metni (kaynak kitap, bölüm referansları korunur) ve §5.3'teki sekmeler.
- **Dokümantasyon:** `documentationData.json` içindeki öğeler `content/docs/*.mdx` dosyalarına çevrilir. Kategoriler (objects, drawing, points, polygon, misc) sol menüde gösterilir. Her öğede "Kodu dene" ile playground'da açılabilen bir örnek bulunur. Eski `link_to(...)` sözdizimi, normal Markdown linklerine dönüştürülür.
- **Playground:** Editör, canvas ve çıktı paneli; mevcut 3 örnek kod hazır şablon olarak sunulur.
- **404 sayfası.**
- **Dil:** İçerik İngilizce kalır. Türkçe 1. aşamanın kapsamında değil.
- **Duyarlı tasarım:** Canvas kapsayıcının genişliğine göre ölçeklenir (koordinat sistemi sabit kalır); dar ekranlarda paneller alt alta dizilir.

## 7. Hata yönetimi

- Kullanıcı kodunda derleme veya çalışma hatası olursa mesaj, mümkünse satır numarasıyla birlikte çıktı panelinde kırmızı olarak gösterilir. Sahne o ana kadar çizilen haliyle kalır ve sayfa çalışmaya devam eder.
- Her sayfanın ana bölümü bir `ErrorBoundary` ile sarılır. Bileşen hatasında yalnızca o bölüm bir hata mesajı ve "yeniden yükle" butonu gösterir.
- Bilinmeyen bir slug için 404 sayfası gösterilir.

## 8. Test stratejisi

**Birim testleri (Vitest, `geometry/`):**
- `primitives`: dönüş yönü, cross ve dot çarpımı.
- `convexHull`:
  - kare, üçgen, doğrusal noktalar, tekrarlanan noktalar, 0/1/2 noktalı uç durumlar;
  - rastgele noktalarda tüm noktaların zarfın içinde veya üzerinde olması;
  - zarfın konveks olması.
- `convexHullSteps`: son durumun `convexHull` sonucuna eşit olması; her adımda `line` değerinin sözde kod sınırları içinde kalması.
- `smallestEnclosingDisk`: tüm noktaların daire içinde olması; bilinen örneklerde yarıçapın doğru çıkması.
- `monotone` ve `duality`: eski sayfalardaki davranışı yakalayan örnek tabanlı testler.

**Uçtan uca testler (Playwright):**
- Her rota açılır, canvas'ta çizim olur ve konsolda hata görünmez.
- Her algoritmanın demo kodu ve 3 playground örneği yeni runtime'da hatasız çalışır. Bu, uyumluluk ölçütünün (§1, madde 2) kanıtıdır.
- Convex Hull oynatıcısı: ileri/geri düğmeleri adım sayacını değiştirir, sona gidince zarf çizilmiş olur.
- Hatalı bir kod çalıştırıldığında çıktı panelinde hata mesajı görünür ve sayfa çalışmaya devam eder.
- `/duality` adresi yönlendirilir ve bilinmeyen bir adres 404 sayfasını gösterir. Bu kontrol, Netlify yönlendirmeleri yerelde çalışmadığı için yayın sonrasında yapılır.

## 9. Yayın

`netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"

[[redirects]]
  from = "/duality"
  to = "/algorithms/duality"
  status = 301

[[redirects]]
  from = "/smallestEnclosingDisk"
  to = "/algorithms/smallestEnclosingDisk"
  status = 301

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- Netlify'da `webcgal` adıyla yeni bir site oluşturulur (`https://webcgal.netlify.app`). Ad alınmışsa kullanıcıya alternatif sorulur.
- İlk yayın, yerelde alınan `dist/` build'inin yüklenmesiyle yapılır. GitHub reposu siteye bağlanırsa `master` dalına yapılan her push otomatik yayın tetikler; bu bağlantıyı kullanıcı Netlify arayüzünden kurabilir.
- `webcgal.org` alan adı istenirse sonradan özel alan adı olarak bağlanabilir. 1. aşamanın kapsamında değil.

## 10. Kapsam dışı (sonraki aşamalar)

- Smallest Enclosing Disk, L-monoton, Dual Line ve Check Stabber için adım adım oynatıcı
- Yeni algoritmalar (ör. çizgi parçası kesişimi, üçgenleme, Voronoi/Delaunay)
- URL ile kod paylaşımı
- Sonsuz döngü koruması
- Türkçe içerik
- Analytics
- Arama motorları için sayfaların önceden render edilmesi (prerender)

## 11. Riskler

| Risk | Önlem |
|---|---|
| Güncel paper.js ile eski kodlar arasında davranış farkı | Uçtan uca testlerde tüm eski demo ve örnek kodlar çalıştırılır; farklar `engine/` içinde uyumluluk katmanıyla giderilir |
| Uzun eski sayfalar (Dual Line, Check Stabber, L-monoton ~300 satır) taşınırken mantık kaybı | Önce eski davranış birim testleriyle yakalanır, sonra kod taşınır |
| SPA yapısında arama motoru görünürlüğünün zayıf olması | Kabul edildi; gerekirse prerender eklenecek (§10) |
| `webcgal` adının Netlify'da alınmış olması | Yayın anında kontrol edilir, kullanıcıya alternatif sorulur |
