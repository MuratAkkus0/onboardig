# Berechtigungskonzept

Beschreibt das Rollenmodell und die Rechteprüfung, wie sie im Code umgesetzt sind (Stand v1.1).
Maßgebliche Stellen:

- `src/server/auth/permissions.ts`: Rechte je Rolle (`PERMISSIONS`) und Bereichsprüfungen
  (`canManagePlanOf`, `canViewProgressOf`, `canAccessRoute`)
- `src/server/services/visibility.ts`: die einzige Sichtbarkeitsregel für Seiten (`visiblePagesCondition`)
- `src/server/services/content-access.ts`: Redaktionsbereich je Person (`editorDepartmentIdInTx`) und
  Bearbeitungsrechte an Modulen, Seiten und Vorlagen (`canEditModule`, `canEditPage`, `canViewTemplate`,
  `canManageTemplate`, `assertCanEditPageInTx`)
- `src/server/services/feedback.ts`: Zuständigkeitsbereich für Meldungen („Problem melden“)
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
   Entwürfe, Bilder fremder Seiten). Abgesehen von fehlenden Rollenrechten gibt es `FORBIDDEN` nur,
   wenn die Person den Datensatz ohnehin sehen darf, ihn aber nicht ändern darf (Regeln in Abschnitt 6). Admin-Seiten liefern für andere Rollen 404.
5. **Nur eigene Daten:** Benachrichtigungen, Profil-Einstellungen und das Abhaken von Schritten
   wirken immer nur auf die eigene Person. Niemand kann Schritte für andere als erledigt markieren.

## 2. Rollenmodell

| Rolle       | Beschreibung                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `employee`  | Neue Mitarbeitende. Sehen den eigenen Plan, die darin enthaltenen veröffentlichten Seiten, Veranstaltungen und eigene Benachrichtigungen.                        |
| `team_lead` | Teamleitung. Zusätzlich: liest die Bibliothek, sieht und verwaltet die Pläne der Personen, deren `lead_id` auf sie zeigt. Seit v1.1 außerdem **Redakteur der eigenen Abteilung**: pflegt Module, Seiten und Bilder der Module ihrer Abteilung, legt Vorlagen für ihre Abteilung an und bearbeitet Inhaltsmeldungen zu Seiten ihrer Abteilung. Kann selbst einen Onboarding-Plan haben. |
| `admin`     | Verwaltung. Darf alles: Inhalte (auch unternehmensweite Module), Vorlagen, Organisation, Benutzer, Veranstaltungen, alle Pläne, Fortschritte und Meldungen. In der Oberfläche heißt die Rolle weiterhin „Admin“. |

Die Teamleitung einer Person (`users.lead_id`) muss ein nicht archivierter `team_lead` oder `admin` sein,
darf nicht die Person selbst sein und darf keinen Zyklus in der Leitungskette erzeugen
(`assertValidLeadInTx`, rekursive Abfrage).

**Abteilung einer Teamleitung:** Die Abteilung, für die eine Teamleitung redaktionell zuständig ist, ergibt
sich aus ihrem eigenen Team (`users.team_id` → `teams.department_id`). Sie wird bei jeder Prüfung in
derselben Transaktion wie die Änderung aus der Datenbank gelesen (`editorDepartmentIdInTx`); der
angemeldete `Actor` bleibt unverändert. Eine Teamleitung ohne Team ist keine Redakteurin: Sie bearbeitet
keine Inhalte, legt keine Vorlagen an und sieht keine Meldungen.

## 3. Rechte je Rolle (`PERMISSIONS`)

| Recht                 | employee | team_lead | admin | Zusätzliche Bereichsprüfung                                    |
| --------------------- | :------: | :-------: | :---: | -------------------------------------------------------------- |
| `plan.viewOwn`        |    ✓     |     ✓     |   ✓   | nur der eigene Plan                                            |
| `plan.completeOwn`    |    ✓     |     ✓     |   ✓   | nur eigene, aktive Schritte (Seite veröffentlicht)             |
| `events.view`         |    ✓     |     ✓     |   ✓   | –                                                              |
| `library.read`        |    –     |     ✓     |   ✓   | Teamleiter: veröffentlichte Seiten, dazu Entwürfe und Archiv der eigenen Abteilung |
| `plan.manage`         |    –     |     ✓     |   ✓   | `canManagePlanOf`: Teamleiter nur eigene Mitarbeitende         |
| `progress.viewOthers` |    –     |     ✓     |   ✓   | `canViewProgressOf`: Teamleiter nur eigene Mitarbeitende       |
| `content.edit`        |    –     |     ✓     |   ✓   | Module, Seiten, Bilder, Bearbeitungssperren; Teamleiter nur in Modulen der eigenen Abteilung (`canEditModule`) |
| `content.manage`      |    –     |     –     |   ✓   | nur Admin-Operationen: Modulreihenfolge, Abteilung eines Moduls, endgültiges Löschen von Seiten |
| `templates.edit`      |    –     |     ✓     |   ✓   | Teamleiter: Vorlagen anlegen (eigene Abteilung), nur `lead_managed`-Vorlagen der eigenen Abteilung ändern (`canManageTemplate`) |
| `templates.manage`    |    –     |     –     |   ✓   | Admin-Verwaltung aller Vorlagen                                |
| `org.manage`          |    –     |     –     |   ✓   | Abteilungen, Teams, Stellenrollen                              |
| `users.manage`        |    –     |     –     |   ✓   | auch Admin-Übersicht und Einladungen                           |
| `events.manage`       |    –     |     –     |   ✓   | Anlegen, Ändern, Löschen, Ankündigen                           |
| `feedback.create`     |    ✓     |     ✓     |   ✓   | „Problem melden“; höchstens 5 Meldungen je Person und Stunde   |
| `feedback.manage`     |    –     |     ✓     |   ✓   | Meldungen bearbeiten; Teamleiter nur Inhaltsmeldungen zu Seiten der eigenen Abteilung; Löschen nur Admin |

Bereichsprüfungen:

- `canManagePlanOf(actor, target)`: Admin immer; Teamleiter nur, wenn `target.lead_id = actor.id`.
- `canViewProgressOf(actor, target)`: die Person selbst, Admin, oder der Teamleiter der Person.
- `editorDepartmentIdInTx(tx, actor)`: Admin → `"all"`, Teamleiter → Abteilung des eigenen Teams (ohne
  Team `null`), Employee → `null`.
- `canEditModule(editor, module)` / `canEditPage`: Admin immer; Teamleiter nur, wenn das Modul (bzw. das
  Modul der Seite) einer Abteilung gehört und diese seine Abteilung ist. Unternehmensweite Module
  (`department_id = NULL`) pflegt nur der Admin. Die Prüfung sperrt die Modulzeile (`FOR SHARE`), damit
  ein gleichzeitiges Umhängen des Moduls in eine andere Abteilung durch den Admin sauber serialisiert wird.
- `canViewTemplate(editor, template)`: Admin alle; Teamleiter unternehmensweite Vorlagen und Vorlagen der
  eigenen Abteilung.
- `canManageTemplate(editor, template)`: Admin alle; Teamleiter nur Vorlagen mit `lead_managed = true`
  und `department_id` = eigene Abteilung. Bearbeitet der Admin eine solche Vorlage, bleibt
  `lead_managed` erhalten.
- Meldungsbereich (`scopeCondition` in `feedback.ts`): Admin alle Meldungen; Teamleiter nur Meldungen
  der Art „Inhalt falsch oder veraltet“ (`content_issue`), deren verknüpfte Seite in einem Modul seiner
  Abteilung liegt. Die Zuordnung wird bei jeder Abfrage neu ermittelt; wechselt ein Modul die Abteilung,
  wandern die Meldungen mit.

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
| Plan einer anderen Person ansehen                  | –         | eigene MA             | alle | `getPlanForUser`; Teamleiter sehen nicht veröffentlichte Schritte nur als Status ohne Titel (außer Seiten der eigenen Abteilung), Admins mit Titel |
| Vorlagen zuweisen, Seite ergänzen, Schritt entfernen | –       | eigene MA             | alle | `assignTemplates`, `addPlanStep`, `removePlanStep`; fremde MA → `NOT_FOUND`, Employee → `FORBIDDEN`, archivierte Person → `INVALID_TRANSITION` |
| Nur veröffentlichte Seiten ergänzen                | –         | ✓                     | ✓    | Entwurf und nicht vorhandene Seite liefern dieselbe Meldung (Existenz eines Entwurfs bleibt verborgen)                        |
| Team-Übersicht (Fortschritt %, Start, letzte Aktivität) | –    | eigene MA             | eigene MA | `getTeamOverview`; nur nicht archivierte Personen mit `lead_id = actor.id`                                              |
| Admin-Übersicht aller Personen mit Filtern         | –         | –                     | ✓    | `getAdminOverview` (`users.manage`); archivierte nur mit Statusfilter „archiviert“                                            |
| Organisations-Optionen für Filter / Zuweisung      | –         | ✓                     | ✓    | `listOrgOptions` (`plan.manage`)                                                                                              |

### Inhalte

„eig. Abt.“ = Module, deren Eigentümer-Abteilung die Abteilung der Teamleitung ist. Fremde und
unternehmensweite Module sind für Teamleitungen nur lesbar (veröffentlichte Seiten).

| Funktion                                        | E                         | TL                      | A                          | Umsetzung / Anmerkung                                                                            |
| ----------------------------------------------- | ------------------------- | ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| Seite lesen                                     | veröffentlicht + im eigenen Plan | alle veröffentlichten; Entwurf und Archiv nur eig. Abt. | Entwurf, veröffentlicht, archiviert (Vorschau) | `getPageForView` über `canViewPageInTx`; sonst `NOT_FOUND`                     |
| Bibliothek lesen (Module und Seiten)            | –                         | veröffentlichte; eig. Abt. alle Status | alle Status, mit Filter    | `listLibrary`, `listModules`; Module zeigen die Eigentümer-Abteilung und ob sie bearbeitbar sind |
| Seitenauswahl für Vorlagen                      | –                         | veröffentlichte + Entwürfe eig. Abt. | Entwurf + veröffentlicht   | `listPagesForPicker`; archivierte Seiten werden nie angeboten                                    |
| Modul anlegen                                   | –                         | eig. Abt. (Abteilung wird gesetzt) | ✓ (beliebige Abteilung oder unternehmensweit) | `createModule` (`content.edit`); nennt ein Teamleiter ausdrücklich eine andere Abteilung → `FORBIDDEN` |
| Modul umbenennen, leeres Modul löschen          | –                         | eig. Abt.               | ✓                          | `updateModule`, `deleteModule`; Löschen nur ohne Seiten                                          |
| Abteilung eines Moduls festlegen oder ändern    | –                         | –                       | ✓                          | `content.manage`                                                                                 |
| Modulreihenfolge (globale Sortierung)           | –                         | –                       | ✓                          | `moveModule` (`content.manage`)                                                                  |
| Seite anlegen, bearbeiten und speichern         | –                         | eig. Abt.               | ✓                          | `createPage`, `getPageForEdit`, `savePageContent`; zusätzlich eigene, gültige Bearbeitungssperre nötig (`assertLockHeldInTx`), sonst `LOCK_LOST` |
| Status ändern (veröffentlichen, zurückziehen, archivieren, wiederherstellen) | – | eig. Abt., direkt ohne Freigabe | ✓      | `changePageStatus`; dieselben Benachrichtigungen wie bei Admin-Änderungen                        |
| Seite im Modul sortieren, in anderes Modul verschieben | –                  | eig. Abt. (Quelle **und** Ziel) | ✓                  | `movePage`, `movePageToModule`                                                                   |
| Seite endgültig löschen                         | –                         | –                       | ✓                          | `deletePage` (`content.manage`); Teamleitungen archivieren stattdessen. Auswirkung anzeigen (`getPageDeletionImpact`) dürfen sie |
| Bild hochladen                                  | –                         | eig. Abt.               | ✓                          | `uploadImage`; Seite muss bearbeitbar sein. Typ aus den Magic Bytes (PNG, JPEG, WebP, GIF), max. 5 MB |
| Bild abrufen                                    | wenn Seite sichtbar       | wenn Seite sichtbar     | alle                       | `getImageForServing`; Bilder ohne Seite oder auf unsichtbaren Seiten → 404                       |
| Bearbeitungssperre holen, verlängern, freigeben, übernehmen | –             | eig. Abt.               | ✓                          | `content.edit` + `assertCanEditPageInTx`; freigeben nur die eigene Sperre. Teamleitung und Admin können sich gegenseitig ablösen; der Hinweis nennt den Namen der haltenden Person unabhängig von der Rolle |

Einen Freigabe-Workflow (Vier-Augen-Prinzip) gibt es nicht: Teamleitungen veröffentlichen direkt. Er ist
für Version 2 vorgesehen.

### Vorlagen

| Funktion                                               | E   | TL                                    | A   | Umsetzung / Anmerkung                                                                                       |
| ------------------------------------------------------ | --- | ------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------- |
| Vorlagenliste und -details ansehen                     | –   | unternehmensweite + eigene Abteilung  | ✓   | `listTemplates` liefert je Vorlage `canManage`; Vorlagen anderer Abteilungen → `NOT_FOUND`. Schritte auf Seiten, die die Teamleitung nicht sehen darf, erscheinen ohne Titel („Seite nicht sichtbar“) |
| Vorlage anlegen                                        | –   | ✓ (Abteilung = eigene, fest)          | ✓   | `createTemplate` (`templates.edit`); Team leer oder Team der eigenen Abteilung, Stellenrolle muss passen; „Alle“ (unternehmensweit) nicht wählbar; ohne Team → `FORBIDDEN`; setzt `lead_managed = true` |
| Vorlage ändern, archivieren, wiederherstellen, löschen; Schritte verwalten | – | nur `lead_managed` der eigenen Abteilung | ✓ | Abteilung der Vorlage nicht änderbar. Vom Admin angelegte und unternehmensweite Vorlagen sind für Teamleitungen nur lesbar (`FORBIDDEN`) |
| Seiten als Vorlagenschritt wählen                      | –   | veröffentlichte jeder Abteilung + Entwürfe der eigenen | Entwurf + veröffentlicht | archivierte Seiten nie                                                                    |
| Vorlagen zuweisen                                      | –   | eigene MA                             | alle | unverändert (`listAssignableTemplates`, `assignTemplates`)                                                  |

### Verwaltung und Veranstaltungen

| Funktion                                               | E   | TL  | A   | Umsetzung / Anmerkung                                                                                       |
| ------------------------------------------------------ | --- | --- | --- | ----------------------------------------------------------------------------------------------------------- |
| Abteilungen, Teams, Stellenrollen verwalten            | –   | –   | ✓   | `org.manage`; Löschen nur, wenn unbenutzt (Stellenrollen und Module zählen als Verwendung einer Abteilung). Abteilung einer Stellenrolle ändern → `IN_USE` mit Liste der nicht mehr passenden Vorlagen und Personen; „unternehmensweit“ ist immer erlaubt |
| Benutzer anlegen, ändern, Einladung erneut senden      | –   | –   | ✓   | `users.manage`; Stellenrolle muss zur Abteilung des Teams passen (`VALIDATION`)                             |
| Benutzer deaktivieren / reaktivieren / endgültig löschen | – | –   | ✓   | nicht sich selbst; letzter aktiver Admin geschützt; Löschen nur archivierter Personen, die niemanden mehr leiten |
| Veranstaltungen ansehen                                | ✓   | ✓   | ✓   | `events.view`                                                                                               |
| Veranstaltungen anlegen, ändern, löschen, ankündigen   | –   | –   | ✓   | `events.manage`                                                                                             |
| Suche                                                  | ✓   | ✓   | ✓   | `search` (`events.view`); Seitentreffer über `visiblePagesCondition` (ohne Archiv), Veranstaltungen für alle |

### Meldungen („Problem melden“)

| Funktion                                               | E   | TL                                         | A   | Umsetzung / Anmerkung                                                                                       |
| ------------------------------------------------------ | --- | ------------------------------------------ | --- | ----------------------------------------------------------------------------------------------------------- |
| Problem melden                                         | ✓   | ✓                                          | ✓   | `createReport` (`feedback.create`); max. 5 je Person in einer rollierenden Stunde, sonst `RATE_LIMITED` (HTTP 429). Die Seite wird nur verknüpft, wenn die meldende Person sie sehen darf |
| Meldungen auflisten, Anzahl offener Meldungen          | –   | Inhaltsmeldungen zu Seiten der eigenen Abteilung | alle | `listReports`, `countOpenReports` (`feedback.manage`); Employee → `FORBIDDEN`; Teamleitung ohne Team sieht nichts |
| Status ändern, Antwortnotiz schreiben                  | –   | wie Auflisten                              | alle | `updateReport`; Meldung außerhalb des Bereichs → `NOT_FOUND`                                                 |
| Meldung löschen                                        | –   | –                                          | ✓   | `deleteReport`; Teamleitung → `FORBIDDEN`                                                                   |

Meldungen ohne verknüpfte Seite (auch nach Löschen der Seite) sowie Meldungen der Arten „Fehler in der
App“ und „Sonstiges“ sieht nur der Admin. Eine eigene Liste „Meine Meldungen“ gibt es in v1.1 nicht; die
meldende Person erfährt die Erledigung über eine Benachrichtigung.

## 5. Sichtbarkeitsregeln

### 5.1 Seiten

Eine einzige Regel (`visiblePagesCondition` in `visibility.ts`) wird von Seitenansicht, Bildern,
Seitenauswahl und Suche gemeinsam benutzt. Ein Integrationstest prüft, dass die SQL-Bedingung und die
Einzelprüfung `canViewPageInTx` auf denselben Daten übereinstimmen.

| Rolle       | sichtbare Seiten                                                                              |
| ----------- | --------------------------------------------------------------------------------------------- |
| `employee`  | Status `published` **und** Seite ist Schritt im eigenen Plan (`user_plan_steps`)              |
| `team_lead` | alle Seiten mit Status `published` (Bibliothek; eigene Planseiten sind darin enthalten), **dazu** `draft` der Module der eigenen Abteilung; `archived` der eigenen Abteilung nur mit `includeArchived` |
| `admin`     | `draft` und `published`; `archived` nur mit Option `includeArchived` (Vorschau in der Ansicht) |

Für Employees wird `includeArchived` ignoriert. Die Erweiterung für Teamleitungen ist eine SQL-Unterabfrage
über Modul, Team und Person (kein zusätzlicher Datenbankaufruf). Weil Seitenansicht, Bilder, Suche,
Seitenauswahl und Planansicht dieselbe Regel nutzen, gilt die Erweiterung dort automatisch. Suche und
Seitenauswahl fragen ohne `includeArchived` ab und zeigen daher nie archivierte Seiten.

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
  veröffentlichten Seiten der eigenen Abteilung erscheinen mit Titel; die übrigen nur als
  Statuskennzeichen ohne Titel, weil Teamleiter fremde Entwürfe auch in der Bibliothek nicht lesen dürfen.
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

### 5.5 Meldungen

- Melden darf jede angemeldete Person. Gespeichert werden Art, Betreff, Beschreibung, der App-Pfad
  (gleiche Herkunft, über `safeNextPath` geprüft) und ggf. die Seite. Die Seite wird nur aus einem Pfad
  `/pages/<id>` abgeleitet und nur, wenn die meldende Person sie in diesem Moment sehen darf; so kann über
  eine Meldung kein Entwurf „angehängt“ und damit seine Existenz geprüft werden.
- Bearbeiten: Admin alle; Teamleitung nur Inhaltsmeldungen, deren Seite in einem Modul ihrer Abteilung
  liegt. Die Navigation zeigt der jeweiligen Person die Zahl der offenen Meldungen in ihrem Bereich.
- Bei jedem Übergang nach „erledigt“ erhält die meldende Person eine Benachrichtigung (mit Antwortnotiz),
  sofern sie noch existiert und nicht archiviert ist.

## 6. `NOT_FOUND` oder `FORBIDDEN`?

| Situation                                                                                         | Antwort      |
| ------------------------------------------------------------------------------------------------- | ------------ |
| Rolle hat das Recht gar nicht (z. B. Employee ruft eine Redaktions- oder Meldungsfunktion auf)    | `FORBIDDEN`  |
| Teamleitung, fremdes Modul / fremde Seite, die sie **sehen** darf (z. B. veröffentlicht, unternehmensweit) | `FORBIDDEN`  |
| Teamleitung, fremdes Modul / fremde Seite, die sie **nicht sehen** darf (Entwurf oder Archiv einer anderen Abteilung) | `NOT_FOUND` |
| Ein Modul gilt als sichtbar, wenn es mindestens eine für die Person sichtbare Seite enthält       | –            |
| Teamleitung, sichtbare, aber nicht verwaltbare Vorlage (Admin-Vorlage, unternehmensweit)          | `FORBIDDEN`  |
| Teamleitung, Vorlage einer anderen Abteilung                                                      | `NOT_FOUND`  |
| Teamleitung nennt beim Anlegen/Ändern von Modul oder Vorlage ausdrücklich eine andere Abteilung   | `FORBIDDEN` (wird nicht stillschweigend korrigiert) |
| Teamleitung ohne Team legt eine Vorlage an                                                        | `FORBIDDEN`  |
| Teamleitung, Meldung außerhalb ihres Bereichs (Status ändern)                                     | `NOT_FOUND`  |
| Teamleitung löscht eine Meldung                                                                   | `FORBIDDEN`  |
| Teamleitung, Plan einer Person, die sie nicht leitet                                              | `NOT_FOUND`  |
| Nicht vorhandene ID                                                                               | `NOT_FOUND`  |

In der Oberfläche führt der Aufruf des Editors für eine nicht bearbeitbare Seite auf die 404-Seite.

## 7. Schutzschichten einer Anfrage

| Schicht                    | Ort                                   | Wirkung                                                                                                                                                                                  |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Proxy (optimistisch)    | `src/proxy.ts`                        | Ohne Sitzungs-Cookie wird jede App-Seite auf `/login?next=…` umgeleitet. Prüft keine Rollen.                                                                                              |
| 2. Layout / Seite          | `requirePageActor`, `requirePageRole` | Prüft die Sitzung gegen die Datenbank. `/admin/**` nur Admin, `/team/**`, `/library/**`, `/templates/**` und `/reports/**` nur Teamleiter und Admin (`ROUTE_ACCESS`); andere Rollen erhalten 404. Öffnet ein Admin die Bibliothek oder Vorlagen der Teamleitung (`/library`, `/templates`), wird er auf die entsprechende Admin-Seite umgeleitet. |
| 3. Navigation              | `NAVIGATION` in `src/config/app.ts`   | Menüpunkte je Rolle (Teamleitung: u. a. „Bibliothek“, „Vorlagen“, „Meldungen“; Admin: „Meldungen“ unter „Verwaltung“) mit Zähler offener Meldungen. „Problem melden“ für alle. Reine Darstellung, keine Sicherheitsfunktion. |
| 4. Server Action / Route   | `runAction`, `withActor`              | Ermittelt den Akteur, ohne Sitzung `UNAUTHENTICATED` (401). Route-Handler mit schreibenden Methoden prüfen zusätzlich den `Origin`-Header gegen `APP_URL` (CSRF-Schutz, sonst 403).       |
| 5. Service                 | `assertPermission`, Bereichsprüfungen | Die maßgebliche Prüfung: Rolle, Zuständigkeit (Teamleitung), Sichtbarkeit, Zustand des Datensatzes.                                                                                       |
| 6. Datenbank               | Constraints, Zeilensperren            | Eindeutigkeit, CHECK-Bedingungen, Fremdschlüssel, `FOR UPDATE`-Sperren gegen nebenläufige Änderungen (z. B. letzter Admin).                                                              |

Abgeschaltete Better-Auth-Endpunkte: Das `admin`-Plugin wird nur für die Sperrprüfung beim Anmelden
verwendet. Alle seine Endpunkte (`/admin/*`) sowie Endpunkte, die die Services umgehen würden
(z. B. `/update-user`, `/delete-user`, `/change-email`, `/sign-up/email`), antworten mit 404.

## 8. Schutzregeln für Administratoren und Konten

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

## 9. Nachweis durch Tests

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
| Redaktionsrechte der Teamleitung (Module, Seiten, Sperren, Bilder, Admin-only-Operationen) | `tests/integration/content/lead-modules.test.ts`, `tests/integration/content/lead-pages.test.ts`, `tests/unit/auth/content-access.test.ts` |
| Sichtbarkeit für Teamleitungen (eigene Entwürfe, Archiv, Suche, Planansicht) | `tests/integration/visibility/lead-visibility.test.ts`                                  |
| Vorlagen der Teamleitung (`lead_managed`, `FORBIDDEN`/`NOT_FOUND`) | `tests/integration/templates/lead-templates.test.ts`                                       |
| Stellenrollen je Abteilung (Passung bei Vorlagen und Personen) | `tests/integration/org/job-role-department.test.ts`, `tests/unit/domain/job-role-fit.test.ts` |
| Meldungen: Bereich je Rolle, Löschen nur Admin, Rate Limit | `tests/integration/feedback/feedback.test.ts`, `tests/unit/validation/feedback.test.ts`     |
