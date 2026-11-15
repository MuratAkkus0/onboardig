import { doc, h2, h3, ol, p, ul } from "./doc";
import type { DemoPage } from "./types";

export const TECH_PAGES: DemoPage[] = [
  {
    key: "vpn",
    moduleKey: "it",
    status: "published",
    titleDe: "VPN einrichten",
    titleEn: "Setting up the VPN",
    contentDe: doc(
      h2("Sicher von überall arbeiten"),
      p("Für interne Systeme brauchst du außerhalb des Büros eine VPN-Verbindung."),
      ol(
        "Lade den VPN-Client aus dem Software-Portal herunter.",
        "Melde dich mit deinem Firmenkonto an.",
        "Bestätige die Anmeldung mit der Authenticator-App.",
        "Wähle das Profil „Muster Möbel intern“ und verbinde dich.",
      ),
      h3("Probleme?"),
      p(
        "Schreibe an den IT-Support (it-support@muster-moebel.example) und nenne dein Betriebssystem und die Fehlermeldung.",
      ),
    ),
    contentEn: doc(
      h2("Work securely from anywhere"),
      p("Outside the office you need a VPN connection to reach internal systems."),
      ol(
        "Download the VPN client from the software portal.",
        "Sign in with your company account.",
        "Confirm the sign-in with the authenticator app.",
        'Select the profile "Muster Möbel internal" and connect.',
      ),
      h3("Problems?"),
      p(
        "Write to IT support (it-support@muster-moebel.example) and include your operating system and the error message.",
      ),
    ),
  },
  {
    key: "wifi",
    moduleKey: "it",
    status: "published",
    titleDe: "WLAN im Büro",
    titleEn: "Wi-Fi in the office",
    contentDe: doc(
      h2("Netzwerke"),
      ul(
        "MM-Staff: für Firmengeräte, Anmeldung mit deinem Firmenkonto",
        "MM-Guest: für Besuch und private Geräte, Zugangsdaten am Empfang",
      ),
      p("Private Geräte gehören nicht in das Netzwerk MM-Staff."),
    ),
    contentEn: doc(
      h2("Networks"),
      ul(
        "MM-Staff: for company devices, sign in with your company account",
        "MM-Guest: for visitors and private devices, credentials at the reception",
      ),
      p("Private devices do not belong on the MM-Staff network."),
    ),
  },
  {
    key: "accounts",
    moduleKey: "it",
    status: "published",
    titleDe: "Accounts und Passwörter",
    titleEn: "Accounts and passwords",
    contentDe: doc(
      h2("Deine Zugänge"),
      p("Am ersten Tag erhältst du deinen Laptop mit vorbereitetem Firmenkonto."),
      ul(
        "Firmenkonto mit E-Mail, Kalender und Chat",
        "Passwort-Manager für alle weiteren Zugänge",
        "Zwei-Faktor-Authentifizierung ist Pflicht",
      ),
      h3("Regeln"),
      ul(
        "Passwörter nie teilen oder im Klartext speichern",
        "Verdächtige E-Mails an phishing@muster-moebel.example weiterleiten",
      ),
    ),
    contentEn: doc(
      h2("Your access"),
      p("On your first day you receive your laptop with a prepared company account."),
      ul(
        "Company account with email, calendar and chat",
        "Password manager for all further access",
        "Two-factor authentication is mandatory",
      ),
      h3("Rules"),
      ul(
        "Never share passwords or store them in plain text",
        "Forward suspicious emails to phishing@muster-moebel.example",
      ),
    ),
  },
  {
    key: "tech-stack",
    moduleKey: "engineering",
    status: "published",
    titleDe: "Unser Tech-Stack",
    titleEn: "Our tech stack",
    contentDe: doc(
      h2("Womit wir bauen"),
      ul(
        "Frontend: TypeScript, React, Next.js",
        "Backend: TypeScript und Java-Services hinter einer GraphQL-Schicht",
        "Daten: PostgreSQL, Redis, Elasticsearch",
        "Betrieb: Docker, Kubernetes, GitHub Actions",
      ),
      p(
        "Architekturentscheidungen halten wir als kurze Entscheidungsdokumente im Repository fest.",
      ),
    ),
    contentEn: doc(
      h2("What we build with"),
      ul(
        "Frontend: TypeScript, React, Next.js",
        "Backend: TypeScript and Java services behind a GraphQL layer",
        "Data: PostgreSQL, Redis, Elasticsearch",
        "Operations: Docker, Kubernetes, GitHub Actions",
      ),
      p("We record architecture decisions as short decision documents in the repository."),
    ),
  },
  {
    key: "dev-setup",
    moduleKey: "engineering",
    status: "published",
    titleDe: "Lokale Entwicklungsumgebung",
    titleEn: "Local development environment",
    contentDe: doc(
      h2("In 30 Minuten startklar"),
      ol(
        "Repository aus dem Git-Hosting klonen",
        "Docker Desktop und Node.js in der empfohlenen Version installieren",
        "Abhängigkeiten installieren und die lokale Umgebungsdatei anlegen",
        "Datenbank per Docker Compose starten und die Migrationen ausführen",
      ),
      p("Läuft etwas nicht, hilft dir dein Buddy oder der Kanal #dev-help."),
    ),
    contentEn: doc(
      h2("Ready in 30 minutes"),
      ol(
        "Clone the repository from the Git host",
        "Install Docker Desktop and Node.js in the recommended version",
        "Install dependencies and create the local environment file",
        "Start the database with Docker Compose and run the migrations",
      ),
      p("If something does not work, ask your buddy or the #dev-help channel."),
    ),
  },
  {
    key: "code-review",
    moduleKey: "engineering",
    status: "published",
    titleDe: "Code-Review-Prozess",
    titleEn: "Code review process",
    contentDe: doc(
      h2("Vier Augen für jede Änderung"),
      ul(
        "Jede Änderung läuft über einen Pull Request.",
        "Mindestens ein Review durch eine Kollegin oder einen Kollegen",
        "Die Pipeline (Lint, Tests, Build) muss grün sein.",
        "Kleine Pull Requests werden schneller und besser geprüft.",
      ),
    ),
    contentEn: doc(
      h2("Four eyes on every change"),
      ul(
        "Every change goes through a pull request.",
        "At least one review by a colleague",
        "The pipeline (lint, tests, build) must be green.",
        "Small pull requests are reviewed faster and better.",
      ),
    ),
  },
  {
    key: "frontend-guide",
    moduleKey: "engineering",
    status: "published",
    titleDe: "Frontend-Leitfaden",
    titleEn: "Frontend guide",
    contentDe: doc(
      h2("Konventionen im Frontend"),
      ul(
        "Komponenten nutzen das interne Designsystem, Farben nur über Design-Tokens.",
        "Barrierefreiheit ist Teil der Definition of Done.",
        "Komponententests mit Testing Library, Ende-zu-Ende-Tests nur für zentrale Abläufe",
      ),
    ),
    contentEn: doc(
      h2("Frontend conventions"),
      ul(
        "Components use the internal design system, colors only through design tokens.",
        "Accessibility is part of the definition of done.",
        "Component tests with Testing Library, end-to-end tests only for core flows",
      ),
    ),
  },
  {
    key: "backend-guide",
    moduleKey: "engineering",
    status: "published",
    titleDe: "Backend-Leitfaden",
    titleEn: "Backend guide",
    contentDe: doc(
      h2("Konventionen im Backend"),
      ul(
        "Datenbankzugriff nur in der Service-Schicht, jede Funktion prüft die Berechtigung.",
        "Migrationen sind klein, rückwärtskompatibel und werden mit dem Code reviewt.",
        "Fehler werden strukturiert geloggt, personenbezogene Daten gehören nicht ins Log.",
      ),
    ),
    contentEn: doc(
      h2("Backend conventions"),
      ul(
        "Database access only in the service layer, every function checks authorization.",
        "Migrations are small, backward compatible and reviewed together with the code.",
        "Errors are logged in a structured way, personal data does not belong in logs.",
      ),
    ),
  },
];
