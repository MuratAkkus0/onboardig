# Datenschutz (DSGVO) und Mitbestimmung

Technische Beschreibung, welche personenbezogenen Daten das Onboarding Portal verarbeitet, wozu und wie
lange. Sie dient als Grundlage für die datenschutzrechtliche Prüfung im Unternehmen (Verzeichnis von
Verarbeitungstätigkeiten, Information der Beschäftigten, Beteiligung des Betriebsrats). Eine rechtliche
Bewertung ersetzt sie nicht; Rechtsgrundlage und Fristen legt das Unternehmen mit seiner bzw. seinem
Datenschutzbeauftragten fest.

## 1. Grundsatz: Datensparsamkeit

Für den Bearbeitungsstand wird **nur gespeichert, ob und wann eine Person einen Schritt als erledigt
markiert hat** (Tabelle `page_completions`: Person, Seite, Zeitpunkt). Diesen Vermerk setzt die Person
selbst; niemand kann Schritte für andere als erledigt markieren.

**Nicht** erhoben werden:

- Lesezeit, Verweildauer, Scrolltiefe, Seitenaufrufe, Klickpfade oder sonstiges Nutzungsverhalten
- Ansichtsprotokolle („wer hat wann welche Seite geöffnet“); auch das Anwendungslog enthält keine
  Lesezugriffe, nur Fehler und Änderungen
- Tracking, Analyse- oder Werbedienste; die Anwendung lädt keine Inhalte von Drittanbietern
  (Content-Security-Policy `default-src 'self'`), es gibt keine externe Fehlerüberwachung

Die „letzte Aktivität“ in den Übersichten ist ausschließlich der Zeitpunkt des letzten Erledigt-Vermerks.

Seit v1.1 wird zusätzlich gespeichert, wann eine Person den Hinweis „Seit deinem Abschluss aktualisiert“
selbst geschlossen hat (`page_completions.update_seen_at`). Das ist wie der Erledigt-Vermerk eine bewusste
Handlung der Person, keine Messung des Leseverhaltens; der Zeitpunkt fließt weder in den Fortschritt noch
in die „letzte Aktivität“ ein und wird nicht angezeigt.

Auch die Funktion „Problem melden“ (seit v1.1) erhebt keine Verhaltensdaten: Gespeichert wird nur, was
die Person selbst eingibt, und der Pfad der Seite, von der aus sie meldet (Abschnitt 2a). Browser,
Gerät, Bildschirmgröße, Klickverlauf oder Bildschirmfotos werden nicht erfasst.

## 2. Verarbeitete personenbezogene Daten

| Daten                                                      | Speicherort                                    | Zweck                                                                                     | Sichtbar für                                                     |
| ---------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Vor- und Nachname, E-Mail, Team, Stellenrolle, Teamleitung, Startdatum, Anwendungsrolle | `users`                                        | Konto, Zuordnung zu Vorlagen und Teamleitung, Anmeldung                                  | Admin; Teamleitung für die eigenen Mitarbeitenden                |
| Sprache, Theme                                             | `users`                                        | Darstellung nach Wunsch der Person                                                        | nur die Person                                                   |
| Onboarding-Status, Abschlusszeitpunkt, Archivierungszeitpunkt | `users`                                     | Darstellung des Bearbeitungsstands, Kontoverwaltung                                       | Person, eigene Teamleitung, Admin                                |
| Persönlicher Plan (zugewiesene Seiten, Vorlagen, wer sie zugewiesen hat) | `user_plan_steps`, `user_template_assignments` | Onboarding-Plan                                                                 | Person, eigene Teamleitung, Admin                                |
| Erledigt-Vermerk mit Zeitpunkt                             | `page_completions`                             | Fortschritt                                                                               | Person, eigene Teamleitung, Admin                                |
| Zeitpunkt „Hinweis auf Aktualisierung geschlossen“ (v1.1)   | `page_completions.update_seen_at`              | Hinweis nicht erneut anzeigen, bis die Seite wieder geändert wird                         | niemand als Wert; wirkt nur auf die Anzeige des Hinweises        |
| Meldungen „Problem melden“ (v1.1): meldende Person, Art, Betreff, Beschreibung, App-Pfad, ggf. Seite, Status, Antwortnotiz, bearbeitende Person, Zeitpunkte | `feedback_reports`  | Fehler und veraltete Inhalte melden und bearbeiten                                        | Admin; Teamleitung nur für Inhaltsmeldungen zu Seiten ihrer Abteilung; die meldende Person erhält bei Erledigung eine Benachrichtigung |
| Passwort (nur als Hash)                                    | `accounts`                                     | Anmeldung                                                                                 | niemand im Klartext                                              |
| Einladungs-Token (nur als SHA-256-Hash), Ablauf, Annahme   | `invitations`                                  | erstmaliges Festlegen des Passworts                                                       | Admin (nur Status: ausstehend, abgelaufen, angenommen)           |
| Sitzung: Token, Ablauf, IP-Adresse, User-Agent             | `sessions`                                     | Anmeldung aufrechterhalten, Sicherheit (siehe Abschnitt 3)                                | niemand über die Oberfläche; keine Auswertung                    |
| Benachrichtigungen                                         | `notifications`                                | anwendungsinterne Hinweise an die Person                                                  | nur die empfangende Person                                       |
| Autorverweise („zuletzt bearbeitet von“, „angelegt von“)   | `pages`, `templates`, `events`, `uploads` u. a. | Nachvollziehbarkeit redaktioneller Änderungen (kein vollständiges Audit-Log)             | Admin; „zuletzt bearbeitet von“ auch auf der Seitenansicht       |
| Technische IDs der handelnden Person bei Änderungen        | Anwendungslog (stdout des Containers)          | Fehleranalyse und Nachvollziehbarkeit von Änderungen                                      | Betrieb                                                          |

Im Anwendungslog werden Passwörter, Tokens, Cookies, Links und Mailinhalte maskiert. Personenbezug
besteht nur über die interne Benutzer-ID. Wie lange Container-Logs aufbewahrt werden, legt der Betrieb fest.

## 2a. Meldungen („Problem melden“)

- **Gespeicherte Felder:** meldende Person (Benutzer-ID), Art (Fehler in der App, Inhalt falsch oder
  veraltet, Sonstiges), Betreff (max. 120 Zeichen), Beschreibung (max. 2000 Zeichen), der Pfad innerhalb
  der Anwendung, von dem aus gemeldet wurde (ohne Abfrageparameter), ggf. die betroffene Seite, Status,
  Antwortnotiz (max. 1000 Zeichen), die zuletzt bearbeitende Person sowie Zeitpunkte für Anlage,
  Änderung und Erledigung. Die Seite wird nur verknüpft, wenn die Person sie sehen darf.
- **Nicht gespeichert:** IP-Adresse, Browser, Gerät, Bildschirmfoto, Verlauf oder sonstige technische bzw.
  Verhaltensdaten. Die Meldung wird im Dialog vor dem Absenden vollständig angezeigt (inkl. Pfad).
- **Freitext:** Betreff und Beschreibung sind Freitext. Personen sollten dort keine Daten Dritter
  eintragen; der Admin kann einzelne Meldungen jederzeit löschen.
- **Missbrauchsschutz:** höchstens 5 Meldungen je Person in einer rollierenden Stunde. Dafür werden die
  vorhandenen Meldungen gezählt; zusätzliche Daten werden nicht gespeichert.
- **Benachrichtigung:** Wird eine Meldung erledigt, erhält die meldende Person eine
  anwendungsinterne Benachrichtigung mit Betreff und ggf. Antwortnotiz (Aufbewahrung wie alle
  Benachrichtigungen, 90 Tage). Archivierte oder gelöschte Personen erhalten keine.
- **Keine Auswertung je Person:** Es gibt keine Statistik darüber, wer wie oft meldet. Die Liste dient
  ausschließlich der Bearbeitung der gemeldeten Probleme.

## 3. Sitzungen: IP-Adresse und User-Agent

- **Zweck:** Better Auth legt bei der Anmeldung eine Sitzungszeile an und füllt dabei standardmäßig
  IP-Adresse und User-Agent. Die Felder dienen ausschließlich der Sicherheit des Anmeldeverfahrens
  (Nachvollziehen einer Sitzung bei Verdacht auf Missbrauch). Sie werden in der Anwendung weder angezeigt
  noch ausgewertet.
- **Gültigkeit:** 7 Tage; bei Nutzung wird die Sitzung höchstens einmal täglich um 7 Tage verlängert.
- **Löschung der Sitzungszeile:**
  - bei Abmeldung,
  - bei Deaktivierung der Person (sofort, in derselben Transaktion),
  - beim Zurücksetzen des Passworts und beim Annehmen einer Einladung (alle Sitzungen der Person),
  - beim endgültigen Löschen der Person (Kaskade),
  - nach Ablauf: Die Sitzung ist sofort ungültig; Better Auth entfernt die Zeile, sobald das zugehörige
    Cookie das nächste Mal vorgelegt wird.
- **Hinweis:** Wird ein abgelaufenes Cookie nie wieder vorgelegt (z. B. anderer Browser), bleibt die
  ungültige Zeile bis zum Löschen der Person bestehen. Eine zeitgesteuerte Bereinigung ist in v1 nicht
  enthalten. Empfehlung für den Betrieb: regelmäßig `DELETE FROM sessions WHERE expires_at < now();`
  ausführen (z. B. täglich per Cronjob auf dem Host).
- Die Begrenzung der Anmeldeversuche (Rate Limiting) nutzt die IP-Adresse der jeweiligen Anfrage nur
  flüchtig im Arbeitsspeicher des Servers; sie wird dafür nicht dauerhaft gespeichert.

## 4. Aufbewahrung und Löschung

| Daten                    | Regel                                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Benachrichtigungen       | 90 Tage. Ältere Meldungen einer Person werden gelöscht, sobald sie ihre Benachrichtigungen abruft (ohne Cronjob). Meldungen über eine endgültig gelöschte Person werden auch aus den Listen anderer entfernt.            |
| Einladungen              | Link 72 Stunden gültig, danach unbrauchbar. Zeilen bleiben als Nachweis bis zum Löschen der Person.                                                                                                                    |
| Passwort-Reset-Tokens    | 1 Stunde gültig.                                                                                                                                                                                                       |
| Erledigt-Vermerke        | Solange die Person existiert. Beim Entfernen eines Schritts aus dem Plan bleibt der Vermerk erhalten (er zählt wieder, wenn der Schritt zurückkommt).                                                                    |
| Meldungen (v1.1)         | Erledigte Meldungen werden **180 Tage** nach ihrer Erledigung gelöscht, sobald jemand die Meldungsliste öffnet (ohne Cronjob). Offene und in Bearbeitung befindliche Meldungen bleiben bis zur Erledigung oder Löschung durch den Admin. Wird eine erledigte Meldung wieder geöffnet, beginnt die Frist bei erneuter Erledigung neu. |
| Ausgeschiedene Personen  | zweistufig, siehe unten                                                                                                                                                                                                |

**Ausgeschiedene Personen:**

1. **Deaktivieren (Archivieren):** Die Person kann sich sofort nicht mehr anmelden; alle Sitzungen werden
   gelöscht, offene Einladungen widerrufen, Bearbeitungssperren freigegeben. Sie erhält keine
   Benachrichtigungen mehr und erscheint nicht mehr in Team- und Gesamtübersicht (nur mit Filter
   „archiviert“). Die Daten bleiben erhalten, damit eine irrtümliche Deaktivierung rückgängig gemacht
   werden kann.
2. **Endgültig löschen:** Nur für archivierte Personen, nach Bestätigung durch Eingabe des vollständigen
   Namens. Gelöscht werden per Datenbank-Kaskade: Benutzerzeile, Sitzungen, Konten (Passwort-Hash),
   Einladungen, Plan, Vorlagenzuweisungen, Erledigt-Vermerke, eigene Benachrichtigungen sowie alle
   Benachrichtigungen anderer über diese Person. Autorverweise auf Inhalten werden auf „unbekannt“
   (`NULL`) gesetzt. Voraussetzung: Die Person leitet niemanden mehr (ggf. vorher neue Teamleitung zuweisen).
   Von der Person verfasste **Meldungen bleiben erhalten**, weil sie ein sachliches Problem der Anwendung
   oder eines Inhalts beschreiben; der Verweis auf die meldende bzw. bearbeitende Person wird auf `NULL`
   gesetzt, die Meldung erscheint mit „gelöschter Benutzer“. Personenbezogene Angaben im Freitext
   entfernt das nicht; solche Meldungen kann der Admin löschen.

Die Detailseite einer archivierten Person zeigt das Archivierungsdatum und empfiehlt, die Daten nach
**6 Monaten** endgültig zu löschen. Die Löschung erfolgt in v1 manuell durch den Admin; eine automatische
Löschung nach Frist ist für Version 2 vorgesehen. Die konkrete Frist legt das Unternehmen fest.

Datensicherungen (siehe `docs/runbook.md`, Abschnitt 8) enthalten gelöschte Daten bis zu ihrer
Rotation; die Aufbewahrungsdauer der Sicherungen legt der Betrieb fest.

## 5. Daten im Browser

| Speicher                         | Inhalt                                                     | Zweck                                                                 |
| -------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Sitzungs-Cookie (Better Auth)    | Sitzungstoken                                              | Anmeldung                                                             |
| Cookie `NEXT_LOCALE`             | gewählte Sprache (`de`/`en`), 1 Jahr                       | Sprache auch vor der Anmeldung                                        |
| `localStorage` (`theme`)         | gewähltes Theme                                            | Darstellung ohne Flackern beim Laden                                  |
| `localStorage` (nur Admins)      | ungespeicherter Entwurf einer Seite im Editor              | Schutz vor Datenverlust bei Sperrverlust oder Inaktivität; wird nach dem Speichern gelöscht |

Alle Einträge dienen ausschließlich dem Betrieb der Anwendung; Tracking-Cookies gibt es nicht.

## 6. Technische und organisatorische Maßnahmen (Auswahl)

- Rollenbasierte Rechteprüfung in jeder Service-Funktion; Teamleitungen sehen nur die eigenen
  Mitarbeitenden (siehe `berechtigungskonzept.md`).
- Passwörter nur als Hash (Better Auth), Einladungs-Tokens nur als SHA-256-Hash; Mindestlänge des
  Passworts 12 Zeichen; Begrenzung der Anmelde- und Reset-Versuche.
- Keine Selbstregistrierung; Konten legt ausschließlich der Admin an.
- Bilder nur über eine geschützte Route mit Rechteprüfung, keine öffentlichen URLs.
- Meldungen sieht nur der Admin und für Inhaltsmeldungen die Teamleitung der betroffenen Abteilung;
  Löschen nur durch den Admin; Begrenzung auf 5 Meldungen je Person und Stunde.
- HTTP-Sicherheitsheader (CSP, `X-Frame-Options`, `Referrer-Policy` u. a.); Transportverschlüsselung über
  den vorgeschalteten HTTPS-Reverse-Proxy.
- Daten liegen ausschließlich in der eigenen PostgreSQL-Datenbank und im eigenen Upload-Volume; Mails
  laufen über den SMTP-Server des Unternehmens. Die Mails enthalten keine Tracking-Pixel.
- Demo- und Testdaten sind fiktiv; das öffentliche Repository enthält keine echten Personendaten und
  keine Geheimnisse.

## 7. Hinweis zur Mitbestimmung (Betriebsrat)

Die Anwendung zeigt Teamleitungen und Admins den Bearbeitungsstand von Beschäftigten (Fortschritt in
Prozent, Zeitpunkt des letzten Erledigt-Vermerks). Technische Einrichtungen, die dazu geeignet sind,
Verhalten oder Leistung von Beschäftigten zu überwachen, unterliegen der Mitbestimmung des Betriebsrats
(§ 87 Abs. 1 Nr. 6 BetrVG). Die Anwendung ist deshalb bewusst datensparsam gestaltet (Abschnitt 1): Es
werden keine Nutzungs- oder Verhaltensdaten erfasst, und der Fortschritt beruht allein auf der eigenen
Angabe der Person. Auch die seit v1.1 erweiterten Funktionen ändern daran nichts: Teamleitungen erhalten
zusätzliche Redaktionsrechte an Inhalten; an Beschäftigtendaten sehen sie zusätzlich nur den Namen der
meldenden Person bei Inhaltsmeldungen zu Seiten ihrer Abteilung. Meldungen werden nicht je Person
ausgewertet.

Vor dem Produktivbetrieb sind durch das Unternehmen insbesondere zu klären:

- Information bzw. Beteiligung des Betriebsrats (ggf. Betriebsvereinbarung)
- Eintrag im Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) und Festlegung der Rechtsgrundlage
- Information der Beschäftigten (Art. 13 DSGVO)
- Löschfristen für archivierte Personen, Sitzungen, Logs und Datensicherungen; Bestätigung der
  technisch voreingestellten Frist von 180 Tagen für erledigte Meldungen

Diese Schritte sind organisatorische Aufgaben des Unternehmens und nicht Teil der technischen Umsetzung.
