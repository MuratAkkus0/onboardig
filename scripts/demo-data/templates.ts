import type { DemoTemplate } from "./types";

export const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    key: "company",
    name: "Allgemeines Onboarding",
    description: "Für alle neuen Mitarbeitenden, unabhängig von Abteilung und Team.",
    departmentKey: "all",
    teamKey: null,
    steps: [
      { pageKey: "welcome", phase: "before_start" },
      { pageKey: "working-hours", phase: "before_start" },
      { pageKey: "culture", phase: "first_day" },
      { pageKey: "wifi", phase: "first_day" },
      { pageKey: "accounts", phase: "first_day" },
      { pageKey: "vacation", phase: "first_week" },
      { pageKey: "team-day", phase: "first_week" },
      { pageKey: "company-week", phase: "first_month" },
      { pageKey: "hackathon", phase: "first_month" },
    ],
  },
  {
    key: "it",
    name: "IT-Onboarding",
    description: "Zugänge, Werkzeuge und gemeinsame Arbeitsweise in der IT-Abteilung.",
    departmentKey: "it",
    teamKey: null,
    steps: [
      { pageKey: "vpn", phase: "first_day" },
      { pageKey: "dev-setup", phase: "first_week" },
      { pageKey: "tech-stack", phase: "first_week" },
      { pageKey: "code-review", phase: "first_month" },
    ],
  },
  {
    key: "frontend",
    name: "Frontend-Onboarding",
    description: "Zusätzliche Inhalte für das Frontend-Team.",
    departmentKey: "it",
    teamKey: "frontend",
    steps: [{ pageKey: "frontend-guide", phase: "first_week" }],
  },
  {
    key: "backend",
    name: "Backend-Onboarding",
    description: "Zusätzliche Inhalte für das Backend-Team.",
    departmentKey: "it",
    teamKey: "backend",
    steps: [{ pageKey: "backend-guide", phase: "first_week" }],
  },
];
