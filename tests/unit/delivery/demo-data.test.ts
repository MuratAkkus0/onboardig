import { describe, expect, it } from "vitest";
import { isEmptyDoc } from "@/lib/domain/locale-content";
import { savePageContentSchema } from "@/lib/validation/content";
import { DEMO_MODULES, DEMO_PAGES } from "../../../scripts/demo-data/content";
import { DEMO_EVENTS } from "../../../scripts/demo-data/events";
import { DEMO_DEPARTMENTS, DEMO_JOB_ROLES } from "../../../scripts/demo-data/org";
import { DEMO_ADMIN, DEMO_PEOPLE } from "../../../scripts/demo-data/people";
import { DEMO_TEMPLATES } from "../../../scripts/demo-data/templates";

const pageKeys = new Set(DEMO_PAGES.map((page) => page.key));
const teamKeys = new Set(DEMO_DEPARTMENTS.flatMap((d) => d.teams.map((t) => t.key)));
const departmentKeys = new Set(DEMO_DEPARTMENTS.map((d) => d.key));

describe("demo data integrity", () => {
  it("keeps keys unique", () => {
    for (const list of [DEMO_PAGES, DEMO_MODULES, DEMO_TEMPLATES, DEMO_PEOPLE, DEMO_EVENTS]) {
      const keys = list.map((entry) => entry.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("only references existing modules, pages, teams, roles and templates", () => {
    const moduleKeys = new Set(DEMO_MODULES.map((m) => m.key));
    const roleKeys = new Set(DEMO_JOB_ROLES.map((r) => r.key));
    const templateKeys = new Set(DEMO_TEMPLATES.map((t) => t.key));
    for (const page of DEMO_PAGES) expect(moduleKeys.has(page.moduleKey)).toBe(true);
    for (const template of DEMO_TEMPLATES) {
      expect(template.departmentKey === "all" || departmentKeys.has(template.departmentKey)).toBe(
        true,
      );
      if (template.teamKey) expect(teamKeys.has(template.teamKey)).toBe(true);
      for (const step of template.steps) expect(pageKeys.has(step.pageKey)).toBe(true);
    }
    for (const person of DEMO_PEOPLE) {
      if (person.teamKey) expect(teamKeys.has(person.teamKey)).toBe(true);
      if (person.jobRoleKey) expect(roleKeys.has(person.jobRoleKey)).toBe(true);
      for (const key of person.templateKeys) expect(templateKeys.has(key)).toBe(true);
    }
  });

  it("only assigns published pages through templates and creates each lead before the employee", () => {
    const published = new Set(DEMO_PAGES.filter((p) => p.status === "published").map((p) => p.key));
    for (const template of DEMO_TEMPLATES) {
      for (const step of template.steps) expect(published.has(step.pageKey)).toBe(true);
    }
    const seen = new Set<string>();
    for (const person of DEMO_PEOPLE) {
      if (person.leadKey) {
        expect(seen.has(person.leadKey)).toBe(true);
        expect(DEMO_PEOPLE.find((p) => p.key === person.leadKey)?.role).toBe("team_lead");
      }
      seen.add(person.key);
    }
  });

  it("covers all roles and every employee state", () => {
    const employees = DEMO_PEOPLE.filter((p) => p.role === "employee");
    expect(DEMO_PEOPLE.filter((p) => p.role === "team_lead")).toHaveLength(2);
    expect(employees.some((p) => p.templateKeys.length === 0 && !p.archived)).toBe(true);
    expect(employees.some((p) => typeof p.completes === "number" && p.completes > 0)).toBe(true);
    expect(employees.some((p) => p.completes === "all")).toBe(true);
    expect(employees.some((p) => p.archived)).toBe(true);
  });

  it("has valid page content, EN title and content all-or-nothing, in both languages", () => {
    for (const page of DEMO_PAGES) {
      const parsed = savePageContentSchema.safeParse({
        id: "00000000-0000-4000-8000-000000000000",
        titleDe: page.titleDe,
        titleEn: page.titleEn,
        contentDe: page.contentDe,
        contentEn: page.contentEn,
      });
      expect(parsed.success, page.key).toBe(true);
      expect(isEmptyDoc(page.contentDe), page.key).toBe(false);
    }
    expect(DEMO_PAGES.filter((p) => p.titleEn === null).map((p) => p.status)).toEqual(["draft"]);
  });

  it("offers upcoming and past events and uses only fictional addresses", () => {
    expect(DEMO_EVENTS.some((e) => e.startOffsetDays > 0)).toBe(true);
    expect(DEMO_EVENTS.some((e) => e.startOffsetDays < 0)).toBe(true);
    for (const email of [DEMO_ADMIN.email, ...DEMO_PEOPLE.map((p) => p.email)]) {
      expect(email.endsWith(".example")).toBe(true);
    }
  });
});
