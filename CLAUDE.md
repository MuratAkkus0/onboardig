# Onboarding Portal

Yeni çalışanlara departman/ekip/rol bazlı onboarding planı sunan, ilerlemeyi ekip lideri ve admin için takip edilebilir kılan
Next.js uygulaması. IHK Abschlussprojekt (FIAE, 80 saat, teslim 04.12.2026).

**Önce oku:**
- `docs/kararlar.md` — tek referans; kodla çelişirse karar dokümanı geçerli, karar değişirse önce bu dosya güncellenir.
- `docs/v1-plan.md` — aşamalar ve kabul kriterleri.
- `docs/v2-yapilacaklar.md` — ertelenenler; kancalarını kur, kendilerini yapma.
- `docs/Projektantrag.docx` — kapsamın dayanağı (yerel, repoda yok).

## Çalışma kuralları

- İletişim Türkçe; kod, commit mesajları ve kod yorumları İngilizce.
- **Otonom mod:** Aşamalar arasında durmadan ilerle. Yeni küçük kararları `docs/kararlar.md`'ye "(otonom karar)" etiketiyle ekle.

### Ne zaman durup sorulur
- `kararlar.md`'de olmayan ve geri alınması zor karar; `kararlar.md` veya Projektantrag kapsamıyla çelişen ihtiyaç.
- Veri silme, dışa açılan yeni servis, kapsamı değiştiren karar gibi riskli işler.

### Kesin yasaklar
- `git reset --hard`, force push, geçmişi yeniden yazmak. Geri almak için `git revert`.
- Onaysız sistem paketi / global araç kurulumu veya güncellemesi (proje bağımlılıkları serbest).
- `.env` dosyalarını okumak; sırları sohbete, loga veya repoya yazmak. Repo **herkese açık**.
- Şirket içi dokümanları (`docs/Projektantrag.docx`) veya gerçek şirket içi bilgiyi commit etmek; demo içerik kurgusal.
- Arayüzde sabit metin (hepsi `messages/{de,en}/*.json`); renkleri bileşene gömmek (yalnızca `tokens.css`); sabitleri
  `src/config/app.ts` dışında tanımlamak.
- Servis katmanını atlayıp veritabanına route/bileşenden erişmek; yetki kontrolünü yalnızca arayüze bırakmak.
- Okuma süresi, scroll gibi davranış verisi toplamak (DSGVO / BetrVG).

### Git
- Commit ve push serbest, sormadan yapılır. Mesaj: tek satır, İngilizce, Conventional Commits (`type(scope): summary`),
  AI atıf / `Co-Authored-By` satırı yok.
- Bu repo push için `gh` kimliğini kullanır (repo-local credential helper ayarlı).

### Aşama akışı
1. `v1-plan.md`'de aşamanın kabul kriterlerini oku.
2. Geliştir; anlamlı adımlarda commit.
3. Bitti kontrolü: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` geçmeli, CI yeşil olmalı.
4. **E2E (Playwright):** az sayıda kritik akış; her değişiklikte değil, yalnızca aşama sonu / teslim öncesi çalıştır.
5. `v1-plan.md`'de durumu güncelle, push et, sonraki aşamaya geç.

## Teknik
- Node 24 LTS, pnpm, Next.js 16 (App Router), TypeScript strict, Drizzle ORM, PostgreSQL 18, Better Auth 1.7, next-intl 4,
  Tiptap 3, Tailwind 4 + shadcn/ui, Nodemailer + React Email, Vitest, Playwright.
- Yerel servisler: `docker compose up -d` → Postgres `localhost:5433`, Mailpit SMTP `1025`, UI `http://localhost:8025`.
- DB erişimi yalnızca `src/server/services/*`; her servis fonksiyonu yetkiyi kendisi kontrol eder.
- Yeni sabit/varsayılan → `src/config/app.ts`. Yeni metin → kendi namespace dosyan `messages/de/<ns>.json` + `messages/en/<ns>.json` (ikisi birden).
- Mimari sözleşme: `docs/v1-architecture.md` (şema, servisler, route'lar, dosya sahipliği).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
