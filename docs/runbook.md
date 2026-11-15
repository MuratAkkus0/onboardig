# Runbook: Onboarding Portal betreiben

Übergabedokument für Installation und Betrieb. Alle Beispiele verwenden Platzhalter (`example.com`);
Zugangsdaten und Geheimnisse gehören nie ins Repository.

## 1. Überblick

Der Stack aus `docker-compose.prod.yml` besteht aus:

| Dienst     | Aufgabe                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| `postgres` | PostgreSQL 18 (Volume `pgdata`)                                                           |
| `migrate`  | Einmalig: wendet die Datenbankmigrationen an und beendet sich. `app` startet erst danach. |
| `app`      | Die Next.js-Anwendung (Port 3000 im Container, Volume `uploads` für Bilder)               |
| `tools`    | Nur auf Abruf (`run --rm`): erster Admin, Demo-Daten. Wird von `up` nicht gestartet.      |

Das Image hat die Stufen `deps`, `build`, `runner` (nur die App) und `tools` (alle Abhängigkeiten plus
Quellcode für `db:migrate` und `seed:*`).

## 2. Voraussetzungen

- Server mit Docker Engine und Docker Compose v2
- Eine Domain mit HTTPS-Terminierung vor der App (Reverse Proxy wie Caddy, nginx oder Traefik). Die App
  selbst spricht nur HTTP auf dem Port `APP_PORT`, der nur an `127.0.0.1` gebunden ist (der Proxy läuft
  auf demselben Host). Der Proxy muss den Header `X-Forwarded-For` überschreiben statt anhängen
  (nginx: `proxy_set_header X-Forwarded-For $remote_addr;`), sonst greifen die Anmelde-Limits nicht
  pro Client.
- Ein SMTP-Zugang für den Versand der Einladungs- und Passwort-Reset-Mails (siehe Abschnitt 7)

## 3. Installation

```bash
git clone <repository-url> onboarding-portal
cd onboarding-portal
cp .env.prod.example .env.prod
```

`.env.prod` ausfüllen (siehe Abschnitt 4), dann bauen und starten:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

Erwartung: `postgres` und `app` sind `healthy`, `migrate` ist mit `Exited (0)` beendet. Prüfung:

```bash
curl -s http://localhost:3000/api/health
```

> Das Flag `--env-file .env.prod` ist bei jedem Compose-Aufruf nötig, weil die Compose-Datei die Werte
> daraus einsetzt. Ohne das Flag bricht Compose mit einer Meldung über eine fehlende Variable ab.

## 4. Konfiguration (`.env.prod`)

| Variable                                      | Bedeutung                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `APP_URL`                                     | Öffentliche Adresse inkl. Schema, z. B. `https://onboarding.example.com`. Muss exakt der Browser-Adresse entsprechen.          |
| `APP_PORT`                                    | Host-Port der App (Standard 3000)                                                                                              |
| `BETTER_AUTH_SECRET`                          | Signaturschlüssel, mindestens 32 Zeichen: `openssl rand -base64 32`. Nach dem Start nicht mehr ändern (Sessions werden ungültig). |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Datenbankzugang. Das Passwort nur mit URL-sicheren Zeichen erzeugen: `openssl rand -hex 24`.                              |
| `MAIL_FROM`, `SMTP_*`, `MAIL_TRANSPORT`       | Mailversand, siehe Abschnitt 7                                                                                                 |
| `LOG_LEVEL`                                   | `info` (Standard), für Fehlersuche `debug`                                                                                     |

`.env.prod` ist durch `.gitignore` ausgeschlossen. Dateirechte beschränken: `chmod 600 .env.prod`.

## 5. Migrationen

Migrationen laufen bei jedem `up` automatisch im Dienst `migrate`, bevor die App startet. Manuell:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm tools scripts/db-migrate.ts
```

Ein Update der Anwendung ist damit: `git pull`, dann erneut `up -d --build` (siehe auch Abschnitt 8,
Sicherung vor Updates).

## 6. Erster Admin und Demo-Daten

### Erster Admin

Interaktiv (Passwort wird zweimal verdeckt abgefragt, mindestens 12 Zeichen):

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm tools scripts/seed-admin.ts
```

Nicht interaktiv (z. B. Automatisierung): `SEED_ADMIN_EMAIL` und `SEED_ADMIN_PASSWORD` (optional
`SEED_ADMIN_FIRST_NAME`, `SEED_ADMIN_LAST_NAME`) in `.env.prod` setzen und denselben Befehl ausführen.
Danach die Variablen wieder entfernen. Das Passwort wird nie ausgegeben. Weitere Benutzer legt der Admin in
der Anwendung unter Admin / Benutzer an; sie erhalten eine Einladungs-Mail zum Setzen des Passworts.

### Demo-Daten (nur für Vorführung und Tests)

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm tools scripts/seed-demo.ts
```

Das Skript füllt eine **leere** Datenbank mit frei erfundenen Daten (Muster Möbel GmbH): Abteilungen und
Teams, Rollen, einen Admin, zwei Teamleitungen, fünf Mitarbeitende in unterschiedlichen Zuständen (kein
Plan, teilweise erledigt, abgeschlossen, archiviert), Module mit deutschen und englischen Seiten, Vorlagen,
zugewiesene Pläne, kommende und vergangene Veranstaltungen sowie Benachrichtigungen. Am Ende gibt es die
Zugangsdaten aus (ein gemeinsames, zufälliges Passwort; optional per `SEED_DEMO_PASSWORD` festlegbar).

Schutzmechanismen:

- Sobald irgendein Benutzer existiert, bricht das Skript ab. Es überschreibt nie echte Daten.
- `--reset` leert vorher alle Anwendungsdaten, wird aber bei `NODE_ENV=production` verweigert. Der
  `tools`-Container läuft immer mit `NODE_ENV=production`; ein Zurücksetzen ist dort also nicht möglich.
  Für eine Demo-Datenbank im Entwicklungsmodus: `pnpm seed:demo --reset`.
- Nicht auf einer Datenbank mit echten Daten einsetzen. Die Demo-Konten haben Adressen unter
  `muster-moebel.example` und sollten vor dem Produktivbetrieb nicht existieren.

## 7. Echten SMTP-Server anbinden

Lokal fängt Mailpit alle Mails ab (Oberfläche `http://localhost:8025`). Für den Betrieb:

1. In `.env.prod` eintragen:

   ```dotenv
   MAIL_TRANSPORT=smtp
   MAIL_FROM="Onboarding Portal <onboarding@ihre-domain.example>"
   SMTP_HOST=smtp.ihre-domain.example
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=...
   SMTP_PASSWORD=...
   ```

   Port 587 nutzt STARTTLS (`SMTP_SECURE=false`), Port 465 implizites TLS (`SMTP_SECURE=true`).

2. Die App neu starten: `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d`.
3. Testen: im Admin-Bereich einen Benutzer mit einer echten Adresse anlegen und prüfen, ob die
   Einladungs-Mail ankommt (nicht im Spam-Ordner). Fehler beim Versand stehen im Log
   (`docker compose ... logs app`, Meldung „invitation mail failed“), das Passwort oder Mailinhalte nie.

### SPF, DKIM und DMARC prüfen

Damit Einladungen nicht als Spam eingestuft werden, muss die Absenderdomain (Domain in `MAIL_FROM`)
authentifiziert sein. Die Einträge pflegt der Mail-Provider bzw. die IT; prüfen lässt sich so:

```bash
# SPF: muss den Versandserver bzw. den Provider enthalten, endet meist auf ~all oder -all
dig +short TXT ihre-domain.example | grep -i "v=spf1"

# DKIM: <selector> nennt der Provider (z. B. "default", "s1", "selector1")
dig +short TXT <selector>._domainkey.ihre-domain.example

# DMARC: mindestens p=none zum Beobachten, später quarantine oder reject
dig +short TXT _dmarc.ihre-domain.example
```

Ende-zu-Ende-Kontrolle: eine Einladung an ein Gmail- oder Outlook-Konto senden, „Originalnachricht
anzeigen“ öffnen und prüfen, dass `SPF`, `DKIM` und `DMARC` jeweils `PASS` zeigen.

## 8. Sicherung und Wiederherstellung

Zu sichern sind zwei Dinge: die Datenbank und das Volume mit den hochgeladenen Bildern.

```bash
# Datenbank (SQL-Dump)
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > backup-db-$(date +%F).sql.gz

# Bilder (Volume uploads)
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm --no-deps --entrypoint \
  tar app czf - -C /app uploads > backup-uploads-$(date +%F).tar.gz
```

Empfehlung: täglich automatisieren, die Dateien außerhalb des Servers aufbewahren und die Wiederherstellung
einmal testen. Vor jedem Update der Anwendung eine Sicherung ziehen. Wiederherstellung der Datenbank:
`gunzip -c backup-db-<datum>.sql.gz | docker compose ... exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'`
in eine leere Datenbank.

Die Volumes `pgdata` und `uploads` bleiben bei `down` erhalten. `down -v` löscht sie unwiderruflich.

## 9. Datenschutz: Sitzungen

Die Anwendung speichert keine Nutzungsdaten (keine Lesezeit, keine Scrolltiefe, keine Seitenaufrufe),
sondern nur, ob und wann ein Schritt abgeschlossen wurde. Die Sitzungstabelle (`sessions`) enthält
IP-Adresse und User-Agent der Anmeldung; Better Auth legt sie zur Nachvollziehbarkeit und Absicherung
von Sitzungen an. Die Begrenzung der Anmeldeversuche (Rate Limiting) nutzt die IP der jeweiligen Anfrage
nur im Arbeitsspeicher und nicht diese Felder. Es gibt keine Auswertung dieser Felder.

Eine Sitzungszeile wird bei Abmeldung und bei Deaktivierung des Benutzers sofort gelöscht. Eine
abgelaufene Sitzung (nach 7 Tagen) entfernt Better Auth erst, wenn ihr Cookie erneut gesendet wird.
Damit abgelaufene Sitzungen nicht liegen bleiben, sollten sie regelmäßig (z. B. wöchentlich per Cron)
gelöscht werden:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "DELETE FROM sessions WHERE expires_at < now();"'
```

## 10. Entwicklung und mehrere Arbeitskopien (Worktrees)

Lokal (ohne Docker für die App): `docker compose up -d` startet PostgreSQL (Port 5433) und Mailpit,
`pnpm setup:env` legt `.env` mit einem frischen Geheimnis an, `pnpm db:migrate` migriert, `pnpm dev` startet.

Laufen mehrere Arbeitskopien parallel, braucht jede einen eigenen Port, und `APP_URL` muss dazu passen,
sonst lehnt die Origin-Prüfung von Better Auth die Anfragen ab:

```bash
PORT=3303 APP_URL=http://localhost:3303 pnpm dev
```

Für Demo-Daten in einer eigenen Datenbank `DATABASE_URL` pro Aufruf überschreiben (bereits gesetzte
Umgebungsvariablen haben Vorrang vor `.env`):

```bash
DATABASE_URL=postgres://onboarding:onboarding@localhost:5433/onboarding_demo pnpm db:migrate
DATABASE_URL=postgres://onboarding:onboarding@localhost:5433/onboarding_demo pnpm seed:demo --reset
```

## 11. Fehlersuche

| Symptom                                           | Ursache und Abhilfe                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Compose meldet „set APP_URL in .env.prod“         | `--env-file .env.prod` fehlt oder der Wert ist leer                                                  |
| Anmeldung schlägt mit 403 fehl                    | `APP_URL` stimmt nicht mit der Adresse im Browser überein (Schema, Host, Port)                       |
| `app` startet nicht                               | `docker compose ... logs migrate`: Migration fehlgeschlagen, meist falsche Datenbankzugangsdaten     |
| Postgres meldet einen Fehler zum Datenverzeichnis | Ein altes Volume aus PostgreSQL 17 oder älter wird nicht übernommen; neues Volume oder Dump einspielen |
| Keine Einladungs-Mails                            | SMTP-Werte prüfen, Log der App ansehen, SPF/DKIM/DMARC prüfen (Abschnitt 7)                          |
