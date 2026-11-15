# v1 Planı

Kararlar: [kararlar.md](kararlar.md). P1 (Antrag çekirdeği) ve P2 (ekstralar) aynı sürümde; sıra P1 önce gelecek
şekilde kuruldu. Teslim: 04.12.2026.

Durum: ⬜ başlamadı · 🔄 devam ediyor · ✅ bitti

| # | Aşama | Antrag karşılığı | Durum |
|---|---|---|---|
| 0 | Kurulum | Einrichtung der Entwicklungs- und Versionsverwaltungsumgebung | ✅ |
| 1 | Temel: auth, roller, i18n, tema, mail | Benutzeranmeldung und Berechtigungsprüfung | ✅ |
| 2 | Organizasyon ve kullanıcı yönetimi | Verwaltung von Abteilungen, Rollen | 🔄 |
| 3 | İçerik kütüphanesi ve editör | Verwaltung von Onboarding-Vorlagen (içerik tarafı) | 🔄 |
| 4 | Şablonlar, atama, ilerleme | Vorlagen, Zuweisung und Fortschrittsverfolgung | ⬜ |
| 5 | Bildirimler ve etkinlikler | Benachrichtigungsfunktion, Veranstaltungen | 🔄 |
| 6 | Paneller ve arama | Darstellung des Bearbeitungsstandes | ⬜ |
| 7 | Bitiriş: demo veri, Docker prod, E2E, dokümantasyon girdileri | Test, Bereitstellung | ⬜ |

## 0. Kurulum
- Next.js 16 + TypeScript strict + pnpm iskeleti; ESLint, Prettier.
- Tailwind 4 + shadcn/ui, `tokens.css` (açık/koyu).
- `docker-compose.yml`: Postgres 18 (5433), Mailpit (1025/8025).
- Drizzle + ilk migration; Vitest (unit + integration, ayrı test DB); Playwright iskeleti (1 smoke test).
- `.env.example`; GitHub Actions CI (lint, typecheck, test, build).

**Kabul:** `docker compose up -d` + `pnpm dev` açılıyor; `pnpm lint && pnpm typecheck && pnpm test && pnpm build` geçiyor; CI yeşil.
**Kullanıcıdan:** Docker Desktop çalışıyor olmalı.

## 1. Temel
- Better Auth (e-posta + şifre, admin plugin, Drizzle adapter), roller `admin` / `team_lead` / `employee`.
- Yetki yardımcıları (servis katmanında), korumalı route grupları.
- next-intl (de/en, profil/cookie), tema seçimi, uygulama iskeleti (menü, üst bar).
- Nodemailer + React Email; davet ("şifreni belirle") ve şifre sıfırlama akışları.
- `pnpm seed:admin`.

**Kabul:** seed ile admin girişi; davet maili Mailpit'te görünüyor ve link şifre belirletiyor; yetkisiz rol admin alanına giremiyor (integration testi); DE/EN geçişi çalışıyor.

## 2. Organizasyon ve kullanıcı yönetimi
- Departman, ekip, iş rolü CRUD (silme kuralları §8).
- Kullanıcı oluşturma (ekip, rol, lider, başlangıç tarihi, dil), davet yeniden gönderme, deaktive/aktive, kalıcı silme.
- Deaktive edilen kullanıcının oturumlarının kapanması.

**Kabul:** silme kuralları ve benzersiz e-posta integration testleriyle doğrulanmış; deaktive kullanıcı giriş yapamıyor.

## 3. İçerik kütüphanesi ve editör
- Modül + sayfa CRUD, sıralama, taslak/yayında/arşiv.
- Tiptap editör, DE/EN alanları, EN fallback notu.
- Görsel yükleme (`StorageAdapter`, yetki kontrollü sunum, format/boyut doğrulama).
- Düzenleme kilidi (kiralık kilit, nabız, boşta kalma, devralma).

**Kabul:** kilit al/nabız/süre aşımı/devral/kayıt reddi integration testleriyle doğrulanmış; yetkisiz kullanıcı görsel URL'sini açamıyor.

## 4. Şablonlar, atama, ilerleme
- Şablon CRUD (departman zorunlu, ekip/rol opsiyonel, adımlar + aşama etiketi).
- Atama: uygun şablon önerisi, snapshot kopyalama, tekilleştirme, adım ekle/çıkar.
- Çalışan plan görünümü (aşamalara gruplu), tamamla/geri al, "güncellendi" rozeti.
- İlerleme hesabı ve onboarding durum makinesi.

**Kabul:** snapshot, tekilleştirme, ilerleme ve durum geçişleri integration testleriyle doğrulanmış; lider yalnızca kendi çalışanına atama yapabiliyor.

## 5. Bildirimler ve etkinlikler
- `notifications` tablosu, i18n anahtarlı metinler, zil + okunmamış sayısı, polling, okundu işlemleri, 90 gün temizlik.
- Tetikleyiciler (§6), "sayfa güncellendi" tekilleştirmesi.
- Etkinlik CRUD, etkinlikler sayfası, "Ankündigen".

**Kabul:** her tetikleyici ve tekilleştirme integration testiyle doğrulanmış; duyuru tüm aktif kullanıcılara düşüyor.

## 6. Paneller ve arama
- Ekip lideri paneli ve çalışan detayı; admin genel bakış (departman/ekip filtresi).
- Full-text arama (yalnızca kullanıcının erişebildiği sayfalar, kullanıcının dili).

**Kabul:** lider başkasının çalışanını göremiyor; arama yetki dışı sayfa döndürmüyor (integration testleri).

## 7. Bitiriş
- `pnpm seed:demo`: kurgusal departmanlar, ekipler, roller, modüller, sayfalar, şablonlar, etkinlikler, örnek kullanıcılar.
- `Dockerfile` + `docker-compose.prod.yml`, `docs/runbook.md` (kurulum, migration, ilk admin, gerçek SMTP'ye geçiş).
- Kritik E2E akışları (az sayıda) — bu aşamada çalıştırılır.
- Projektdokumentation girdileri: ER diyagramı, yetki matrisi, durum diyagramları, test planı/raporu (`docs/projektdoku/`).

**Kabul:** prod compose ile temiz kurulum çalışıyor; E2E geçiyor; tüm aşama kabul kriterleri sağlanmış.
**Kullanıcıdan:** gerçek SMTP bilgilerini `.env`'e girmek; domainde SPF/DKIM/DMARC kontrolü (adım adım anlatılacak).
