## Çalışma kuralları

- İletişim Türkçe; kod, commit mesajları ve kod yorumları İngilizce.
- **Git:** Commit ve push serbest, sormadan yapılır. Mesaj formatı tek satır Conventional Commits (`type(scope): summary`), AI attribution / `Co-Authored-By` satırı yok.
- **Yasak:** `git reset --hard` ve geçmişi yeniden yazmak. Geri almak için `git revert` kullanılır.
- **Repo herkese açık (PUBLIC):** Sırlar (`.env`), şirket içi dokümanlar (`docs/Projektantrag.docx`) asla commit edilmez.
- Proje bağımlılıkları ve komutlar serbest. Riskli/geri dönüşsüz kararlar (veri silme, dışa açılan yeni servis, kapsamı değiştiren karar) kullanıcıya danışılır.
- Proje bir IHK Abschlussprojekt'i (FIAE, 80 saat, 02.11.–04.12.2026). Kapsam `docs/Projektantrag.docx`'teki "Geplanter Funktionsumfang"a bağlıdır; ondan sapan her karar kullanıcıya danışılır.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
