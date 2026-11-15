# Berechtigungskonzept

Beschreibt das Rollenmodell und die Rechteprüfung, wie sie im Code umgesetzt sind. Maßgebliche Stellen:

- `src/server/auth/permissions.ts`: Rechte je Rolle (`PERMISSIONS`) und Bereichsprüfungen
  (`canManagePlanOf`, `canViewProgressOf`, `canAccessRoute`)
- `src/server/services/visibility.ts`: die einzige Sichtbarkeitsregel für Seiten (`visiblePagesCondition`)
- `src/server/services/*.ts`: jede Service-Funktion prüft ihre Rechte selbst
- `src/server/auth/actor.ts`, `guards.ts`, `src/proxy.ts`, `src/server/http/route.ts`: Anmeldung und Zugangsschutz

## 1. Grundsätze

1. **Prüfung im Service, nicht in der Oberfläche.** Jede Service-Funktion bekommt den angemeldeten
   Akteur (`Actor`: id, Rolle, Sprache) als ersten Parameter und ruft zuerst `assertPermission` bzw. eine
   Bereichsprüfung auf. Datenbankzugriffe gibt es nur in `src/server/services/*`. Menüs und
   Seitenschutz sind zusätzliche Komfort- und Sicherheitsschichten, ersetzen die Service-Prüfung aber nie.
2. **Genau eine Rolle je Person:** `admin`, `team_lead` oder `employee`. Was ein Teamleiter darf, darf
   ein Admin auch.
3. **Rolle wird bei jeder Anfrage frisch gelesen.** Better Auth liest die Benutzerzeile bei jedem Aufruf
   (Cookie-Cache bewusst aus). Eine gesperrte (`banned`) oder archivierte Person gilt sofort als nicht
   angemeldet (`getActor` liefert `null`).
4. **Nichts verraten.** Fremde Datensätze werden mit `NOT_FOUND` beantwortet, nicht mit `FORBIDDEN`,
   wenn schon die Existenz eine Information wäre (z. B. Mitarbeitende eines anderen Teamleiters,
   Entwürfe, Bilder fremder Seiten). Admin-Seiten liefern für andere Rollen 404.
5. **Nur eigene Daten:** Benachrichtigungen, Profil-Einstellungen und das Abhaken von Schritten
   wirken immer nur auf die eigene Person. Niemand kann Schritte für andere als erledigt markieren.

## 2. Rollenmodell

| Rolle       | Beschreibung                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `employee`  | Neue Mitarbeitende. Sehen den eigenen Plan, die darin enthaltenen veröffentlichten Seiten, Veranstaltungen und eigene Benachrichtigungen.                        |
| `team_lead` | Teamleitung. Zusätzlich: liest die Bibliothek (nur veröffentlichte Seiten), sieht und verwaltet die Pläne der Personen, deren `lead_id` auf sie zeigt. Kann selbst einen Onboarding-Plan haben. |
| `admin`     | Verwaltung. Darf alles: Inhalte, Vorlagen, Organisation, Benutzer, Veranstaltungen, alle Pläne und Fortschritte.                                                 |

Die Teamleitung einer Person (`users.lead_id`) muss ein nicht archivierter `team_lead` oder `admin` sein,
darf nicht die Person selbst sein und darf keinen Zyklus in der Leitungskette erzeugen
(`assertValidLeadInTx`, rekursive Abfrage).

## 3. Rechte je Rolle (`PERMISSIONS`)

| Recht                 | employee | team_lead | admin | Zusätzliche Bereichsprüfung                                    |
| --------------------- | :------: | :-------: | :---: | -------------------------------------------------------------- |
| `plan.viewOwn`        |    ✓     |     ✓     |   ✓   | nur der eigene Plan                                            |
| `plan.completeOwn`    |    ✓     |     ✓     |   ✓   | nur eigene, aktive Schritte (Seite veröffentlicht)             |
| `events.view`         |    ✓     |     ✓     |   ✓   | –                                                              |
| `library.read`        |    –     |     ✓     |   ✓   | Teamleiter nur veröffentlichte Seiten                          |
| `plan.manage`         |    –     |     ✓     |   ✓   | `canManagePlanOf`: Teamleiter nur eigene Mitarbeitende         |
| `progress.viewOthers` |    –     |     ✓     |   ✓   | `canViewProgressOf`: Teamleiter nur eigene Mitarbeitende       |
| `content.manage`      |    –     |     –     |   ✓   | Module, Seiten, Bilder, Bearbeitungssperren                    |
| `templates.manage`    |    –     |     –     |   ✓   | –                                                              |
| `org.manage`          |    –     |     –     |   ✓   | Abteilungen, Teams, Stellenrollen                              |
| `users.manage`        |    –     |     –     |   ✓   | auch Admin-Übersicht und Einladungen                           |
| `events.manage`       |    –     |     –     |   ✓   | Anlegen, Ändern, Löschen, Ankündigen                           |

Bereichsprüfungen:

- `canManagePlanOf(actor, target)`: Admin immer; Teamleiter nur, wenn `target.lead_id = actor.id`.
- `canViewProgressOf(actor, target)`: die Person selbst, Admin, oder der Teamleiter der Person.

## 4. Berechtigungsmatrix nach Funktionen

Spalten: E = employee, TL = team_lead, A = admin. „eigene MA“ = Personen, deren Teamleitung der Akteur ist.

### Anmeldung und Profil

| Funktion                                      | E   | TL  | A   | Umsetzung / Anmerkung                                                                                     |
| --------------------------------------------- | --- | --- | --- | --------------------------------------------------------------------------------------------------------- |
| Selbstregistrierung                           | –   | –   | –   | `disableSignUp`, Endpunkt `/sign-up/email` deaktiviert. Konten legt nur der Admin an.                     |
| Anmelden, Abmelden, Passwort vergessen        | ✓   | ✓   | ✓   | Better Auth, Rate Limit (Anmeldung 5/min, Reset 3/min). Reset-Mail nur an aktive Personen mit Passwort.   |
| Passwort über Einladungslink festlegen        | ✓   | ✓   | ✓   | öffentlich, nur mit gültigem Token (`acceptInvitation`)                                                   |
| Eigene Sprache und Theme ändern               | ✓   | ✓   | ✓   | `updateMyPreferences`, wirkt nur auf `actor.id`                                                           |
| Eigene Benachrichtigungen lesen, als gelesen markieren | ✓ | ✓ | ✓ | nur eigene Zeilen; fremde IDs ergeben `NOT_FOUND`                                                    |

### Plan und Fortschritt

| Funktion                                           | E         | TL                    | A    | Umsetzung / Anmerkung                                                                                                         |
| -------------------------------------------------- | --------- | --------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| Eigenen Plan sehen                                 | ✓         | ✓                     | ✓    | `getMyPlan`; nur aktive Schritte (Seite veröffentlicht)                                                                       |
| Eigenen Schritt erledigen / zurücknehmen           | ✓         | ✓                     | ✓    | `setStepCompletion`; nur eigener Plan, nur aktive Schritte                                                                    |
| Schritt für andere als erledigt markieren          | –         | –                     | –    | gibt es nicht                                                                                                                 |
| Plan einer anderen Person ansehen                  | –         | eigene MA             | alle | `getPlanForUser`; Teamleiter sehen nicht veröffentlichte Schritte nur als Status ohne Titel, Admins mit Titel                |
| Vorlagen zuweisen, Seite ergänzen, Schritt entfernen | –       | eigene MA             | alle | `assignTemplates`, `addPlanStep`, `removePlanStep`; fremde MA → `NOT_FOUND`, Employee → `FORBIDDEN`, archivierte Person → `INVALID_TRANSITION` |
| Nur veröffentlichte Seiten ergänzen                | –         | ✓                     | ✓    | Entwurf und nicht vorhandene Seite liefern dieselbe Meldung (Existenz eines Entwurfs bleibt verborgen)                        |
| Team-Übersicht (Fortschritt %, Start, letzte Aktivität) | –    | eigene MA             | eigene MA | `getTeamOverview`; nur nicht archivierte Personen mit `lead_id = actor.id`                                              |
| Admin-Übersicht aller Personen mit Filtern         | –         | –                     | ✓    | `getAdminOverview` (`users.manage`); archivierte nur mit Statusfilter „archiviert“                                            |
| Organisations-Optionen für Filter / Zuweisung      | –         | ✓                     | ✓    | `listOrgOptions` (`plan.manage`)                                                                                              |

### Inhalte

| Funktion                                        | E                         | TL                      | A                          | Umsetzung / Anmerkung                                                                            |
| ----------------------------------------------- | ------------------------- | ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| Seite lesen                                     | veröffentlicht + im eigenen Plan | alle veröffentlichten | Entwurf, veröffentlicht, archiviert (Vorschau) | `getPageForView` über `canViewPageInTx`; sonst `NOT_FOUND`                     |
| Bibliothek lesen (Module und Seiten)            | –                         | nur veröffentlichte     | alle Status, mit Filter    | `listLibrary`, `listModules`                                                                     |
| Seitenauswahl für Vorlagen / Pläne              | –                         | veröffentlichte         | Entwurf + veröffentlicht   | `listPagesForPicker`; archivierte Seiten werden nie angeboten                                    |
| Module und Seiten anlegen, sortieren, löschen   | –                         | –                       | ✓                          | `content.manage`                                                                                 |
| Seite bearbeiten und speichern                  | –                         | –                       | ✓                          | zusätzlich eigene, gültige Bearbeitungssperre nötig (`assertLockHeldInTx`), sonst `LOCK_LOST`    |
| Status ändern (veröffentlichen, archivieren …)  | –                         | –                       | ✓                          | `changePageStatus`                                                                               |
| Bild hochladen                                  | –                         | –                       | ✓                          | `uploadImage`; Typ aus den Magic Bytes (PNG, JPEG, WebP, GIF), max. 5 MB                         |
| Bild abrufen                                    | wenn Seite sichtbar       | wenn Seite sichtbar     | alle                       | `getImageForServing`; Bilder ohne Seite oder auf unsichtbaren Seiten → 404                       |
| Bearbeitungssperre holen, verlängern, freigeben, übernehmen | –             | –                       | ✓                          | `content.manage`; freigeben nur die eigene Sperre                                                |

### Verwaltung und Veranstaltungen

| Funktion                                               | E   | TL  | A   | Umsetzung / Anmerkung                                                                                       |
| ------------------------------------------------------ | --- | --- | --- | ----------------------------------------------------------------------------------------------------------- |
| Vorlagen und Vorlagenschritte verwalten                | –   | –   | ✓   | `templates.manage`                                                                                          |
| Abteilungen, Teams, Stellenrollen verwalten            | –   | –   | ✓   | `org.manage`; Löschen nur, wenn unbenutzt                                                                   |
| Benutzer anlegen, ändern, Einladung erneut senden      | –   | –   | ✓   | `users.manage`                                                                                              |
| Benutzer deaktivieren / reaktivieren / endgültig löschen | – | –   | ✓   | nicht sich selbst; letzter aktiver Admin geschützt; Löschen nur archivierter Personen, die niemanden mehr leiten |
| Veranstaltungen ansehen                                | ✓   | ✓   | ✓   | `events.view`                                                                                               |
| Veranstaltungen anlegen, ändern, löschen, ankündigen   | –   | –   | ✓   | `events.manage`                                                                                             |
| Suche                                                  | ✓   | ✓   | ✓   | `search` (`events.view`); Seitentreffer über `visiblePagesCondition`, Veranstaltungen für alle               |

## 5. Sichtbarkeitsregeln

### 5.1 Seiten

Eine einzige Regel (`visiblePagesCondition` in `visibility.ts`) wird von Seitenansicht, Bildern,
Seitenauswahl und Suche gemeinsam benutzt. Ein Integrationstest prüft, dass die SQL-Bedingung und die
Einzelprüfung `canViewPageInTx` auf denselben Daten übereinstimmen.

| Rolle       | sichtbare Seiten                                                                              |
| ----------- | --------------------------------------------------------------------------------------------- |
| `employee`  | Status `published` **und** Seite ist Schritt im eigenen Plan (`user_plan_steps`)              |
| `team_lead` | alle Seiten mit Status `published` (Bibliothek; eigene Planseiten sind darin enthalten)       |
| `admin`     | `draft` und `published`; `archived` nur mit Option `includeArchived` (Vorschau in der Ansicht) |

Die Option `includeArchived` wird für Nicht-Admins ignoriert.

### 5.2 Bilder

- Admins dürfen jedes Bild abrufen, auch von Entwürfen.
- Alle anderen nur, wenn sie die Seite sehen dürfen, zu der das Bild gehört (Regel 5.1). Bilder ohne
  Seite und Bilder unsichtbarer Seiten werden mit 404 beantwortet.
- Bilder werden nur über die geschützte Route `GET /api/uploads/{id}` ausgeliefert (Sitzung nötig,
  `Cache-Control: private`, `X-Content-Type-Options: nosniff`). Eine öffentliche URL gibt es nicht.
- Beim Speichern einer Seite dürfen nur Bilder dieser Seite im Inhalt vorkommen; fremde Bild-IDs werden
  abgelehnt.

### 5.3 Pläne

- **Eigener Plan:** Nur aktive Schritte (Seite `published`) erscheinen und zählen für den Fortschritt.
  Schritte auf Entwürfen oder archivierten Seiten bleiben im Plan gespeichert, sind aber unsichtbar.
- **Teamleiter:** sieht die Pläne der eigenen Mitarbeitenden vollständig. Schritte auf nicht
  veröffentlichten Seiten erscheinen nur als Statuskennzeichen ohne Titel, weil Teamleiter Entwürfe auch
  in der Bibliothek nicht lesen dürfen.
- **Admin:** sieht alle Pläne mit Titel und Status jedes Schritts.
- Fremde Pläne: Ein Teamleiter erhält für Personen, die er nicht leitet, `NOT_FOUND`; ein Employee
  erreicht die Funktionen gar nicht (`FORBIDDEN`). Auch ein Teamleiter, dessen eigene Teamleitung jemand
  anderes ist, kann von einem gleichrangigen Teamleiter nicht verwaltet werden.
- Archivierte Personen erscheinen nicht in der Team-Übersicht; ihre Pläne können nicht mehr verändert werden.

### 5.4 Benachrichtigungen und Veranstaltungen

- Benachrichtigungen sind strikt personenbezogen: Lesen, Zählen und Markieren betrifft nur Zeilen mit
  `user_id = actor.id`.
- Veranstaltungen sind für alle angemeldeten Personen sichtbar. Ankündigungen erreichen alle nicht
  archivierten Personen.

## 6. Schutzschichten einer Anfrage

| Schicht                    | Ort                                   | Wirkung                                                                                                                                                                                  |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Proxy (optimistisch)    | `src/proxy.ts`                        | Ohne Sitzungs-Cookie wird jede App-Seite auf `/login?next=…` umgeleitet. Prüft keine Rollen.                                                                                              |
| 2. Layout / Seite          | `requirePageActor`, `requirePageRole` | Prüft die Sitzung gegen die Datenbank. `/admin/**` nur Admin, `/team/**` und `/library/**` nur Teamleiter und Admin (`ROUTE_ACCESS`); andere Rollen erhalten 404.                         |
| 3. Navigation              | `NAVIGATION` in `src/config/app.ts`   | Menüpunkte je Rolle. Reine Darstellung, keine Sicherheitsfunktion.                                                                                                                       |
| 4. Server Action / Route   | `runAction`, `withActor`              | Ermittelt den Akteur, ohne Sitzung `UNAUTHENTICATED` (401). Route-Handler mit schreibenden Methoden prüfen zusätzlich den `Origin`-Header gegen `APP_URL` (CSRF-Schutz, sonst 403).       |
| 5. Service                 | `assertPermission`, Bereichsprüfungen | Die maßgebliche Prüfung: Rolle, Zuständigkeit (Teamleitung), Sichtbarkeit, Zustand des Datensatzes.                                                                                       |
| 6. Datenbank               | Constraints, Zeilensperren            | Eindeutigkeit, CHECK-Bedingungen, Fremdschlüssel, `FOR UPDATE`-Sperren gegen nebenläufige Änderungen (z. B. letzter Admin).                                                              |

Abgeschaltete Better-Auth-Endpunkte: Das `admin`-Plugin wird nur für die Sperrprüfung beim Anmelden
verwendet. Alle seine Endpunkte (`/admin/*`) sowie Endpunkte, die die Services umgehen würden
(z. B. `/update-user`, `/delete-user`, `/change-email`, `/sign-up/email`), antworten mit 404.

## 7. Schutzregeln für Administratoren und Konten

- Der letzte aktive Admin kann weder deaktiviert noch zum Teamleiter / Employee herabgestuft werden
  (`LAST_ADMIN`). Zwei gleichzeitige Versuche werden über Zeilensperren serialisiert; genau einer gelingt.
- Ein Admin kann sich nicht selbst deaktivieren.
- Wer noch Personen leitet (auch archivierte), kann nicht zum Employee herabgestuft und nicht endgültig
  gelöscht werden (`IN_USE`). Deaktivieren ist möglich; die Bestätigung listet die betroffenen Personen.
- Archivierte Personen können nicht bearbeitet werden; sie müssen zuerst reaktiviert werden.
- Die E-Mail-Adresse ist nach Annahme der Einladung gesperrt. Davor löst eine Änderung eine neue
  Einladung an die neue Adresse aus.
- Deaktivierung löscht sofort alle Sitzungen, widerruft offene Einladungen und gibt gehaltene
  Bearbeitungssperren frei.

## 8. Nachweis durch Tests

| Thema                                              | Testdatei(en)                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Rechtetabelle, Routenzugang je Rolle               | `tests/unit/auth/permissions.test.ts`, `tests/unit/layout/navigation.test.ts`                     |
| Admin-only-Pfade in Services                       | `tests/integration/auth/roles.test.ts`, `*/authorization`-Blöcke in org, users, templates, events |
| Sichtbarkeit von Seiten                            | `tests/integration/visibility/visibility.test.ts`, `tests/integration/content/pages.test.ts`      |
| Sichtbarkeit von Bildern, 401/403/404 der Routen   | `tests/integration/content/uploads.test.ts`, `tests/integration/content/lock-routes.test.ts`      |
| Zuständigkeit der Teamleitung für Pläne            | `tests/integration/plans/assignment.test.ts`, `tests/integration/dashboards/dashboards.test.ts`   |
| Suche respektiert Sichtbarkeit                     | `tests/integration/search/search.test.ts`                                                         |
| Origin-Prüfung, 401 ohne Sitzung                   | `tests/unit/http/route.test.ts`                                                                   |
| Deaktivierung, letzter Admin, Abschaltung von Endpunkten | `tests/integration/users/lifecycle.test.ts`, `tests/integration/users/users.test.ts`, `tests/integration/foundation/auth.test.ts` |
