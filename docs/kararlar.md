# Onboarding Portal — Kararlar (v1)

Yeni çalışanların departman, ekip ve rollerine göre atanan onboarding adımlarını okuyup tamamladığı, ekip liderlerinin ve
adminin ilerlemeyi takip ettiği web uygulaması. IHK Abschlussprojekt (FIAE, 80 saat, 02.11.–04.12.2026); kapsamın
dayanağı `docs/Projektantrag.docx` → "Geplanter Funktionsumfang". v2 kapsamı: [v2-yapilacaklar.md](v2-yapilacaklar.md).

Bu dosya **tek referanstır**. Kodla çelişirse bu dosya geçerlidir; karar değişirse önce bu dosya güncellenir.

---

## 1. Tech stack ve yapı

Sürümler 15.11.2026'da npm ve endoflife.date üzerinden doğrulandı.

| Konu | Karar |
|---|---|
| Runtime | Node.js 24 LTS (yerelde 24.22 kurulu; destek 2028-04'e kadar) |
| Paket yöneticisi | pnpm (yerelde 12.x) |
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19 |
| Dil | TypeScript, `strict` açık. Sürüm kurulumda Next 16 uyumuna göre seçilir (7.0 uyumu doğrulanmadıysa 5.x/6.x) |
| Veritabanı | PostgreSQL 18 (Docker) |
| ORM / migration | Drizzle ORM + drizzle-kit (SQL migration dosyaları repoda) |
| Doğrulama | Zod 4 (form + Server Action girişleri tek şema) |
| Auth | Better Auth 1.7: e-posta + şifre, `admin` plugin (kullanıcı oluşturma, rol, ban, oturum iptali), Drizzle adapter |
| UI | Tailwind CSS 4 + shadcn/ui; tüm renkler `src/styles/tokens.css` içinde CSS değişkeni |
| Editör | Tiptap 3 (WYSIWYG); içerik Tiptap JSON olarak saklanır |
| i18n | next-intl 4; namespace başına dosya: `messages/de/<namespace>.json`, `messages/en/<namespace>.json` (paralel geliştirmede çakışma olmasın diye — otonom karar) |
| Mail | Nodemailer (SMTP) + React Email şablonları; yerelde Mailpit |
| Depolama (görseller) | Yerel disk (`./uploads`), `StorageAdapter` arayüzü arkasında (ileride S3) |
| Arama | PostgreSQL full-text search (`german` / `english` konfigürasyonları) |
| Loglama | pino, yapılandırılmış JSON log; şifre/token/cookie alanları maskelenir (otonom karar) |
| Harici hata izleme | Yok (otonom karar) |
| Test | Vitest (unit + gerçek Postgres ile integration), Playwright (az sayıda E2E, nadiren) |
| Kod kalitesi | ESLint, Prettier, `tsc --noEmit` |
| CI | GitHub Actions: lint, typecheck, unit + integration test, build. E2E ayrı, elle tetiklenen workflow |
| Yerel geliştirme | Docker Compose: Postgres (host port **5433**, yerel Homebrew Postgres ile çakışmasın) + Mailpit (SMTP 1025, UI 8025) |
| Barındırma | Şimdilik yalnızca lokal. Uygulama Docker imajı + `docker-compose.prod.yml` olarak paketlenir; sunum kendi notebook'ta |
| Deploy | Otomatik deploy yok. Kurulum runbook ile elle (`docs/runbook.md`) |

### Repo yapısı (otonom karar: tek Next.js uygulaması, monorepo yok)

```
.
├─ docker-compose.yml            # dev: postgres + mailpit
├─ docker-compose.prod.yml       # app + postgres
├─ Dockerfile
├─ drizzle/                      # SQL migration'lar
├─ messages/                     # de/, en/ altında namespace dosyaları (tüm arayüz metinleri)
├─ scripts/                      # seed-admin.ts, seed-demo.ts
├─ src/
│  ├─ app/                       # route'lar (App Router)
│  │  ├─ (auth)/                 # login, set-password, reset-password
│  │  ├─ (app)/                  # giriş gerektiren alan: plan, etkinlikler, arama
│  │  ├─ (app)/team/             # ekip lideri paneli
│  │  ├─ (app)/admin/            # admin alanı
│  │  └─ api/                    # better-auth handler, uploads, polling uçları
│  ├─ components/                # ui/ (shadcn), editor/, layout/
│  ├─ server/
│  │  ├─ db/                     # drizzle şema + client
│  │  ├─ auth/                   # better-auth config, yetki kontrolleri
│  │  ├─ services/               # iş mantığı (pages, templates, plans, notifications, locks, events, users)
│  │  ├─ mail/                   # nodemailer transport + React Email şablonları
│  │  └─ storage/                # StorageAdapter + LocalDiskStorage
│  ├─ config/app.ts              # sabitler ve varsayılanlar (bkz. §2)
│  ├─ i18n/                      # next-intl config
│  └─ styles/tokens.css          # tema renkleri
└─ tests/                        # unit/, integration/, e2e/
```

Kural: veritabanına yalnızca `src/server/services/*` erişir; her servis fonksiyonu yetkiyi kendi içinde kontrol eder
(sayfa/route kontrolüne güvenilmez).

---

## 2. Ayarlar ve varsayılanlar

v1'de ayarlar sayfası yok; kullanıcı sayısı ~10. Tüm sabitler **tek yerde**: `src/config/app.ts` (otonom karar).

| Ayar | Varsayılan |
|---|---|
| Şifre minimum uzunluğu | 12 karakter |
| Oturum süresi | 7 gün |
| Davet linki geçerliliği | 72 saat |
| Şifre sıfırlama linki geçerliliği | 1 saat |
| Bildirim yoklama aralığı | 60 sn + sekme odağa gelince |
| Bildirim saklama süresi | 90 gün (okunurken eski kayıtlar temizlenir, cron yok — otonom karar) |
| Düzenleme kilidi nabzı | 30 sn |
| Kilit süre aşımı | 2 dk (nabız gelmezse) |
| Editör boşta kalma | 15 dk → "Hâlâ burada mısın?", cevap yoksa taslak tarayıcıda saklanır, kilit bırakılır |
| Görsel formatları / boyut | PNG, JPG, WebP, GIF / en fazla 5 MB |
| Varsayılan dil | Tarayıcı dili (de/en), yoksa `de` |
| Saat dilimi | Saklama UTC, gösterim Europe/Berlin |
| Arşivlenmiş kullanıcı verisi | Admin "Endgültig löschen" ile siler (öneri: 6 ay sonra; otomatik silme v2) |

---

## 3. Kullanıcılar, roller ve organizasyon

### Uygulama yetkileri
Her kullanıcının **tek** uygulama yetkisi vardır: `admin`, `team_lead`, `employee`. Admin, liderin yapabildiği her şeyi yapabilir.

### Organizasyon
- **Departman → Ekip** (iki seviye). Örn. "IT / Yazılım Geliştirme" → "Frontend", "Backend".
- **İş rolü** (Stellenrolle) ayrı bir liste: "Frontend Developer", "Designer" … Admin panelden ekler/düzenler.
- Departman, ekip ve iş rolleri admin panelinden yönetilir.
- Her çalışan: **bir ekip** (departmanı ekipten türetilir), **bir iş rolü**, **bir ekip lideri**.
- Ekip lideri yalnızca kendisine atanmış çalışanları görür. Lider aynı zamanda kendi onboarding planı olan bir çalışan olabilir.

### Çalışan kaydı alanları
Ad, soyad, e-posta (benzersiz), ekip, iş rolü, ekip lideri, başlangıç tarihi, dil (de/en), uygulama yetkisi, durum.

### Hesap yaşam döngüsü
1. Admin hesabı açar → çalışana **davet maili** (tek kullanımlık "şifreni belirle" linki, 72 saat) gider; lidere
   "Sana yeni bir çalışan atandı" bildirimi düşer.
2. Link süresi dolarsa admin daveti yeniden gönderir.
3. "Şifremi unuttum" akışı mail ile (link 1 saat).
4. Başlangıç tarihinden önce de giriş yapılabilir (pre-boarding).
5. Aynı e-postayla ikinci hesap açılamaz.
6. Deaktive edilen kullanıcının tüm oturumları anında kapanır.
7. İlk admin: `pnpm seed:admin` (e-posta + şifre terminalde sorulur). Panelden birden fazla admin eklenebilir.

### Yetki matrisi

| İşlem | Çalışan | Ekip lideri | Admin |
|---|---|---|---|
| Kendi planını görme, adım tamamlama / geri alma | ✓ | ✓ (kendi planı varsa) | ✓ |
| Başkası adına "tamamlandı" işaretleme | ✗ | ✗ | ✗ |
| Sayfa kütüphanesini okuma | ✗ (yalnızca planındaki sayfalar) | ✓ | ✓ |
| Şablon atama, plana adım ekleme/çıkarma | ✗ | Yalnızca kendi çalışanları | Herkes |
| Sayfa, modül, şablon, departman, ekip, rol, kullanıcı, etkinlik yönetimi | ✗ | ✗ | ✓ |
| İlerleme görme | Kendi | Kendi çalışanları | Herkes |
| Etkinlikleri görme | ✓ | ✓ | ✓ |
| Etkinlik duyurma | ✗ | ✗ | ✓ |

---

## 4. İçerik

### Yapı
- **Sayfa kütüphanesi:** Modül (kategori) → Sayfa. Modüller yalnızca kütüphaneyi düzenler; hedefleme şablondadır.
- Sayfa ve modüller sıralanabilir.
- Sayfa içeriği **iki dilli**: DE alanı zorunlu, EN alanı opsiyonel. EN yoksa DE gösterilir ve üstte "Nur auf Deutsch
  verfügbar" / "Only available in German" notu çıkar.
- Sayfaya görsel eklenebilir (§2 sınırları). Görseller yalnızca giriş yapmış kullanıcılara, yetki kontrollü bir route
  üzerinden sunulur; herkese açık URL yok.
- Her sayfada "son düzenleyen + tarih" tutulur.

### Durum makinesi (sayfa)

```
taslak ──yayınla──► yayında ──arşivle──► arşiv
  ▲                    │                    │
  └──(yayından kaldır)─┘◄────geri al────────┘
```

- Taslak çalışanlara görünmez.
- **Yayındaki sayfa düzenlenirse değişiklik doğrudan canlıya gider** ve §6'daki "sayfa güncellendi" bildirimi tetiklenir.
- Sayfa güncellendiğinde onu daha önce tamamlamış kişinin tamamlama işareti **korunur**; listede sessiz
  "Seit deinem Abschluss aktualisiert" rozeti görünür.

### Düzenleme kilidi (kiralık kilit / lease)
Veritabanı bağlantısı tutulmaz; kilit, `page_edit_locks` tablosunda bir satırdır.

| Sütun | Anlamı |
|---|---|
| `page_id` (PK) | Sayfa başına en fazla bir kilit |
| `user_id` | Kilidi tutan admin |
| `acquired_at` | Düzenlemeye başlama zamanı |
| `expires_at` | Her nabızda `now() + 2 dk` |

- **Al:** tek atomik sorgu — kilit yoksa, süresi dolmuşsa veya zaten benimse bana yazılır; aksi halde sahibinin adı döner.
- **Nabız:** 30 sn'de bir; kilit bende değilse editör salt okunura döner.
- **Bırak:** kaydet ve çık / sekme kapanınca satır silinir; istek gitmezse 2 dk sonra süre dolar.
- **Devral ("Bearbeitung übernehmen"):** onaydan sonra kilit bana yazılır; eski sahibine "… hat die Bearbeitung übernommen" gösterilir.
- **Kaydet:** kısa bir transaction içinde kilidin bende ve geçerli olduğu `FOR UPDATE` ile doğrulanır; değilse kayıt reddedilir.
- Diğer adminler sayfayı salt okunur görür, üstte "Admin X bearbeitet diese Seite seit HH:MM" bandı çıkar.
- Süresi dolmuş satır boş sayılır; temizlik işi gerekmez.

---

## 5. Şablonlar, planlar ve ilerleme

### Şablon (Vorlage)
- Yeniden kullanılabilir, sıralı **adımlar** listesi; her adım bir kütüphane sayfasına referanstır.
- Bağlandığı yer: **departman zorunlu** ("Alle" = şirket geneli seçilebilir), **ekip ve iş rolü opsiyonel**.
- Her adımın bir **aşama etiketi** vardır (sabit liste): *Vor dem Start · Erster Tag · Erste Woche · Erster Monat*.
- Şablon durumları: `aktif`, `arşiv`.

### Atama (kişisel plan)
1. Ekip lideri (kendi çalışanları için) veya admin (herkes için) bir çalışana **bir veya birden fazla şablon** atar.
   Sistem çalışanın departman/ekip/rolüne uyan şablonları önceden işaretler (örn. "Şirket geneli + IT Genel + Frontend Dev").
2. Atanan şablonların adımları çalışanın kişisel planına **kopyalanır** (snapshot). Aynı sayfa birden fazla şablonda varsa
   planda bir kez yer alır.
3. Lider/admin plana **kütüphaneden sayfa** ekleyebilir veya planından adım çıkarabilir.
4. Şablona sonradan eklenen adımlar mevcut planları **değiştirmez**. Sayfa içeriği ise canlıdır.
5. Plan atanmamış çalışan "Dein Onboarding-Plan wird vorbereitet" mesajını görür.
6. Çalışan ekip/lider değiştirirse plan aynen kalır; yeni lidere "Sana bir çalışan atandı" bildirimi gider, lider gerekirse
   yeni şablon ekler. Tamamlama kayıtları korunur.

### Plan görünümü (çalışan)
- Aşamalara gruplanmış liste; aşama içinde şablon sırası.
- Her adım tıklanıp okunur; çalışan "Erledigt" ile işaretler, isterse geri alır.
- Tamamlanan onboarding sonrasında da plan ve içerikler okunabilir kalır.
- Çalışan yalnızca planındaki sayfaları ve etkinlikleri görür; arama da yalnızca bunlarda yapılır.

### İlerleme
- `ilerleme = tamamlanan adım / plandaki aktif adım`. Arşivlenmiş sayfaya bağlı adımlar hesaba girmez.
- Yalnızca "tamamlandı + tarih" tutulur. Okuma süresi, scroll vb. davranış verisi **toplanmaz** (DSGVO / BetrVG §87).
- "Son aktivite" = son tamamlama işaretinin tarihi.

### Durum makinesi (çalışanın onboarding'i)

```
aktif ──%100──► tamamlandı
  ▲                 │
  └─yeni adım eklendi┘

aktif / tamamlandı ──deaktive──► arşiv ──yeniden aktive──► aktif
arşiv ──Endgültig löschen──► (kalıcı silinir, ilerleme verisiyle birlikte)
```

- %100'e her ulaşıldığında lidere ve admine "onboarding tamamlandı" bildirimi gider.

---

## 6. Bildirimler (uygulama içi)

- `notifications` tablosu; metinler **i18n anahtarı + parametre** olarak saklanır (kullanıcının diline göre gösterilir).
- Tarayıcı 60 sn'de bir ve sekme odağa gelince yeni bildirimleri sorar. Gerçek zamanlı bağlantı (SSE/WebSocket) yok.
- Üst menüde zil + okunmamış sayısı; tek tek "okundu", "tümünü okundu yap"; bildirime tıklayınca ilgili sayfaya gider.
- Saklama 90 gün.
- E-posta bildirimi yok (v2).

| Alıcı | Olay |
|---|---|
| Çalışan | Planına yeni adım eklendi · Planındaki yayında bir sayfa güncellendi · Etkinlik duyurusu |
| Ekip lideri | Kendisine yeni çalışan atandı · Çalışanı onboarding'i tamamladı · Etkinlik duyurusu |
| Admin | Bir çalışan onboarding'i tamamladı · Etkinlik duyurusu |

**"Sayfa güncellendi" kuralı:** yayındaki bir sayfa her kaydedildiğinde, sayfa planında olan `aktif` ve `tamamlandı`
durumundaki çalışanlara gider (arşivdekilere gitmez). Aynı sayfa için okunmamış bir "güncellendi" bildirimi zaten varsa
yenisi oluşturulmaz, mevcutun tarihi güncellenir (bildirim yağmuru önlenir).

---

## 7. Etkinlikler

- Kayıt: başlık ve açıklama (DE zorunlu, EN opsiyonel), başlangıç ve bitiş tarihi, yer.
- Etkinlikler sayfası: herkes görür; yaklaşan ve geçmiş etkinlikler ayrı.
- Admin "Ankündigen" butonuyla tüm aktif kullanıcılara bildirim gönderir (yeniden duyurulabilir).
- Tekrarlayan etkinlik mantığı yok (açıklamaya yazılır; v2).
- Silinen etkinliğe ait bildirimler "Etkinlik kaldırıldı" olarak görünür.

---

## 8. Silme kuralları

| Varlık | Kullanılmıyorsa | Kullanılıyorsa |
|---|---|---|
| Sayfa | Basit onayla kalıcı silinir | Arşivlenir: planlardan ve ilerleme hesabından çıkar, tamamlama kayıtları korunur, geri alınabilir |
| Şablon | Kalıcı silinir | Arşivlenir; mevcut planlar etkilenmez |
| Departman / Ekip / İş rolü | Silinir | Silinemez; bağlı kişiler ve şablonlar listelenir |
| Kullanıcı | — | Önce deaktive (`arşiv`); arşivde "Endgültig löschen" ilerleme verisiyle kalıcı siler |
| Etkinlik | Silinir | — |

Onay ekranı: kullanılmıyorsa basit "Emin misin?"; kullanılıyorsa etkilenenler gösterilir ("3 aktif planda bu sayfa var")
ve kullanıcı öğenin adını yazarak onaylar.

---

## 9. Arayüz

- Arayüz dili **Almanca ve İngilizce**; tüm metinler `messages/{de,en}/*.json`'dan. Kullanıcı dilini profilinden seçer.
  URL'de dil öneki yok; dil profil/cookie'den gelir (otonom karar).
- Uygulama adı: **"Onboarding Portal"** (geçici; logo ve isim tek yerden değişir).
- Responsive (telefon dahil). Tema: açık / koyu / sistem; renkler yalnızca `tokens.css`'te. Varsayılan palet nötr.
- Boş / yükleniyor / hata durumları her listede tanımlı.

### Sayfalar
| Alan | Sayfalar |
|---|---|
| Herkes | Giriş, şifre belirleme, şifre sıfırlama, Plan (aşamalara gruplu), Sayfa görünümü, Etkinlikler, Arama, Profil (dil, tema), Bildirimler |
| Ekip lideri | Ekibim: çalışan listesi (ilerleme %, başlangıç, son aktivite) → çalışan detayı (modül modül tamamlanan/kalan, şablon atama, adım ekle/çıkar), Kütüphane (salt okunur) |
| Admin | Genel bakış (tüm çalışanlar, departman/ekip filtresi), Kullanıcılar, Departmanlar & Ekipler, İş rolleri, Kütüphane (modüller, sayfalar, editör), Şablonlar, Etkinlikler |

---

## 10. Güvenlik ve gizlilik

- Kayıt sayfası yok; hesapları yalnızca admin açar.
- Better Auth'un yerleşik rate limit'i giriş ve şifre sıfırlama uçlarında açık.
- Güvenlik başlıkları `next.config` içinde (CSP, X-Frame-Options, Referrer-Policy …) (otonom karar).
- Sırlar yalnızca `.env`'de; repoda `.env.example` (yalnızca anahtar adları). Repo **herkese açık**.
- Demo/seed içerik kurgusaldır; gerçek şirket içi bilgi repoya girmez (otonom karar).
- DSGVO: yalnızca tamamlama + tarih; Betriebsrat bilgilendirmesi yayın öncesi kullanıcının işi.
- Mail gönderen adresi `noreply@<kullanıcının domaini>`; SPF/DKIM/DMARC kayıtları mail aşamasında kontrol edilir.

---

## 11. Test ve "bitti" tanımı

- **Her değişiklikte:** lint, typecheck, Vitest unit + integration (gerçek Postgres, test veritabanı), build.
- **E2E (Playwright):** yalnızca kritik akışlar (giriş + plan tamamlama, admin kullanıcı oluşturma + şablon atama,
  etkinlik duyurusu). Az sayıda tutulur, **nadiren** (aşama sonu / teslim öncesi) çalıştırılır; varsayılan CI'da yok.
- İş mantığı servislerinin (ilerleme, atama/snapshot, kilit, bildirim tekilleştirme, yetki) integration testleri zorunlu.
- Projektdokumentation'a aktarılabilir çıktılar: ER diyagramı, yetki matrisi (§3), durum makineleri (§4, §5), test planı.

---

## 12. Mimari otonom kararlar

Uygulama planı ve ayrıntılar: [v1-architecture.md](v1-architecture.md). Aşağıdakiler o dokümanla alınan küçük kararlardır.

- Davet linkleri Better Auth `verification` tablosunda değil, ayrı `invitations` tablosunda tutulur (72 sa geçerlilik,
  token yalnızca hash olarak, yeniden gönderince eski link iptal); şifre sıfırlama Better Auth ile (1 sa). (otonom karar)
- Tamamlama kayıtları ayrı `page_completions` tablosunda (kullanıcı + sayfa) tutulur; adım plandan çıkarılınca kayıt
  korunur, adım geri eklenirse tamamlama geri gelir. İlerleme yalnızca aktif adımları sayar. (otonom karar)
- Plandaki taslak sayfalar çalışana görünmez ve ilerleme hesabına girmez (arşiv gibi). (otonom karar)
- Kullanılan taslak sayfa silinmek istenirse arşivlenir (`taslak → arşiv` geçişi eklendi); geri al → yayında. Taslak
  sayfa yeniden yayınlanınca planında olanlara "sayfa güncellendi" bildirimi gider. (otonom karar)
- Okunmamış bildirim tekilleştirmesi "sayfa güncellendi" dışındaki türlere de uygulanır (yeni adım, etkinlik duyurusu,
  çalışan atandı, onboarding tamamlandı). (otonom karar)
- Görsele erişim, görselin ait olduğu sayfayı görme yetkisine bağlıdır (admin hepsini görür). (otonom karar)
- Modül yalnızca içinde sayfa yokken silinebilir. Sıralama sürükle-bırak değil, yukarı/aşağı butonlarıyla. (otonom karar)
- Son aktif admin deaktive edilemez, silinemez, rolü düşürülemez; başkasının lideri olan kullanıcı kalıcı silinemez ve
  rolü `employee`'ye düşürülemez (önce çalışanları başka lidere atanır). (otonom karar)
- Kullanıcı yönetimi (oluşturma, deaktive = Better Auth `banned` + oturumların silinmesi) servis katmanında Drizzle ile
  yapılır; Better Auth oturum çerezi önbelleği kapalı tutulur ki deaktivasyon anında etkili olsun. (otonom karar)
- TypeScript 6.0.x ve ESLint 9.x kullanılır: `typescript-eslint` (<6.1) ve eslint-plugin-react/jsx-a11y/import
  (eslint ^9) eş bağımlılık aralıkları TypeScript 7 / ESLint 10'u henüz desteklemiyor. (otonom karar)
