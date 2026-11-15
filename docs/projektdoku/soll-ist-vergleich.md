# Soll-Ist-Vergleich

Gegenüberstellung des im Projektantrag geplanten Funktionsumfangs (Soll) mit dem umgesetzten Stand der
Version 1 (Ist). Grundlage für das Ist sind der Quellcode und die automatisierten Tests
(siehe `testkonzept-und-testbericht.md`).

## 1. Geplanter Funktionsumfang

| Nr. | Soll (Projektantrag)                                                              | Ist (umgesetzt)                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Bewertung |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Benutzeranmeldung und Berechtigungsprüfung                                        | Anmeldung mit E-Mail und Passwort (Better Auth), Passwort vergessen per Mail, Sitzungen in der Datenbank. Drei Rollen (Admin, Teamleitung, Mitarbeitende) mit einer zentralen Rechtetabelle; jede Service-Funktion prüft Rolle und Zuständigkeit selbst. Konten legt nur der Admin an; keine Selbstregistrierung. Deaktivierung beendet alle Sitzungen sofort. Schutz vor Brute Force durch Rate Limiting. | erfüllt   |
| 2   | Verwaltung von Onboarding-Vorlagen je Abteilung und Rolle                         | Vorlagen mit Geltungsbereich Abteilung (oder unternehmensweit), optional Team und Stellenrolle. Schritte verweisen auf Seiten einer Inhaltsbibliothek und sind einer Phase zugeordnet (Vor dem Start, Erster Tag, Erste Woche, Erster Monat). Vorlagen lassen sich archivieren und wiederherstellen. Abteilungen, Teams und Stellenrollen pflegt der Admin selbst. Die Inhalte entstehen in einem WYSIWYG-Editor mit Statusverwaltung (Entwurf, veröffentlicht, archiviert). | erfüllt   |
| 3   | Zuweisung an Mitarbeitende mit individuellem Ergänzen und Entfernen von Schritten | Teamleitung (für eigene Mitarbeitende) und Admin (für alle) weisen eine oder mehrere Vorlagen zu; passende Vorlagen werden nach Abteilung, Team und Stellenrolle vorgeschlagen. Die Schritte werden in den persönlichen Plan kopiert, doppelte Seiten nur einmal übernommen. Einzelne Seiten aus der Bibliothek lassen sich ergänzen, Schritte entfernen. Spätere Änderungen an Vorlagen verändern bestehende Pläne nicht. Abschlüsse bleiben beim Entfernen erhalten. | erfüllt   |
| 4   | Darstellung des Bearbeitungsstands                                                | Mitarbeitende sehen ihren Plan nach Phasen gruppiert mit Fortschrittsbalken, markieren Schritte als erledigt und können dies zurücknehmen; geänderte Seiten werden gekennzeichnet. Teamleitungen sehen eine Teamübersicht (Fortschritt in Prozent, Startdatum, letzte Aktivität) und je Person den Stand nach Modulen. Admins haben eine Gesamtübersicht mit Filtern nach Abteilung, Team und Status. Der Onboarding-Status (aktiv, abgeschlossen, archiviert) wird automatisch aus dem Fortschritt abgeleitet. | erfüllt   |
| 5   | Veranstaltungen und anwendungsinterne Benachrichtigung                            | Veranstaltungen mit Titel, Beschreibung, Zeitraum und Ort; Liste kommender und vergangener Termine für alle. Der Admin kann eine Veranstaltung an alle aktiven Personen ankündigen (wiederholbar). Benachrichtigungsglocke mit Zahl ungelesener Meldungen, Abfrage alle 60 Sekunden und bei Rückkehr in den Tab, einzeln oder gesammelt als gelesen markieren. Fünf Auslöser: neuer Planschritt, geänderte Planseite, Veranstaltungsankündigung, neu zugeordnete Person, abgeschlossenes Onboarding. Doppelte ungelesene Meldungen werden zusammengefasst; Aufbewahrung 90 Tage. | erfüllt   |

Alle fünf Punkte des geplanten Funktionsumfangs sind umgesetzt und durch Integrationstests gegen eine
echte Datenbank nachgewiesen.

## 2. Umsetzungen über den Projektantrag hinaus

Folgende Funktionen wurden ergänzt, weil sie den Nutzen im Betrieb deutlich erhöhen und mit vertretbarem
Aufwand im gewählten Technologie-Stack umsetzbar waren:

| Ergänzung                       | Beschreibung                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zweisprachigkeit (DE/EN)        | Oberfläche vollständig auf Deutsch und Englisch, Sprache je Person im Profil. Inhalte, Veranstaltungen, Benachrichtigungen und Mails ebenfalls zweisprachig; fehlt die englische Fassung, wird die deutsche mit Hinweis angezeigt. |
| Volltextsuche                   | Suche über Seiten (PostgreSQL-Volltextsuche mit deutscher bzw. englischer Wortstammbildung und Hervorhebung) und Veranstaltungen. Es werden nur Seiten gefunden, die die Person sehen darf.              |
| Bilder in Inhaltsseiten         | Upload von PNG, JPEG, WebP und GIF bis 5 MB im Editor. Auslieferung nur an berechtigte Personen über eine geschützte Route; Ablage hinter einer austauschbaren Speicher-Schnittstelle.                     |
| Einladungs- und Reset-Mails     | Neue Personen erhalten eine Einladungsmail mit Einmal-Link zum Festlegen des Passworts (72 Stunden gültig, erneut sendbar); „Passwort vergessen“ per Mail. Versand per SMTP mit HTML- und Textfassung.     |
| Hell-/Dunkelmodus               | Theme hell, dunkel oder nach Systemeinstellung, je Person gespeichert. Alle Farben zentral als Design-Tokens.                                                                                              |
| Bearbeitungssperre              | Verhindert, dass zwei Admins dieselbe Seite gleichzeitig bearbeiten (Lease mit Heartbeat, Ablauf, Übernahme, Sicherung ungespeicherter Änderungen im Browser).                                             |
| Responsives Layout              | Nutzbar auf Desktop und Smartphone.                                                                                                                                                                         |
| Demo-Daten und Bereitstellung   | Fiktive Demo-Daten auf Knopfdruck (`pnpm seed:demo`); Docker-Image und Produktions-Compose-Datei mit automatischer Migration; Betriebshandbuch (`docs/runbook.md`).                                         |

## 3. Bewusst zurückgestellte Punkte (Version 2)

Diese Punkte wurden während der Planung bewusst aus Version 1 ausgeklammert, um den Projektrahmen
einzuhalten. Die Architektur ist so angelegt, dass sie ohne grundlegenden Umbau ergänzt werden können.

| Bereich                     | Zurückgestellt                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Anmeldung und Integration   | Single Sign-on (z. B. Microsoft Entra ID, Google Workspace); die Anbindung bestehender Systeme ist laut Antrag nicht Teil des Projekts.   |
| Benachrichtigungen          | E-Mail-Benachrichtigungen zu Planereignissen; Echtzeit-Zustellung (Server-Sent Events) statt Abfrage im Minutentakt.                    |
| Inhalte                     | Bearbeitung durch Teamleitungen, PDF- und Video-Anhänge, Versionshistorie, erneute Bestätigung nach wesentlichen Änderungen, S3-kompatibler Speicher. |
| Pläne und Vorlagen          | Aufgaben jenseits von Lesen (Checklisten), frei formulierte Schritte, Übertragen von Vorlagenänderungen auf bestehende Pläne, Fristen und Verzugswarnungen. |
| Organisation und Verwaltung | Mehr als zwei Organisationsebenen, vollständiges Audit-Log, automatische Löschung archivierter Personen nach Frist, Einstellungsseite.     |
| Veranstaltungen             | Wiederkehrende Termine.                                                                                                                  |
| Betrieb                     | Installation auf einem Unternehmensserver mit automatischem Deployment, automatisierte Datensicherung.                                   |

## 4. Abweichungen und offene Punkte

| Punkt                         | Stand                                                                                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E-Tests                     | Vorgesehen waren wenige Browsertests für die kritischen Abläufe. Zum Berichtszeitpunkt ist ein Smoke-Test vorhanden; die Geschäftslogik dieser Abläufe ist vollständig durch Integrationstests abgedeckt.                    |
| Bereitstellung                | Die Anwendung ist als Docker-Stack lauffähig paketiert und wird lokal vorgeführt. Die Installation auf einem Unternehmensserver ist nicht Teil von Version 1.                                                                |
| Löschung archivierter Personen | Erfolgt manuell durch den Admin; die Detailseite einer archivierten Person zeigt das Archivierungsdatum und empfiehlt die endgültige Löschung nach sechs Monaten. Eine automatische Löschung ist für Version 2 vorgesehen.                                                                                |
| Betriebsrat und Datenschutz   | Technisch werden nur Abschluss und Zeitpunkt gespeichert (siehe `datenschutz.md`). Die Information bzw. Beteiligung des Betriebsrats vor dem Produktivbetrieb liegt beim Unternehmen.                                       |

Insgesamt wurde der geplante Funktionsumfang vollständig umgesetzt und um mehrere Funktionen erweitert,
die die Bedienbarkeit und den Betrieb verbessern. Die zurückgestellten Punkte sind dokumentiert und
bilden die Grundlage für eine Weiterentwicklung.
