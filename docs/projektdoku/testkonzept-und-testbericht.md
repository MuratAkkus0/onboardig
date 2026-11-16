# Testkonzept und Testbericht

## 1. Teststrategie

Die Qualitätssicherung folgt einer Testpyramide mit Schwerpunkt auf Integrationstests, weil die
fachlich kritische Logik (Rechteprüfung, Zuweisung, Fortschritt, Sperren, Benachrichtigungen) in den
Services liegt und erst im Zusammenspiel mit der echten Datenbank vollständig geprüft werden kann
(Transaktionen, Zeilensperren, Constraints, Volltextsuche).

| Ebene                        | Werkzeug               | Umfang                                                                                                         | Ausführung                                     |
| ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Statische Prüfung            | ESLint, TypeScript (strict), Prettier | Codequalität, Typsicherheit                                                                       | bei jeder Änderung, CI                         |
| Unit-Tests                   | Vitest                 | Reine Funktionen: Zustandsautomaten, Fortschritt, Validierungsschemas, Bereinigung des Editorinhalts, Speicher-Adapter, i18n-Vollständigkeit, Rechtetabelle | bei jeder Änderung, CI (`pnpm test:unit`)      |
| Integrationstests            | Vitest + PostgreSQL 18 | Services und Route Handler gegen eine echte, frisch migrierte Datenbank; Mails über In-Memory-Transport        | bei jeder Änderung, CI (`pnpm test:integration`) |
| End-to-End-Tests             | Playwright (Chromium)  | wenige kritische Abläufe im Browser gegen den laufenden Server                                                 | selten: Phasenende / vor Abgabe, manueller CI-Workflow |

### 1.1 Testdatenbank je Arbeitskopie

- Integrationstests laufen gegen eine eigene Datenbank auf dem lokalen PostgreSQL-Container. Ihr Name
  wird aus dem Verzeichnis der Arbeitskopie und einem Hash des Pfads gebildet
  (`onboarding_test_<verzeichnis>_<hash>`, `tests/setup/test-db.ts`). Parallele Arbeitskopien (Git
  Worktrees) stören sich dadurch nicht, und die Entwicklungsdatenbank bleibt unberührt.
- Vor jedem Lauf wird diese Datenbank gelöscht, neu angelegt und mit denselben Migrationen wie in
  Produktion aufgebaut (`tests/setup/global-setup.ts`). In der CI wird sie über `TEST_DATABASE_URL`
  vorgegeben.
- Testdateien laufen nacheinander (`fileParallelism: false`). Vor jedem einzelnen Test werden alle
  Tabellen geleert (`resetDb`); jeder Test legt seine Daten über Factories (`tests/factories`) selbst an.
  Hochgeladene Bilder landen in einem temporären Verzeichnis, das nach dem Lauf gelöscht wird.
- Uhrzeitabhängige Fälle (Ablauf von Einladung, Sperre, Aufbewahrung) werden durch gezieltes
  Zurückdatieren von Zeitstempeln in der Datenbank geprüft, nicht durch Warten.
- Nebenläufigkeit wird mit echten parallelen Transaktionen getestet (z. B. zwei Admins holen gleichzeitig
  dieselbe Sperre, zwei gleichzeitige Herabstufungen der letzten beiden Admins).

### 1.2 Was bewusst geprüft wird

- **Rechte:** für jeden Service-Bereich ein Block „authorization“, der jede Rolle gegen jede Funktion prüft
  (Employee/Teamleiter erhalten `FORBIDDEN` bzw. `NOT_FOUND`). Seit v1.1 zusätzlich je Funktion der
  Redaktionsrechte: Teamleitung der eigenen Abteilung, Teamleitung einer anderen Abteilung, Teamleitung
  ohne Team, unternehmensweite Inhalte und Admin-only-Operationen, jeweils mit der richtigen Wahl
  zwischen `FORBIDDEN` (sichtbar) und `NOT_FOUND` (unsichtbar).
- **Zustandsübergänge:** alle erlaubten und unerlaubten Übergänge von Seite und Onboarding; bei Meldungen
  das Setzen und Leeren von `resolved_at` und `handled_by` sowie die Benachrichtigung bei jedem Übergang
  nach „erledigt“.
- **Grenzfälle:** leere Pläne, Duplikate, gelöschte Bezüge, abgelaufene Tokens, zu große oder falsch
  deklarierte Dateien, Sonderzeichen in Suchbegriffen.
- **Datenschutz:** Kaskadenlöschung beim endgültigen Löschen einer Person, Maskierung im Log, nur eigene
  Benachrichtigungen; Meldungen bleiben beim Löschen der meldenden Person ohne Personenbezug erhalten,
  erledigte Meldungen werden nach 180 Tagen gelöscht.
- **Missbrauchsschutz:** Rate Limit für Meldungen (6. Meldung binnen einer Stunde abgelehnt, auch bei
  gleichzeitigen Anfragen), unsichere Pfade abgelehnt.
- **Konventionen:** Deutsch und Englisch haben identische Textschlüssel; Farben stehen nur in
  `tokens.css` (Voraussetzung für den Dunkelmodus).

### 1.3 Definition „fertig“

Eine Änderung gilt als fertig, wenn `pnpm lint && pnpm typecheck && pnpm test && pnpm build` lokal und in
der CI erfolgreich durchlaufen.

## 2. Testbericht (Stand v1.1, 16.11.2026)

Stand `c23bdc4` (Branch `main`, nach Zusammenführung von V-role, V-lead und V-fb), Node.js 24,
PostgreSQL 18.7 im Docker-Container, eigene Testdatenbank je Arbeitskopie.

| Prüfung                    | Befehl                  | Ergebnis                                 |
| -------------------------- | ----------------------- | ---------------------------------------- |
| Lint                       | `pnpm lint`             | ohne Befund                              |
| Typprüfung                 | `pnpm typecheck`        | ohne Befund                              |
| Unit-Tests                 | `pnpm test:unit`        | **38 Dateien, 261 Tests, 261 bestanden** |
| Integrationstests          | `pnpm test:integration` | **32 Dateien, 419 Tests, 419 bestanden** |
| **Summe `pnpm test`**      |                         | **70 Dateien, 680 Tests, 0 fehlgeschlagen** |
| E2E                        | `pnpm test:e2e`         | 4 Dateien, 4 Tests; Abschlusslauf v1.1 (16.11.2026): 4 bestanden, 0 fehlgeschlagen |

Zum Vergleich der Lauf vom 15.11.2026 (Stand v1, `1be7471`): 222 Unit- und 320 Integrationstests
(542 insgesamt). Seitdem sind 39 Unit- und 99 Integrationstests hinzugekommen, überwiegend für die
Erweiterungen von v1.1, zum kleineren Teil für Korrekturen aus der Abschlussprüfung von v1.

### 2.1 Unit-Tests (`tests/unit`)

| Datei                                   | Tests | Inhalt                                                                                         |
| --------------------------------------- | ----: | ---------------------------------------------------------------------------------------------- |
| `auth/content-access.test.ts`           |     6 | **v1.1:** Bearbeitungsrechte an Modulen/Seiten und Sicht-/Verwaltungsrechte an Vorlagen je Redaktionsbereich |
| `auth/permissions.test.ts`              |     7 | Rechtetabelle je Rolle, Routenzugang (`canAccessRoute`); Admin-only-Operationen vs. `content.edit`/`templates.edit` |
| `content/content-validation.test.ts`    |     8 | Schemas für Seiteninhalt, Module und Uploads (EN ganz oder gar nicht)                          |
| `content/extract-text.test.ts`          |     4 | Klartext-Extraktion aus Tiptap-JSON für die Suche                                              |
| `content/local-disk-storage.test.ts`    |    15 | Speicher-Adapter: Ablegen, Lesen, Löschen, Abwehr von Pfadüberschreitung, kein Überschreiben    |
| `content/page-content.test.ts`          |     2 | Darstellung gespeicherter Inhalte                                                              |
| `content/plain-json.test.ts`            |     1 | Umwandlung von Editor-Attributen in einfache Objekte                                           |
| `content/sanitize.test.ts`              |    25 | Bereinigung des Editorinhalts: erlaubte Knoten/Marks, Links nur http/https/mailto, Bild-URLs, Größenlimit |
| `content/tiptap-helpers.test.ts`        |     5 | Link-Prüfung, Bildverweise, lokaler Entwurfsspeicher des Editors                               |
| `dashboards/summary.test.ts`            |     4 | Kennzahlen der Übersicht, Filterschema                                                         |
| `delivery/demo-data.test.ts`            |     6 | Konsistenz der fiktiven Demo-Daten                                                             |
| `delivery/guard.test.ts`                |     5 | Schutz von `seed:demo --reset` in Produktion                                                   |
| `domain/job-role-fit.test.ts`           |     7 | **v1.1:** Regel „Rolle passt zur Abteilung“, Filtern der Rollen im Formular, Zurücksetzen unpassender Auswahl |
| `domain/locale-content.test.ts`         |     4 | Erkennung leerer Dokumente und vollständiger englischer Variante                              |
| `domain/notification-params.test.ts`    |     2 | Sprachabhängige Parameter von Benachrichtigungen                                               |
| `domain/onboarding-status.test.ts`      |     9 | Zustandsautomat Onboarding (alle Übergänge, ungültige Übergänge)                              |
| `domain/page-status.test.ts`            |     4 | Zustandsautomat Seite                                                                          |
| `events/validation.test.ts`             |     5 | Eingabeschema Veranstaltungen (Zeitraum, Sprachvarianten, Längen)                              |
| `http/describe-error.test.ts`           |     3 | Fehlerbeschreibung im Log ohne SQL-Text und Parameter                                          |
| `http/route.test.ts`                    |     5 | `withActor`: 401 ohne Sitzung, Origin-Prüfung, Fehler → HTTP-Status                            |
| `i18n/locale.test.ts`                   |     4 | Sprachermittlung, Laden der Texte                                                              |
| `i18n/no-wrapper.test.ts`               |    40 | Aufbau aller Namespace-Dateien                                                                 |
| `i18n/parity.test.ts`                   |    21 | Jeder Namespace existiert in beiden Sprachen mit identischen Schlüsseln                        |
| `layout/area-routes.test.ts`            |     2 | **v1.1:** Zuordnung Rolle → Bereich (`admin`/`lead`) und Routen je Bereich                     |
| `layout/datetime.test.ts`               |     3 | Umrechnung Europe/Berlin ↔ UTC für Datumsfelder                                                |
| `layout/in-app-history.test.ts`         |     2 | **v1.1:** Zurück-Button: Verlauf innerhalb der Anwendung                                       |
| `layout/navigation.test.ts`             |    14 | Menü je Rolle, aktive Route (nur der genaueste Menüpunkt), sichere `next`-Weiterleitung, Initialen; Menüpunkt „Meldungen“ mit Zähler offener Meldungen |
| `layout/no-hardcoded-colors.test.ts`    |     1 | Farben nur in `tokens.css` (Grundlage für hell/dunkel)                                         |
| `layout/routes.test.ts`                 |     2 | Routentabelle                                                                                  |
| `logger/redaction.test.ts`              |     1 | Maskierung von Passwort, Token, Cookie, Links im Log                                           |
| `notifications/validation.test.ts`      |     3 | Schemas für Liste (Cursor) und „gelesen“                                                       |
| `org/validation.test.ts`                |     4 | Schemas Abteilung, Team, Stellenrolle (Abteilung oder unternehmensweit)                        |
| `plans/progress.test.ts`                |     3 | Fortschrittsberechnung (Prozent, leerer Plan)                                                  |
| `search/highlight.test.ts`              |     7 | Aufbereitung der Treffer-Hervorhebung, Suchschema                                              |
| `templates/validation.test.ts`          |     6 | Schemas Vorlagen und Schritte                                                                  |
| `users/validation.test.ts`              |    10 | Schemas Benutzer anlegen/ändern, Pflichtfelder je Rolle, Filter                                |
| `validation/common.test.ts`             |     3 | gemeinsame Schemas (IDs, Passwort)                                                             |
| `validation/feedback.test.ts`           |     8 | **v1.1:** Schemas für Meldungen: Längen, Arten, Status, sichere Pfade, leere Antwortnotiz      |

### 2.2 Integrationstests (`tests/integration`)

| Datei                                    | Tests | Inhalt                                                                                                                                       |
| ---------------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `foundation/auth.test.ts`                |     6 | Anmeldung des Admins, gesperrte Person kann sich nicht anmelden, Sitzung endet beim Löschen der Zeile, deaktivierte Better-Auth-Endpunkte (404) |
| `foundation/schema.test.ts`              |    11 | Datenbank-Constraints: Eindeutigkeit, keine Selbstleitung, eine Sperre je Seite, Volltextvektoren, Sprachvarianten, Zeitraum, Deduplizierung, Kaskade |
| `auth/invitations.test.ts`               |    13 | Einladung: Token nur als Hash, einmalige Annahme, Ablauf, Widerruf, Sitzungsende, Mail in Nutzersprache, erneutes Senden, Einladungsstatus  |
| `auth/reset-password.test.ts`            |     7 | Passwort vergessen: lokalisierte Mail, 1 h Gültigkeit, Abschluss; keine Mail an gesperrte, archivierte, unbekannte oder noch nicht eingeladene Personen |
| `auth/roles.test.ts`                     |     2 | Admin-only-Pfade in Services; eigene Benachrichtigungen für jede Rolle                                                                      |
| `org/org.test.ts`                        |    17 | Abteilungen, Teams, Stellenrollen: CRUD, Eindeutigkeit, Löschen nur ohne Verwendung, Team verschieben, Rechte                              |
| `org/job-role-department.test.ts`        |    15 | **v1.1:** Stellenrollen mit/ohne Abteilung, gleicher Name in zwei Abteilungen, Umhängen mit `IN_USE`-Liste, Abteilung mit Rollen nicht löschbar, Team verschieben, Passung bei Vorlagen und Personen |
| `users/users.test.ts`                    |    23 | Benutzer anlegen (Einladung, Benachrichtigung der Teamleitung), ändern, Leitungszyklus, Schutz des letzten Admins, E-Mail-Sperre nach Annahme |
| `users/lifecycle.test.ts`                |    12 | Deaktivieren (Sitzungen, Sperren, Einladungen), Reaktivieren, endgültig Löschen inkl. Benachrichtigungen, Rechte                           |
| `content/modules.test.ts`                |     9 | Module: Anlegen, Sortieren, Löschen nur ohne Seiten, Rechte, Leserechte der Teamleitung                                                     |
| `content/lead-modules.test.ts`           |    12 | **v1.1:** Module der Teamleitung: Abteilung wird gesetzt, Umbenennen/Löschen nur eigene Abteilung, `FORBIDDEN`/`NOT_FOUND`, Abteilung und Reihenfolge nur Admin, Zugriffsverlust nach Umhängen, Module als Verwendung der Abteilung |
| `content/lead-pages.test.ts`             |    16 | **v1.1:** Seiten der Teamleitung: Anlegen, Bearbeiten, alle Statuswechsel, Sortieren/Verschieben, Ablehnung außerhalb der Abteilung, endgültiges Löschen nur Admin, Sperren zwischen Teamleitung und Admin, Bild-Upload, „Seite aktualisiert“ wie beim Admin |
| `content/pages.test.ts`                  |    48 | Seiten: Zustandsautomat, Speichern nur mit Sperre, Bereinigung, EN-Variante, Suchtext, Bildzugehörigkeit, Sortierung, Löschen oder Archivieren, Ansicht je Rolle mit Sprach-Fallback |
| `content/uploads.test.ts`                |    21 | Bild-Upload (Typ aus Bytes, Größe, Name), Auslieferung je Sichtbarkeit, Route Handler 401/403/404/413/415                                   |
| `content/locks.test.ts`                  |    19 | Bearbeitungssperre: Holen, Ablauf, gleichzeitiges Holen (genau einer gewinnt), Heartbeat, Freigabe, Übernahme, `LOCK_LOST`                 |
| `content/lock-routes.test.ts`            |     5 | Sperr-Routen: 401, 403 (Employee, fremder Origin), Heartbeat, Freigabe per Beacon, 400 bei ungültiger ID                                    |
| `visibility/visibility.test.ts`          |     5 | Sichtbarkeitsregel je Rolle; SQL-Bedingung und Einzelprüfung stimmen überein                                                                |
| `visibility/lead-visibility.test.ts`     |     9 | **v1.1:** Teamleitung sieht Entwürfe (und mit Option Archiv) der eigenen Abteilung in Bibliothek, Seitenansicht, Suche, Seitenauswahl und Planansicht, fremde nicht; Employees unverändert |
| `templates/templates.test.ts`            |    21 | Vorlagen: Geltungsbereich (Abteilung/„Alle“, Team, Stellenrolle), Schritte und Phasen, Sortierung, Archivieren/Löschen, Rechte             |
| `templates/lead-templates.test.ts`       |    15 | **v1.1:** Vorlagen der Teamleitung: feste Abteilung, `lead_managed`, Team-/Rollenprüfung, Verwalten nur eigener, Admin-Vorlagen nur lesbar, fremde Abteilungen `NOT_FOUND`, Regeln für Schrittseiten |
| `plans/assignment.test.ts`               |    22 | Zuweisung als Snapshot, Deduplizierung, Vorschläge passend zu Abteilung/Team/Rolle, Ergänzen/Entfernen, Zuständigkeit der Teamleitung, Planansichten |
| `plans/completion.test.ts`               |    14 | Erledigen/Zurücknehmen, Fortschritt nur aktiver Schritte, Onboarding-Abschluss mit Benachrichtigung, gleichzeitige Abschlüsse, Reaktivierung; Hinweis „Seit deinem Abschluss aktualisiert“ schließen (v1.1) |
| `plans/hooks.test.ts`                    |     6 | „Seite aktualisiert“ an Planinhaber, Neuberechnung bei Statuswechsel einer Seite                                                           |
| `dashboards/dashboards.test.ts`          |     8 | Team-Übersicht nur eigene Mitarbeitende, Admin-Übersicht mit Filtern, Zahlen identisch mit der Planansicht                                  |
| `events/events.test.ts`                  |    10 | Veranstaltungen: Rechte, CRUD, kommende/vergangene, Sprach-Fallback, Ankündigung an alle aktiven Personen mit Deduplizierung              |
| `notifications-core/core.test.ts`        |    13 | Erzeugen von Benachrichtigungen, Deduplizierung solange ungelesen, Empfängerermittlung, Kaskade                                            |
| `notifications-core/service.test.ts`     |     7 | Liste nur eigene Zeilen, Keyset-Paginierung, Aufbewahrung 90 Tage, gelesen markieren                                                        |
| `notifications/notifications.test.ts`    |     7 | Nur eigene Zeilen, Glocken-Vorschau, Paginierung bei gleichem Zeitstempel, Aufbewahrung, gelöschte Veranstaltung                           |
| `search/search.test.ts`                  |    10 | Volltextsuche nach Sichtbarkeit, deutsche Wortstammbildung, englische Inhalte, Ranking, Hervorhebung, Veranstaltungen, Sonderzeichen        |
| `profile/profile.test.ts`                |     4 | Sprache und Theme nur für die eigene Person                                                                                                 |
| `delivery/seed-demo.test.ts`             |     7 | Demo-Daten: alle Rollen und Zustände, zweisprachige Inhalte, Schutz vor erneutem Lauf und vor `--reset` in Produktion                       |
| `feedback/feedback.test.ts`              |    25 | **v1.1:** „Problem melden“: Validierung, Seite nur bei Sichtbarkeit, unsichere Pfade, Rate Limit (auch nebenläufig), Bereich je Rolle, Umhängen eines Moduls, Statusübergänge mit `resolved_at`/`handled_by`, Benachrichtigung bei „erledigt“ (nicht an gelöschte/archivierte Personen), Rollback, Aufbewahrung 180 Tage, Löschen nur Admin, Meldung bleibt beim Löschen der Person, Zähler offener Meldungen |

### 2.3 End-to-End-Tests (`tests/e2e`)

| Datei                           | Inhalt                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `smoke.spec.ts`                 | Die Anmeldeseite wird ohne Serverfehler ausgeliefert.                               |
| `employee-plan.spec.ts`         | Eine mitarbeitende Person öffnet ihren Plan und hakt einen Schritt ab.              |
| `admin-user-plan.spec.ts`       | Admin legt eine Person an und weist ihr eine Vorlage zu.                            |
| `event-announcement.spec.ts`    | Eine angekündigte Veranstaltung erscheint in der Benachrichtigungsglocke.           |

E2E-Tests starten einen eigenen Entwicklungsserver und laufen bewusst nur zu Phasenenden und vor der
Abgabe (lokal oder über den manuellen Workflow `.github/workflows/e2e.yml`). Für v1.1 wurden keine neuen
Browsertests ergänzt; die vorhandenen müssen weiterhin bestehen. Abschlusslauf von v1.1 am
16.11.2026 gegen einen Produktions-Build: 4 von 4 Tests bestanden, keine Anpassung nötig.
Die Geschäftslogik der neuen Funktionen ist vollständig durch die Integrationstests in Abschnitt 2.2
abgedeckt.

## 3. Zuordnung: geplanter Funktionsumfang → Tests

Die fünf Punkte des geplanten Funktionsumfangs aus dem Projektantrag und die Tests, die ihre Umsetzung
nachweisen:

| Funktionsumfang                                                                | Nachweisende Tests                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Benutzeranmeldung und Rechteprüfung                                         | `integration/foundation/auth`, `integration/auth/invitations`, `integration/auth/reset-password`, `integration/auth/roles`, `integration/users/lifecycle` (Deaktivierung beendet Sitzungen), `integration/visibility/visibility`, `integration/visibility/lead-visibility`, Rechte-Blöcke in `org`, `users`, `templates`, `events`, `content/*`; `unit/auth/permissions`, `unit/auth/content-access`, `unit/http/route`, `unit/layout/navigation`; E2E `smoke`, `employee-plan` |
| 2. Onboarding-Vorlagen je Abteilung und Rolle                                  | `integration/templates/templates` (Geltungsbereich Abteilung/Team/Stellenrolle, Schritte, Phasen), `integration/org/org` (Abteilungen, Teams, Stellenrollen), `integration/org/job-role-department` (Rollen je Abteilung), `integration/templates/lead-templates`, `integration/content/pages` und `content/modules` (Inhalte der Schritte), `unit/templates/validation`, `unit/org/validation`, `unit/domain/job-role-fit` |
| 3. Zuweisung an Mitarbeitende, individuelles Ergänzen und Entfernen            | `integration/plans/assignment` (Snapshot, Deduplizierung, Vorschläge, `addPlanStep`/`removePlanStep`, Zuständigkeit der Teamleitung); E2E `admin-user-plan`                                                                                                                                                                                                                |
| 4. Darstellung des Bearbeitungsstands                                          | `integration/plans/completion`, `integration/plans/hooks`, `integration/dashboards/dashboards`, `integration/plans/assignment` (Planansichten je Rolle); `unit/plans/progress`, `unit/domain/onboarding-status`, `unit/dashboards/summary`                                                                                                                                   |
| 5. Veranstaltungen und anwendungsinterne Benachrichtigung                      | `integration/events/events`, `integration/notifications-core/core`, `integration/notifications-core/service`, `integration/notifications/notifications`, `integration/plans/hooks` (`page_updated`), `integration/users/users` (`employee_assigned`), `integration/plans/completion` (`onboarding_completed`); `unit/events/validation`, `unit/notifications/validation`; E2E `event-announcement` |

Zusätzliche Funktionen über den Antrag hinaus:

| Zusatzfunktion                          | Nachweisende Tests                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Zweisprachige Inhalte und Oberfläche    | `integration/content/pages` (Fallback), `integration/events/events`, `unit/i18n/*`, `unit/domain/locale-content`      |
| Volltextsuche                           | `integration/search/search`, `unit/search/highlight`                                                                  |
| Bilder in Seiten                        | `integration/content/uploads`, `unit/content/local-disk-storage`, `unit/content/sanitize`                             |
| Einladungs- und Reset-Mails             | `integration/auth/invitations`, `integration/auth/reset-password`, `integration/users/users`                          |
| Hell-/Dunkelmodus, Profil               | `unit/layout/no-hardcoded-colors`, `integration/profile/profile`                                                      |
| Bearbeitungssperre                      | `integration/content/locks`, `integration/content/lock-routes`, `integration/content/pages` (Speichern nur mit Sperre) |
| Demo-Daten und Bereitstellung           | `integration/delivery/seed-demo`, `unit/delivery/*`                                                                   |

Erweiterungen und Zusatzfunktion von v1.1 (siehe `soll-ist-vergleich.md`, Abschnitt 3):

| Änderung                                        | Nachweisende Tests                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Abteilungsgebundene Stellenrollen               | `integration/org/job-role-department`, `unit/domain/job-role-fit`, `unit/org/validation`                              |
| Teamleitungen als Redakteure ihrer Abteilung    | `integration/content/lead-modules`, `integration/content/lead-pages`, `integration/visibility/lead-visibility`, `integration/templates/lead-templates`, `unit/auth/content-access`, `unit/auth/permissions`, `unit/layout/area-routes` |
| „Problem melden“                                | `integration/feedback/feedback`, `unit/validation/feedback`, `unit/layout/navigation` (Menüpunkt und Zähler)           |
| Hinweis „Seit deinem Abschluss aktualisiert“ schließen | `integration/plans/completion`                                                                                 |
| Zurück-Button, Hervorhebung in der Navigation   | `unit/layout/in-app-history`, `unit/layout/navigation`                                                                |
| Mauszeiger auf Bedienelementen                  | reine CSS-Regel ohne automatisierten Test; Nachweis durch Sichtkontrolle im Browser                                  |

## 4. Bewertung

Alle 680 automatisierten Unit- und Integrationstests (261 Unit-, 419 Integrationstests) sind bestanden;
Lint und Typprüfung sind ohne Befund. Jeder Punkt des geplanten Funktionsumfangs und jede Erweiterung
von v1.1 ist durch Integrationstests gegen eine echte PostgreSQL-Datenbank abgedeckt, einschließlich
Rechteprüfung, Nebenläufigkeit (gleichzeitige Meldungen, Sperren zwischen Teamleitung und Admin) und
Datenschutzregeln. Die vier E2E-Tests prüfen die kritischen Browserabläufe und bestehen im Abschlusslauf von v1.1
(4/4).
