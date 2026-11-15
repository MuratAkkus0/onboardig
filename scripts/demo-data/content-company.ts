import { doc, h2, h3, ol, p, ul } from "./doc";
import type { DemoPage } from "./types";

export const COMPANY_PAGES: DemoPage[] = [
  {
    key: "welcome",
    moduleKey: "culture",
    status: "published",
    titleDe: "Willkommen bei Muster Möbel",
    titleEn: "Welcome to Muster Möbel",
    contentDe: doc(
      h2("Schön, dass du da bist"),
      p(
        "Die Muster Möbel GmbH ist ein Online-Händler für Wohnen und Einrichten. Über 200 Kolleginnen und Kollegen sorgen dafür, dass Sofas, Regale und Lampen schnell und zuverlässig bei unseren Kundinnen und Kunden ankommen.",
      ),
      h3("Deine ersten Tage"),
      ul(
        "Dein Team und deine Führungskraft begrüßen dich am ersten Tag.",
        "Du bekommst einen Buddy, der dir bei allen Fragen hilft.",
        "Dieses Portal führt dich Schritt für Schritt durch dein Onboarding.",
      ),
      p(
        "Hake jede Seite mit „Erledigt“ ab, wenn du sie gelesen hast. Dein Fortschritt ist nur für dich, deine Führungskraft und die Personalabteilung sichtbar.",
      ),
    ),
    contentEn: doc(
      h2("Great to have you"),
      p(
        "Muster Möbel GmbH is an online retailer for home and living. More than 200 colleagues make sure that sofas, shelves and lamps reach our customers quickly and reliably.",
      ),
      h3("Your first days"),
      ul(
        "Your team and your manager welcome you on day one.",
        "You get a buddy who helps with any question.",
        "This portal guides you through your onboarding step by step.",
      ),
      p(
        "Mark each page as done once you have read it. Your progress is visible only to you, your manager and HR.",
      ),
    ),
  },
  {
    key: "culture",
    moduleKey: "culture",
    status: "published",
    titleDe: "Unsere Unternehmenskultur",
    titleEn: "Our company culture",
    contentDe: doc(
      h2("Wie wir zusammenarbeiten"),
      p("Wir pflegen flache Hierarchien, kurze Entscheidungswege und eine offene Feedbackkultur."),
      h3("Unsere Werte"),
      ul(
        "Kundenfokus: Jede Entscheidung beginnt bei unseren Kundinnen und Kunden.",
        "Verantwortung: Wer eine Aufgabe übernimmt, führt sie zu Ende.",
        "Offenheit: Wir teilen Wissen und sprechen Probleme früh an.",
        "Respekt: Wir behandeln einander fair, unabhängig von Rolle und Herkunft.",
      ),
      p("Fragen zur Kultur beantworten dir dein Buddy und das People-Operations-Team jederzeit."),
    ),
    contentEn: doc(
      h2("How we work together"),
      p("We value flat hierarchies, short decision paths and an open feedback culture."),
      h3("Our values"),
      ul(
        "Customer focus: every decision starts with our customers.",
        "Ownership: whoever takes on a task sees it through.",
        "Openness: we share knowledge and raise problems early.",
        "Respect: we treat each other fairly, regardless of role or background.",
      ),
      p(
        "Your buddy and the People Operations team are happy to answer any question about our culture.",
      ),
    ),
  },
  {
    key: "company-week",
    moduleKey: "culture",
    status: "published",
    titleDe: "Company Week",
    titleEn: "Company Week",
    contentDe: doc(
      h2("Eine Woche für das ganze Unternehmen"),
      p(
        "Einmal im Jahr kommen alle Standorte zur Company Week zusammen. Es gibt Vorträge, Workshops und einen gemeinsamen Abend.",
      ),
      ul(
        "Montag: Strategie-Update der Geschäftsführung",
        "Dienstag bis Donnerstag: Workshops und Abteilungs-Sessions",
        "Freitag: Sommerfest mit Grillen und Live-Musik",
      ),
      p(
        "Reisekosten und Übernachtung übernimmt die Firma. Bitte buche deine Anreise über das Reisebüro-Formular im Intranet.",
      ),
    ),
    contentEn: doc(
      h2("A week for the whole company"),
      p(
        "Once a year all locations come together for Company Week with talks, workshops and a shared evening.",
      ),
      ul(
        "Monday: strategy update from the management",
        "Tuesday to Thursday: workshops and department sessions",
        "Friday: summer party with barbecue and live music",
      ),
      p(
        "The company covers travel and accommodation. Please book your trip through the travel form in the intranet.",
      ),
    ),
  },
  {
    key: "hackathon",
    moduleKey: "culture",
    status: "published",
    titleDe: "Hackathon",
    titleEn: "Hackathon",
    contentDe: doc(
      h2("24 Stunden Ideen umsetzen"),
      p(
        "Zweimal im Jahr treffen sich Teams aus Technik, Marketing und Einkauf zum Hackathon. Ziel ist ein funktionierender Prototyp.",
      ),
      h3("Ablauf"),
      ol(
        "Ideen sammeln und Teams bilden (Vorabend)",
        "Bauen und Testen (24 Stunden)",
        "Präsentation vor der Geschäftsführung",
        "Gemeinsame Abstimmung über die Gewinneridee",
      ),
      p(
        "Gewinnerideen werden in die Roadmap aufgenommen. Du musst keine Technikerin und kein Techniker sein, um mitzumachen.",
      ),
    ),
    contentEn: doc(
      h2("Build ideas in 24 hours"),
      p(
        "Twice a year, teams from engineering, marketing and purchasing meet for the Hackathon. The goal is a working prototype.",
      ),
      h3("Schedule"),
      ol(
        "Collect ideas and form teams (evening before)",
        "Build and test (24 hours)",
        "Presentation to the management",
        "Joint vote on the winning idea",
      ),
      p("Winning ideas are added to the roadmap. You do not need to be an engineer to take part."),
    ),
  },
  {
    key: "team-day",
    moduleKey: "culture",
    status: "published",
    titleDe: "Teamtag",
    titleEn: "Team day",
    contentDe: doc(
      h2("Gemeinsam etwas erleben"),
      p(
        "Jedes Team hat pro Quartal einen Teamtag. Er dient dem Kennenlernen, dem Rückblick und der Planung.",
      ),
      ul(
        "Das Budget beträgt 60 Euro pro Person.",
        "Die Teamleitung plant den Tag gemeinsam mit dem Team.",
        "Neue Kolleginnen und Kollegen sind ab dem ersten Quartal dabei.",
      ),
    ),
    contentEn: doc(
      h2("Experience something together"),
      p(
        "Every team has a team day each quarter for getting to know each other, looking back and planning ahead.",
      ),
      ul(
        "The budget is 60 euros per person.",
        "The team lead plans the day together with the team.",
        "New colleagues join from their first quarter.",
      ),
    ),
  },
  {
    key: "vacation",
    moduleKey: "hr",
    status: "published",
    titleDe: "Urlaub und Abwesenheit",
    titleEn: "Vacation and absence",
    contentDe: doc(
      h2("Urlaub beantragen"),
      p(
        "Du hast 30 Urlaubstage pro Jahr. Im ersten Jahr erwirbst du den Anspruch anteilig pro Monat.",
      ),
      ol(
        "Urlaub im HR-Tool beantragen",
        "Deine Teamleitung genehmigt den Antrag",
        "Du erhältst eine Bestätigung per E-Mail",
      ),
      h3("Krankmeldung"),
      p(
        "Melde dich bei Krankheit bis 9 Uhr bei deiner Teamleitung. Eine ärztliche Bescheinigung ist ab dem dritten Krankheitstag nötig.",
      ),
    ),
    contentEn: doc(
      h2("Requesting vacation"),
      p("You have 30 vacation days per year. In your first year you earn them pro rata per month."),
      ol(
        "Request vacation in the HR tool",
        "Your team lead approves the request",
        "You receive a confirmation by email",
      ),
      h3("Sick leave"),
      p(
        "In case of illness, contact your team lead by 9 a.m. A medical certificate is required from the third day of illness.",
      ),
    ),
  },
  {
    key: "working-hours",
    moduleKey: "hr",
    status: "published",
    titleDe: "Arbeitszeit und Homeoffice",
    titleEn: "Working hours and remote work",
    contentDe: doc(
      h2("Flexibel arbeiten"),
      p("Wir arbeiten mit Vertrauensarbeitszeit. Die Kernzeit liegt zwischen 10 und 15 Uhr."),
      ul(
        "Bis zu drei Tage pro Woche im Homeoffice, in Absprache mit dem Team",
        "Zeiterfassung über das HR-Tool",
        "Ein Zuschuss von 25 Euro im Monat für dein Homeoffice-Internet",
      ),
    ),
    contentEn: doc(
      h2("Working flexibly"),
      p("We work with flexible hours. Core hours are between 10 a.m. and 3 p.m."),
      ul(
        "Up to three days per week remote, agreed with the team",
        "Time tracking in the HR tool",
        "A 25 euro monthly allowance for your home internet",
      ),
    ),
  },
  {
    key: "brand-guide",
    moduleKey: "marketing",
    status: "published",
    titleDe: "Markenrichtlinien",
    titleEn: "Brand guidelines",
    contentDe: doc(
      h2("So treten wir auf"),
      p(
        "Unsere Marke ist freundlich, klar und modern. Texte sprechen Kundinnen und Kunden mit „Sie“ an, intern duzen wir uns.",
      ),
      ul(
        "Logo nur in den freigegebenen Varianten verwenden",
        "Produktfotos immer auf hellem Hintergrund",
        "Keine Superlative ohne Beleg",
      ),
    ),
    contentEn: doc(
      h2("How we present ourselves"),
      p(
        "Our brand is friendly, clear and modern. Customer-facing copy uses the formal form of address in German; internally we are on first-name terms.",
      ),
      ul(
        "Use the logo only in the approved variants",
        "Product photos always on a light background",
        "No superlatives without proof",
      ),
    ),
  },
  {
    key: "campaign-tools",
    moduleKey: "marketing",
    status: "draft",
    titleDe: "Kampagnen-Tools (Entwurf)",
    titleEn: null,
    contentDe: doc(
      h2("Werkzeuge im Marketing"),
      p("Dieser Entwurf wird mit dem Marketing-Team abgestimmt, bevor er veröffentlicht wird."),
    ),
    contentEn: null,
  },
  {
    key: "legacy-timesheets",
    moduleKey: "hr",
    status: "archived",
    titleDe: "Zeiterfassung per Excel (veraltet)",
    titleEn: "Time tracking with Excel (obsolete)",
    contentDe: doc(
      h2("Nicht mehr in Gebrauch"),
      p(
        "Die Zeiterfassung läuft seit diesem Jahr über das HR-Tool. Diese Seite bleibt nur zur Dokumentation erhalten.",
      ),
    ),
    contentEn: doc(
      h2("No longer in use"),
      p(
        "Time tracking has moved to the HR tool this year. This page is kept for documentation only.",
      ),
    ),
  },
];
