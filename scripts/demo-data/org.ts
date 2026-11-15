import type { DemoDepartment } from "./types";

export const DEMO_DEPARTMENTS: DemoDepartment[] = [
  {
    key: "it",
    name: "IT",
    teams: [
      { key: "frontend", name: "Frontend" },
      { key: "backend", name: "Backend" },
    ],
  },
  { key: "hr", name: "HR", teams: [{ key: "people", name: "People Operations" }] },
  { key: "marketing", name: "Marketing", teams: [{ key: "brand", name: "Brand & Content" }] },
];

export const DEMO_JOB_ROLES: { key: string; name: string }[] = [
  { key: "frontend-dev", name: "Frontend-Entwickler/in" },
  { key: "backend-dev", name: "Backend-Entwickler/in" },
  { key: "eng-lead", name: "Engineering Lead" },
  { key: "hr-lead", name: "Leitung People Operations" },
  { key: "hr-generalist", name: "HR Generalist" },
  { key: "marketing-manager", name: "Marketing Manager/in" },
];
