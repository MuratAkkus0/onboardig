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

/** `departmentKey` null = company-wide role. */
export const DEMO_JOB_ROLES: { key: string; name: string; departmentKey: string | null }[] = [
  { key: "frontend-dev", name: "Frontend-Entwickler/in", departmentKey: "it" },
  { key: "backend-dev", name: "Backend-Entwickler/in", departmentKey: "it" },
  { key: "eng-lead", name: "Engineering Lead", departmentKey: "it" },
  { key: "hr-lead", name: "Leitung People Operations", departmentKey: "hr" },
  { key: "hr-generalist", name: "HR Generalist", departmentKey: "hr" },
  { key: "marketing-manager", name: "Marketing Manager/in", departmentKey: "marketing" },
  { key: "working-student", name: "Werkstudent/in", departmentKey: null },
  { key: "intern", name: "Praktikant/in", departmentKey: null },
];
