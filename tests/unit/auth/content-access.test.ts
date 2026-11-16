import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { canEditModule, canEditPage, canManageTemplate, canViewTemplate } =
  await import("@/server/services/content-access");

describe("canEditModule / canEditPage", () => {
  it("admins edit everything, including company-wide modules", () => {
    expect(canEditModule("all", { departmentId: null })).toBe(true);
    expect(canEditModule("all", { departmentId: "dep-a" })).toBe(true);
  });

  it("leads edit only modules of their own department", () => {
    expect(canEditModule("dep-a", { departmentId: "dep-a" })).toBe(true);
    expect(canEditModule("dep-a", { departmentId: "dep-b" })).toBe(false);
    expect(canEditModule("dep-a", { departmentId: null })).toBe(false);
  });

  it("nobody without a department edits anything", () => {
    expect(canEditModule(null, { departmentId: "dep-a" })).toBe(false);
    expect(canEditModule(null, { departmentId: null })).toBe(false);
  });

  it("a page follows its module", () => {
    expect(canEditPage("dep-a", { moduleDepartmentId: "dep-a" })).toBe(true);
    expect(canEditPage("dep-a", { moduleDepartmentId: null })).toBe(false);
  });
});

describe("canViewTemplate / canManageTemplate", () => {
  const own = { departmentId: "dep-a", leadManaged: true };

  it("leads view company-wide and own-department templates only", () => {
    expect(canViewTemplate("dep-a", { departmentId: null })).toBe(true);
    expect(canViewTemplate("dep-a", { departmentId: "dep-a" })).toBe(true);
    expect(canViewTemplate("dep-a", { departmentId: "dep-b" })).toBe(false);
    expect(canViewTemplate(null, { departmentId: null })).toBe(true);
    expect(canViewTemplate(null, { departmentId: "dep-a" })).toBe(false);
    expect(canViewTemplate("all", { departmentId: "dep-b" })).toBe(true);
  });

  it("leads manage only lead-managed templates of their department; admins everything", () => {
    expect(canManageTemplate("dep-a", own)).toBe(true);
    expect(canManageTemplate("dep-a", { ...own, leadManaged: false })).toBe(false);
    expect(canManageTemplate("dep-a", { ...own, departmentId: "dep-b" })).toBe(false);
    expect(canManageTemplate("dep-a", { ...own, departmentId: null })).toBe(false);
    expect(canManageTemplate(null, own)).toBe(false);
    expect(canManageTemplate("all", { departmentId: null, leadManaged: false })).toBe(true);
  });
});
