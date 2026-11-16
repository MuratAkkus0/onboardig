import { describe, expect, it } from "vitest";
import {
  assertPermission,
  canAccessRoute,
  canManagePlanOf,
  canViewProgressOf,
  hasPermission,
  PERMISSIONS,
  type Permission,
} from "@/server/auth/permissions";
import type { Actor, Role } from "@/server/auth/types";
import { AppError } from "@/server/errors";

function actor(role: Role, id = "actor-1"): Actor {
  return {
    id,
    role,
    email: "a@example.test",
    firstName: "A",
    lastName: "B",
    locale: "de",
    theme: "system",
  };
}

describe("permissions", () => {
  it("matches the permission matrix", () => {
    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
      for (const role of ["admin", "team_lead", "employee"] as const) {
        expect(hasPermission(actor(role), permission as Permission)).toBe(
          (roles as readonly Role[]).includes(role),
        );
      }
    }
  });

  it("keeps hard-delete style operations admin-only while leads may edit content and templates", () => {
    expect(PERMISSIONS["content.manage"]).toEqual(["admin"]);
    expect(PERMISSIONS["templates.manage"]).toEqual(["admin"]);
    expect(PERMISSIONS["content.edit"]).toEqual(["team_lead", "admin"]);
    expect(PERMISSIONS["templates.edit"]).toEqual(["team_lead", "admin"]);
  });

  it("throws FORBIDDEN when a permission is missing", () => {
    expect(() => assertPermission(actor("employee"), "org.manage")).toThrow(AppError);
    expect(() => assertPermission(actor("admin"), "org.manage")).not.toThrow();
  });

  it("limits plan management to admins and the lead of the target", () => {
    const target = { id: "emp", leadId: "lead-1" };
    expect(canManagePlanOf(actor("admin"), target)).toBe(true);
    expect(canManagePlanOf(actor("team_lead", "lead-1"), target)).toBe(true);
    expect(canManagePlanOf(actor("team_lead", "lead-2"), target)).toBe(false);
    expect(canManagePlanOf(actor("employee", "emp"), target)).toBe(false);
  });

  it("lets self, admins and the lead view progress", () => {
    const target = { id: "emp", leadId: "lead-1" };
    expect(canViewProgressOf(actor("employee", "emp"), target)).toBe(true);
    expect(canViewProgressOf(actor("employee", "other"), target)).toBe(false);
    expect(canViewProgressOf(actor("admin"), target)).toBe(true);
    expect(canViewProgressOf(actor("team_lead", "lead-1"), target)).toBe(true);
    expect(canViewProgressOf(actor("team_lead", "lead-2"), target)).toBe(false);
  });
});

describe("canAccessRoute", () => {
  it("restricts admin, team and library prefixes", () => {
    expect(canAccessRoute("admin", "/admin")).toBe(true);
    expect(canAccessRoute("admin", "/admin/users/123")).toBe(true);
    expect(canAccessRoute("team_lead", "/admin")).toBe(false);
    expect(canAccessRoute("employee", "/admin/org")).toBe(false);
    expect(canAccessRoute("team_lead", "/team/abc")).toBe(true);
    expect(canAccessRoute("employee", "/team")).toBe(false);
    expect(canAccessRoute("team_lead", "/library")).toBe(true);
    expect(canAccessRoute("employee", "/library")).toBe(false);
    expect(canAccessRoute("team_lead", "/templates")).toBe(true);
    expect(canAccessRoute("team_lead", "/templates/new")).toBe(true);
    expect(canAccessRoute("admin", "/templates")).toBe(true);
    expect(canAccessRoute("employee", "/templates")).toBe(false);
  });

  it("leaves other routes open and does not match on partial prefixes", () => {
    expect(canAccessRoute("employee", "/plan")).toBe(true);
    expect(canAccessRoute("employee", "/pages/1")).toBe(true);
    expect(canAccessRoute("employee", "/administrator")).toBe(true);
    expect(canAccessRoute("employee", "/teams")).toBe(true);
  });
});
