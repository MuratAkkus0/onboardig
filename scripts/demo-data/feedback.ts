import type { DemoReport } from "./types";

/** Fictional problem reports: open content issue (lead scope), open app bug (admin only), resolved one. */
export const DEMO_REPORTS: DemoReport[] = [
  {
    key: "stack-outdated",
    reporterKey: "lena",
    type: "content_issue",
    subject: "Versionsangabe im Tech-Stack veraltet",
    message: "Auf der Seite steht noch die alte Node-Version. Bitte aktualisieren.",
    pageKey: "tech-stack",
    resolution: null,
  },
  {
    key: "plan-slow",
    reporterKey: "tim",
    type: "app_bug",
    subject: "Plan lädt sehr langsam",
    message: "Nach dem Anmelden dauert es mehrere Sekunden, bis mein Plan erscheint.",
    pageKey: null,
    resolution: null,
  },
  {
    key: "setup-typo",
    reporterKey: "paul",
    type: "content_issue",
    subject: "Tippfehler in der Entwicklungsumgebung",
    message: "Im Abschnitt zur Installation fehlt ein Wort im zweiten Satz.",
    pageKey: "dev-setup",
    resolution: {
      handlerKey: "jonas",
      status: "done",
      response: "Danke für den Hinweis, der Text ist korrigiert.",
    },
  },
];
