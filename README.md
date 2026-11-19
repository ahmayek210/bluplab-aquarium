# BlupLab — Little Aquarium

BlupLab, hatıraların elle çizilmiş balıklara dönüştüğü, Türkçe bir tarayıcı akvaryumu. Yatay telefon ekranında açılır. Masaüstünde, tablette ve dikey yerleşimde de kullanılabilir.

## Oyna

- Bir balığa dokunarak hatırasını aç. Balıkları klavyeyle incelemek için **Hatıralar** menüsünü kullan.
- **Yem Ver** veya **Oyna** aracını seçip suya dokun. Meraklı balıklar yavaş hareket eden bir parmağı veya işaretçiyi kısa süre izleyebilir.
- **Yeni Balık** ile tür, renk, desen ve kişilik seç. Yeni hatıraları paylaşmak için **Ek bilgiler** altındaki görünürlüğü değiştir.
- Devam eden bir hatırada en çok 24 durak tanımla ve gerçekleşenleri elle onayla. Birinci ve üçüncü onay görünümü değiştirir ve akvaryum süsü açar. Tek seferlik hatıralar tarihlerinden itibaren yalnızca kozmetik olarak değişir.
- **Süsle** ile bir süs seçip suya bırak veya yerleştirilmiş bir süsü sürükle. Klavyeyle konumu ayarlamak için okları kullan. Düzeni **Kaydet** ile uygula.
- **Ayarlar** üzerinden sesleri açabilir, hareketi azaltabilir veya JSON yedeği alabilirsin. Altı başlangıç hatırası düzenlenebilir örneklerdir.

## Cihazlar arası kullan

**Ayarlar → Cihazlar arası kaydı aç** mevcut tarayıcı akvaryumunu korumalı bir çevrimiçi akvaryuma kopyalar. **Sahip bağlantısını kopyala** ile aldığın bağlantıyı güvenli bir yerde sakla. Yeni cihazda bu bağlantıyı açabilirsin. Hesap veya e-posta kaydı gerekmez ve kaybolan sahip bağlantısı için kurtarma mekanizması bulunmaz.

Ziyaretçi bağlantısıyla yalnızca paylaşılmış hatıralar okunabilir. Ziyaretçiler besleyebilir ve kabarcık yapabilir. Yeni bir ziyaretçi bağlantısı üretmek önceki ziyaretçi bağlantısını iptal eder. Sahip çevrimdışıyken çevrimiçi düzenlemeler için bağlantının yeniden kurulması gerekir. Bağımsız yerel akvaryum tarayıcıda çalışmaya devam eder.

## Yerel geliştirme

Node.js 24 ve npm gerekir.

```sh
npm ci
npm run dev
npm run test:unit
npm run build
```

Playwright ile üretim derlemesini sınamak için Chromium kur:

```sh
npx playwright install chromium
npm test
```

Test yapılandırması derlemeyi `/bluplab-aquarium/` altında sunar. `PLAYWRIGHT_BASE_URL` verilirse aynı testler belirtilen yayını açar. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` ile kurulu bir Chromium yolu seçilebilir. Simülasyon sayaçları ile bütünleşik tarayıcı testi için yerel derlemede `VITE_TEST_HOOK=1` kullan. Yayın derlemesinde kanca bulunmaz. Çevrimiçi test ayrı, rastgele yetki anahtarlı bir akvaryum kullanır.

iPhone yerleşimini WebKit’te sınamak için `npx playwright install webkit` çalıştır ve `PLAYWRIGHT_WEBKIT=1` ile `npm test` komutunu kullan.

## Mimari

- **Oyun** — Canvas 2D motoru, zaman adımlı hareket, seyrek çalışan davranış kararları ve komşuluk ızgarası. Balıklar yemi paylaşımlı hedef olarak kapmaz. Her parçayı bir balık sahiplenir. Bitkiler, kabarcıklar ve özel animasyonların efektleri sınırlı sayıda çizilir.
- **Arayüz** — Türkçe, klavye erişimli HTML kontrolleri. Akvaryum, hatıra ve ayar panelleri açıkken çalışır. Yatay ekran, çentikli cihazların güvenli alanları ve tarayıcı izin verdiğinde tam ekran desteklenir.
- **Sanat** — 10 balık, 10 hareketli veya sabit dekor, üç bölümde çizilmiş su altı sahnesi. Bir yüzgeç döngüsü için kesilmiş şeffaf ImageGen çiziminden sekiz kare önbelleğe alınır. Dönüş, hızlanma, göz kırpma, baloncuk ve büyüme efektleri çizim motorunda birleşir. WebP dosyaları `public/art/` altındadır. [Üretim notları](ARTWORK.md)
- **Kayıt** — Sürüm doğrulamalı tarayıcı kaydı veya ayrı Neon Function. Postgres, izin özeti ve revizyonla birlikte akvaryum belgesini saklar. TypeScript doğrulaması her yazmayı denetler. Revizyon karşılaştırması, iki cihazın birbirinin verisini sessizce ezmesini önler. Balıklar, durumlar, hatıralar, duraklar, konumlar ve akvaryum etkinlikleri aynı revizyonda atomik kaydedilir.
- **Çevrimdışı** — Servis çalışanı statik oyun dosyalarını önbelleğe alır. Özel API yanıtları önbelleğe alınmaz. Ses varsayılan olarak kapalıdır ve tarayıcıda üretilir.

## Yayınla

GitHub Pages için `main` dalındaki [GitHub Actions iş akışı](.github/workflows/pages.yml) kullanılır. Pages kaynağı **GitHub Actions** olmalıdır. Başka depo adı kullanılırsa iş akışındaki `VITE_BASE_PATH` değerini değiştir. API URL’si, gizli olmayan depo değişkeni `VITE_AQUARIUM_API` ile verilir.

1. Neon projesini, Postgres veritabanını ve Node.js 24 Functions desteği olan bir bölgeyi seç. [Neon Functions](https://neon.com/docs/compute/functions/overview)
2. [İlk SQL şemasını](backend/migrations/001_aquariums.sql) hedef veritabanına uygula. Şema yalnızca akvaryum belgesi ve paylaşım yetkileri için ayrılmış veritabanına kurulmalıdır.
3. `npm run build:api` ile `backend/.bundle/index.mjs` üret. `index.mjs` dosyasını ZIP’in köküne yerleştir ve Neon Function olarak yayınla. Alternatif olarak Neon CLI ile `neon functions deploy aquariumapi --src backend/index.ts` çalıştır.
4. Neon Function’da `ALLOWED_ORIGINS` değerine Pages origin’ini ekle. Neon `DATABASE_URL` değerini sunucuya sağlar. Veritabanı bağlantı bilgileri Vite değişkeni olarak kullanılmaz.
5. Function URL’sini depo değişkenine kaydet. `/health` uç noktası veritabanına bağlanabildiğinde HTTP 200 döndürür. Yeni yayından sonra sahip ve ziyaretçi akışlarını iki ayrı tarayıcı oturumunda dene.

Yerel API/Pages değerleri için [ortam değişkeni örneğine](.env.example) bak.
