# Zustandsdiagramme

Zustände und Übergänge, wie sie im Code umgesetzt sind. Die Zustandsautomaten für Seite und Onboarding
sind als reine Funktionen ohne Datenbankzugriff implementiert und separat unit-getestet:

- Seite: `src/lib/domain/page-status.ts` (`PAGE_TRANSITIONS`, `nextPageStatus`)
- Onboarding: `src/lib/domain/onboarding-status.ts` (`applyOnboardingEvent`)
- Einladung: `src/server/services/invitations.ts`
- Bearbeitungssperre: `src/server/services/locks.ts` (Server) und `src/components/editor/use-edit-lock.ts` (Editor)

Ein nicht erlaubter Übergang wird mit dem Fehlercode `INVALID_TRANSITION` abgelehnt.

## 1. Status einer Inhaltsseite

```mermaid
stateDiagram-v2
    direction LR
    state "Entwurf (draft)" as draft
    state "Veröffentlicht (published)" as published
    state "Archiviert (archived)" as archived

    [*] --> draft : createPage
    draft --> published : publish
    published --> draft : unpublish
    draft --> archived : archive
    published --> archived : archive
    archived --> published : restore
    draft --> [*] : deletePage (unbenutzt)
    published --> [*] : deletePage (unbenutzt)
    archived --> [*] : deletePage (unbenutzt)
```

| Übergang                   | Auslöser                                                                                         | Nebenwirkungen                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| neu → Entwurf              | Admin legt Seite an (`createPage`)                                                               | leerer Inhalt, ans Ende des Moduls sortiert                                                                                                                               |
| Entwurf → Veröffentlicht   | `changePageStatus(publish)`                                                                      | Fortschritt aller nicht archivierten Planinhaber wird neu berechnet; sie erhalten „Seite aktualisiert“ (außer der handelnden Person)                                       |
| Veröffentlicht → Entwurf   | `changePageStatus(unpublish)`                                                                    | Schritt zählt nicht mehr; Neuberechnung (kann ein Onboarding auf „abgeschlossen“ setzen)                                                                                   |
| → Archiviert               | `changePageStatus(archive)` oder `deletePage` einer **verwendeten** Seite (Bestätigung durch Eingabe des Titels) | wie oben; Abschlüsse bleiben gespeichert                                                                                                                       |
| Archiviert → Veröffentlicht | `changePageStatus(restore)`                                                                     | Neuberechnung (kann ein abgeschlossenes Onboarding wieder öffnen); keine „Seite aktualisiert“-Meldung                                                                     |
| → gelöscht                 | `deletePage` einer **unbenutzten** Seite                                                         | Zeile und Bilddateien werden entfernt. „Verwendet“ = in einem Vorlagenschritt, in irgendeinem Plan (auch archivierter Personen) oder mit Abschlussvermerk. Eine verwendete archivierte Seite kann nicht gelöscht werden (`IN_USE`). |

Kein Statuswechsel, aber relevant: Speichert ein Admin den Inhalt einer **veröffentlichten** Seite, gehen
die Änderungen sofort live und alle aktiven und abgeschlossenen Planinhaber außer dem Bearbeiter
erhalten „Seite aktualisiert“ (eine ungelesene Meldung je Seite wird aufgefrischt statt verdoppelt).
Bereits erteilte Abschlüsse bleiben erhalten; der Plan zeigt den Hinweis „Seit deinem Abschluss aktualisiert“.

Sichtbarkeit je Status: Employees sehen nur `published`, Teamleiter nur `published`, Admins alle Status
(siehe Berechtigungskonzept, Abschnitt 5.1).

## 2. Onboarding-Status einer Person

```mermaid
stateDiagram-v2
    state "Aktiv (active)" as active
    state "Abgeschlossen (completed)" as completed
    state "Archiviert (archived)" as archived

    [*] --> active : createUser
    active --> completed : Fortschritt erreicht 100 %
    completed --> active : Fortschritt fällt unter 100 %
    active --> archived : deactivateUser
    completed --> archived : deactivateUser
    archived --> active : reactivateUser
    active --> completed : reactivateUser + Neuberechnung (Plan bereits 100 %)
    archived --> [*] : deleteUserPermanently
```

Der Fortschritt ist `abgeschlossene aktive Schritte / aktive Schritte`. Aktiv ist ein Schritt, dessen Seite
veröffentlicht ist. Ein leerer Plan (0 aktive Schritte) bleibt `active`.

| Übergang                  | Auslöser                                                                                                                                                                                                                                                         | Nebenwirkungen                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| aktiv → abgeschlossen     | Neuberechnung ergibt 100 %. Ausgelöst durch: Schritt erledigt (`setStepCompletion`), Schritt entfernt (`removePlanStep`), letzte offene Seite wird zurückgezogen oder archiviert (`onPageStatusChanged`)                                                         | `onboarding_completed_at` wird gesetzt; Teamleitung (falls nicht archiviert) und alle aktiven Admins erhalten „Onboarding abgeschlossen“, nie die Person selbst       |
| abgeschlossen → aktiv     | Neuberechnung ergibt unter 100 %. Ausgelöst durch: Erledigung zurückgenommen, Seite ergänzt (`addPlanStep`), Vorlage zugewiesen (`assignTemplates`), Seite veröffentlicht oder wiederhergestellt                                                               | `onboarding_completed_at` wird geleert. Erneutes Abschließen meldet erneut (bei ungelesener Meldung wird diese aufgefrischt)                                          |
| aktiv / abgeschlossen → archiviert | Admin deaktiviert (`deactivateUser`)                                                                                                                                                                                                                    | `banned = true`, `archived_at` gesetzt, alle Sitzungen gelöscht, offene Einladungen widerrufen, Bearbeitungssperren freigegeben. Fortschrittsänderungen werden ignoriert |
| archiviert → aktiv        | Admin reaktiviert (`reactivateUser`)                                                                                                                                                                                                                             | Sperre aufgehoben; anschließend stille Neuberechnung: ist der Plan zu 100 % erledigt, direkt `completed`, ohne Benachrichtigung                                       |
| archiviert → gelöscht     | Admin löscht endgültig (`deleteUserPermanently`), Bestätigung durch Eingabe des vollständigen Namens                                                                                                                                                              | nur wenn die Person niemanden mehr leitet; löscht per Kaskade Sitzungen, Konten, Einladungen, Plan, Abschlüsse, eigene Benachrichtigungen und Benachrichtigungen über die Person |

Abgelehnt werden: Deaktivieren einer bereits archivierten Person, Reaktivieren einer nicht archivierten
Person, endgültiges Löschen einer nicht archivierten Person (jeweils `INVALID_TRANSITION`), Deaktivieren
des letzten aktiven Admins (`LAST_ADMIN`) und der eigenen Person (`FORBIDDEN`).

Alle Änderungen an Plan, Abschlüssen und Status laufen in einer Transaktion unter einer Zeilensperre
der Person (`lockUserInTx`). Zwei gleichzeitige Erledigungen der letzten beiden offenen Schritte führen
daher zuverlässig zu `completed`.

## 3. Einladung („Passwort festlegen“)

### 3.1 Einzelne Einladung (Zeile in `invitations`)

```mermaid
stateDiagram-v2
    state "Offen" as open
    state "Abgelaufen" as expired
    state "Widerrufen" as revoked
    state "Angenommen" as accepted

    [*] --> open : createUser / E-Mail geändert / resendInvitation
    open --> accepted : acceptInvitation (gültiges Token, Passwort gesetzt)
    open --> expired : 72 Stunden vergangen
    open --> revoked : neue Einladung für dieselbe Person
    open --> revoked : deactivateUser
    open --> revoked : andere Einladung derselben Person angenommen
    accepted --> [*]
    expired --> [*]
    revoked --> [*]
```

| Übergang                 | Auslöser                                                                                                                                  | Nebenwirkungen                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| neu → offen              | Admin legt Person an; Admin ändert die E-Mail vor der Annahme; Admin sendet die Einladung erneut (nur aktive Personen ohne Passwort)    | Zufallstoken (32 Byte); gespeichert wird nur der SHA-256-Hash. Alle bisher offenen Einladungen der Person werden widerrufen. Mail in der Sprache der Person (nach dem Commit)       |
| offen → angenommen       | Person öffnet den Link und setzt ein Passwort (min. 12 Zeichen)                                                                           | in einer Transaktion unter Zeilensperre: Passwort-Konto angelegt, E-Mail als bestätigt markiert, übrige offene Einladungen widerrufen, **alle Sitzungen der Person beendet**         |
| offen → abgelaufen       | Zeitablauf (`expires_at`), kein Job nötig                                                                                                 | Link liefert „abgelaufen“ (`INVITE_EXPIRED`); Abhilfe nur durch „Einladung erneut senden“                                                                                          |
| offen → widerrufen       | neue Einladung, Deaktivierung der Person, Annahme einer anderen Einladung                                                                | Link liefert „ungültig“ (`INVITE_INVALID`)                                                                                                                                         |

Ein Token gilt außerdem als ungültig, wenn die Person gesperrt oder archiviert ist. Ein bereits benutztes
Token ergibt „bereits verwendet“.

### 3.2 Einladungsstatus in der Benutzerverwaltung

Die Detailseite eines Benutzers zeigt einen abgeleiteten Status (`getInvitationState`):

```mermaid
stateDiagram-v2
    direction LR
    state "keine (none)" as none
    state "ausstehend (pending)" as pending
    state "abgelaufen (expired)" as expired
    state "angenommen (accepted)" as accepted

    [*] --> pending : Person angelegt
    none --> pending : resendInvitation
    pending --> expired : 72 Stunden vergangen
    expired --> pending : resendInvitation
    pending --> accepted : Passwort festgelegt
```

- `accepted`, sobald ein Passwort-Konto existiert, unabhängig von den Einladungszeilen.
- Sonst entscheidet die jüngste Einladung: offen und nicht abgelaufen → `pending`, sonst `expired`
  (auch widerrufen). Ohne Einladung → `none`.

## 4. Bearbeitungssperre (Lease) einer Seite

Die Sperre ist eine Zeile in `page_edit_locks` mit `expires_at = now() + 120 s`. Es wird keine
Datenbankverbindung offen gehalten, und es gibt keinen Aufräumjob: eine abgelaufene Zeile gilt als frei.
Alle Zeitvergleiche nutzen die Uhr der Datenbank (`now()`).

### 4.1 Serverseitige Zustände

```mermaid
stateDiagram-v2
    state "Frei (keine Zeile oder abgelaufen)" as free
    state "Gehalten von Admin A" as heldA
    state "Gehalten von Admin B" as heldB

    [*] --> free
    free --> heldA : acquireLock (A)
    heldA --> heldA : heartbeat alle 30 s (expires_at = now() + 2 min)
    heldA --> heldA : acquireLock erneut durch A (acquired_at bleibt)
    heldA --> free : releaseLock (A), Speichern und Schließen, Tab geschlossen
    heldA --> free : 2 min ohne heartbeat
    heldA --> heldB : takeOverLock (B, nach Bestätigung)
    heldA --> free : deactivateUser (A) oder Seite gelöscht
    free --> heldA : heartbeat (A) nach Ablauf, solange niemand übernommen hat
```

| Aktion                    | Verhalten                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Holen (`acquireLock`)     | Ein einziges atomares `INSERT … ON CONFLICT DO UPDATE … WHERE expires_at < now() OR user_id = ich`. Ist die Sperre fremd und gültig: `LOCK_HELD` mit Name und Beginn des Inhabers. Von zwei gleichzeitigen Admins gewinnt genau einer. |
| Verlängern (`heartbeat`)  | `POST /api/locks/{pageId}/heartbeat` alle 30 s. Verlängert die eigene Sperre, auch wenn sie inzwischen abgelaufen ist, solange niemand übernommen hat. Hält ein anderer die Sperre: `held: false` mit dessen Namen.          |
| Freigeben (`releaseLock`) | Löscht nur die eigene Zeile. Beim Verlassen der Seite per `sendBeacon` an `POST /api/locks/{pageId}/release`. Kommt die Anfrage nicht an, läuft die Sperre nach 2 Minuten ab.                                                  |
| Übernehmen (`takeOverLock`) | Schreibt die Sperre bedingungslos auf den übernehmenden Admin und setzt `acquired_at` neu. Die Oberfläche fragt vorher nach.                                                                                                |
| Speichern                 | `savePageContent` prüft in derselben Transaktion mit `SELECT … FOR UPDATE`, dass die Sperre dem Speichernden gehört und gültig ist; sonst `LOCK_LOST`. Beim Speichern wird eine verlorene Sperre nie neu geholt.                |

### 4.2 Zustände im Editor (Client)

```mermaid
stateDiagram-v2
    state "Anfordern (acquiring)" as acquiring
    state "Bearbeiten (editing)" as editing
    state "Fremd gesperrt, nur lesen (held)" as held
    state "Sperre verloren (lost)" as lost
    state "Wegen Inaktivität freigegeben (idle)" as idle
    state "Fehler (failed)" as failed

    [*] --> acquiring : Editor geöffnet
    acquiring --> editing : Sperre erhalten
    acquiring --> held : LOCK_HELD
    acquiring --> failed : anderer Fehler
    editing --> lost : heartbeat meldet held false
    editing --> lost : Speichern liefert LOCK_LOST
    editing --> idle : 15 min keine Eingabe und 60 s keine Antwort auf Noch-da-Frage
    editing --> [*] : Speichern und Schließen / Seite verlassen (Freigabe)
```

- Andere Admins sehen die Seite schreibgeschützt mit dem Hinweis, wer seit wann bearbeitet.
- Bei `lost` und `idle` wird der ungespeicherte Stand als Entwurf im `localStorage` des Browsers
  abgelegt. Beim nächsten Öffnen mit erhaltener Sperre bietet der Editor die Wiederherstellung an.
- Kurzzeitige Server- oder Netzfehler beim Heartbeat führen nicht zum Verlust; der nächste Takt versucht es erneut.

## 5. Ergänzend: Status einer Vorlage

```mermaid
stateDiagram-v2
    direction LR
    state "Aktiv (active)" as active
    state "Archiviert (archived)" as archived

    [*] --> active : createTemplate
    active --> archived : archiveTemplate / deleteTemplate (zugewiesen, Name bestätigt)
    archived --> active : restoreTemplate
    active --> [*] : deleteTemplate (nie zugewiesen)
    archived --> [*] : deleteTemplate (nie zugewiesen)
```

Archivierte Vorlagen werden bei der Zuweisung nicht mehr angeboten. Bestehende Pläne bleiben unverändert,
weil die Schritte bei der Zuweisung kopiert wurden (Snapshot).
