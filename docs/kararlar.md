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

---

## 12. Otonom kararlar (mimari blueprint, 15.11.2026)

Blueprint incelemesi sırasında netleştirilen yorumlar (kaynak: `docs/v1-architecture.md` §14.1).

- **P1** Onboarding `tamamlandı → aktif`, plandaki aktif adımların ilerlemesi %100'ün altına her düştüğünde olur (yeni adım, geri alma, sayfanın yayına alınması/geri alınması/yayından kaldırılması, planın boşalması); geri alıp yeniden tamamlamak bildirimi yeniden gönderir (okunmamışsa tekilleşir). (otonom karar; §3.2)
- **P2** Arşivden yeniden aktive edilen kullanıcı `aktif` olur, ardından sessizce yeniden hesaplanır (plan %100 ise `tamamlandı`); bu geçiş "onboarding tamamlandı" bildirimi göndermez. (otonom karar; §3.2, §4.4 users)
- **P3** "Sayfa güncellendi" bildirimi sayfayı düzenleyen kişinin kendisine gitmez. (otonom karar; §4.5)
- **P4** Başkalarının lideri olan kullanıcı deaktive edilebilir; onay ekranı bu çalışanları listeler, admin onları başka lidere atar. Arşivdeki kullanıcıya hiçbir bildirim yazılmaz; lider kuralı yalnızca lider değiştirilirken kontrol edilir. Lider zinciri döngü oluşturamaz. (otonom karar; §2.3, §4.4 users)
- **P5** Kişi kendisi hakkında bildirim almaz: "onboarding tamamlandı" konunun kendisine, "çalışan atandı" işlemi yapan admin kendini lider seçtiyse ona gitmez. Alıcılar küme olarak hesaplanır (lider aynı zamanda admin olabilir). (otonom karar; §4.8)
- **P6** Departman "kullanılıyor" ⇔ ekiplerinde kişi ya da departmana/ekiplerine bağlı şablon var; yalnızca boş ekipleri olan departman, bu ekiplerle birlikte silinir. Şablonu olan ekibin departmanı değiştirilemez. (otonom karar; §2.3, §4.4 org)
- **P7** Sayfa "kullanılıyor" ⇔ bir şablon adımında, herhangi bir kullanıcının (arşiv dahil) planında veya bir tamamlama kaydında geçiyor. (otonom karar; §4.4 pages)
- **P8** Arama sayfaları (erişim kuralına göre) ve etkinlikleri (herkes) kapsar. (otonom karar; §4.4 search)
- **P9** "Şifremi unuttum" maili yalnızca şifresi olan (daveti kabul etmiş) aktif kullanıcıya gider; süresi dolmuş davet yalnızca "daveti yeniden gönder" ile çözülür. (otonom karar; §5.3)
- **P10** Bir görsel yalnızca yüklendiği sayfada kullanılabilir; başka sayfanın görseli içerikte reddedilir. (otonom karar; §2.3 uploads)
- **P11** Ekip lideri, çalışanın planındaki yayında olmayan adımları başlıksız, yalnızca durum etiketiyle görür. (otonom karar; §4.4 plans)
- **P12** Better Auth `admin` plugin yalnızca girişteki ban kontrolü için kullanılır; tüm `/admin/*` uçları ve `update-user`, `delete-user`, `change-email` gibi servisleri atlayan uçlar kapalıdır (404). (otonom karar; §5.3)
- **P13** Sayfadaki "son düzenleyen + tarih" yalnızca içerik kaydını yansıtır (`content_updated_at` + `updated_by`); sıralama/durum değişiklikleri bu tarihi değiştirmez. (otonom karar; §2.3 pages)
- **P14** Kalıcı silinen kullanıcı hakkındaki bildirimler (liderin/adminlerin akışında) de silinir (DSGVO). (otonom karar; §2.3, §4.4 users)
- **P15** EN başlık ve EN içerik birlikte doldurulur ya da birlikte boş bırakılır (sayfa ve etkinlik); EN "var" sayılması tek bir yardımcıyla (`hasEnglish`) belirlenir. (otonom karar; §2.3)

### Dalga 1 otonom kararları

- **P-org-1** Davet kabul edilmeden e-posta değiştirilirse eski link iptal edilir, yeni adrese yeni davet gider; kabulden sonra e-posta kilitlenir. (otonom karar)
- **P-org-2** Arşivdeki kullanıcı düzenlenemez; önce yeniden aktive edilmesi gerekir, detay sayfası salt okunur özet gösterir. (otonom karar)
- **P-org-3** "Birinin lideri mi" kontrolü (rolü çalışana düşürme, kalıcı silme) arşivdeki çalışanları da sayar; deaktivasyon etki listesi yalnızca aktif olanları gösterir. (otonom karar)
- **P-org-4** Deaktivasyonda ad yazarak onay yalnızca kişi hâlâ lider ise istenir; kalıcı silmede her zaman istenir. (otonom karar)
- **P-org-5** Kullanıcı listesi varsayılan olarak tüm durumları gösterir; filtreler (ad/e-posta, durum, rol, departman, ekip) URL parametresiyle çalışır. (otonom karar)
- **P-org-6** Admin değişmezleri için kilit sırası: aktif adminler (artan id) → kullanıcı satırı → aday lider; eşzamanlı döngü oluşturan lider değişikliği deadlock tespitiyle `CONFLICT` olur. (otonom karar)
- **P16** Editör yalnızca H2 ve H3 sunar (H1 sayfa başlığıdır). (otonom karar)
- **P17** Zengin metin kayıtta izin listesine göre temizlenir; linkler yalnızca http, https, mailto; görseller yalnızca `/api/uploads/<uuid>`. (otonom karar)
- **P18** Modül/sayfa taşıma, kardeş listesini satır kilidi altında 0..n-1 olarak yeniden numaralar. (otonom karar)
- **P19** Admin kütüphanesi tüm durumları (arşiv dahil) durum filtresiyle listeler; lider yalnızca yayındaki sayfaları ve bunları içeren modülleri görür. (otonom karar)
- **P20** Devralma, boşta kalma veya kilit kaybından sonra editör sayfayı yeniden yükler; kaydedilmemiş iş tarayıcıdaki taslakta tutulur ve sonraki açılışta geri yükleme önerilir. (otonom karar)
- **P21** Boş içerikli sayfanın yayınlanması engellenmez; zorunlu olan yalnızca DE başlık. (otonom karar)
- **P22** Kullanımda olan arşivlenmiş bir sayfayı silme girişimi `IN_USE` ile reddedilir. (otonom karar)
- **P-ev-1** Bildirimlerde okundu işlemleri server action ile yapılır; yalnızca `GET /api/notifications/poll` API ucu vardır. (otonom karar)
- **P-ev-2** Geçmiş etkinlik listesi 100 ile sınırlı; başlık 200, açıklama 5000, yer 200 karakter. (otonom karar)
- **P-ev-3** Etkinlik güncellemesi gönderilmiş bildirimleri değiştirmez; yeniden duyuru okunmamış bildirimi tekilleştirerek tazeler. Etkinlik silme kalıcıdır, eski duyurular "Veranstaltung entfernt" olarak görünür. (otonom karar)
- **P-tech-1** PostgreSQL `ON DELETE RESTRICT` ihlali (SQLSTATE 23001) merkezi hata eşlemesinde FK ihlali (23503) gibi ele alınır. (otonom karar)

### Dalga 2 otonom kararları

- **P-tpl-1** Şablon silme: hiç atanmamışsa kalıcı silinir; atanmışsa adı yazılarak onaylanan arşivleme yapılır, etki ekranı atama sayısını ve aktif onboarding sayısını gösterir. (otonom karar)
- **P-tpl-2** Şablon adımları aşama içinde sıralanır; aşama değiştirilen adım hedef aşamanın sonuna eklenir. (otonom karar)
- **P-tpl-3** Arşivdeki şablonun adımları düzenlenebilir; şablona taslak sayfa eklenebilir (arayüzde işaretli), arşiv sayfa eklenemez. (otonom karar)
- **P-plan-1** Kopyalamada şablon önceliği: şirket geneli → departman → ekip → iş rolü, sonra ad. (otonom karar)
- **P-plan-2** Lider plana yayında olmayan bir sayfa eklemeye çalışırsa sayfa yokmuş gibi yanıt alır (taslağın varlığı sızmaz). (otonom karar)
- **P-plan-3** Tamamlanmış adımı yeniden tamamlamak ilk tamamlama tarihini korur; "Seit deinem Abschluss aktualisiert" rozetini kaldırmak için çalışan adımı geri alıp yeniden tamamlar. (otonom karar)
- **P-plan-4** Çalışan başkasının planına erişmeye çalışırsa `FORBIDDEN`, lider kendisine atanmamış çalışan için `NOT_FOUND` alır. (otonom karar)

### Dalga 3 otonom kararları

- **P-dash-1** Ekip paneli arşivdeki çalışanları göstermez; admin genel bakışı arşivdekileri yalnızca durum filtresi "arşiv" seçilince gösterir. (otonom karar)
- **P-dash-2** Admin genel bakışı tüm rollerdeki kullanıcıları listeler (ekip liderinin de onboarding'i olabilir); özet sayılar filtrelenmiş satırlardan hesaplanır. (otonom karar)
- **P-search-1** Arama en az uzunluğun altındaki sorgularda boş sonuç döner, 100 karakterden uzun sorguyu reddeder; snippet vurguları HTML olarak değil, karakter aralığı olarak taşınır ve `<mark>` ile çizilir. (otonom karar)
- **P-del-1** Demo verisi tamamen kurgusaldır ve çalıştırma tarihine göre göreli tarihlenir; tüm demo hesapları için tek bir rastgele şifre üretilir ve sonda bir kez yazdırılır (`SEED_DEMO_PASSWORD` ile sabitlenebilir). `seed:demo --reset` production'da reddedilir. (otonom karar)
- **P-del-2** Devir dokümanı (`docs/runbook.md`) şirkete teslim edileceği için Almanca yazılır. (otonom karar)
