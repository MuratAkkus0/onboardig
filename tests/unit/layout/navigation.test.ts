import { describe, expect, it } from "vitest";
import { LOCALES, NAVIGATION, ROLES, ROUTES } from "@/config/app";
import { NAV_ICONS } from "@/components/layout/nav-icons";
import {
  activeNavHref,
  getVisibleNavigation,
  homeRouteFor,
  initialsOf,
  isActiveRoute,
  safeNextPath,
} from "@/lib/navigation";
import { canAccessRoute } from "@/server/auth/permissions";
import { readNamespaces } from "../i18n/messages";

const keys = (role: (typeof ROLES)[number]) => getVisibleNavigation(role).map((item) => item.key);

describe("navigation per role", () => {
  it("shows exactly the entries of the role", () => {
    expect(keys("employee")).toEqual(["plan", "events", "search"]);
    expect(keys("team_lead")).toEqual(["plan", "events", "search", "team", "library", "templates"]);
    expect(keys("admin")).toEqual([
      "plan",
      "events",
      "search",
      "team",
      "adminOverview",
      "adminUsers",
      "adminOrg",
      "adminJobRoles",
      "adminLibrary",
      "adminTemplates",
      "adminEvents",
    ]);
  });

  it("never offers a link the role cannot open", () => {
    for (const role of ROLES) {
      for (const item of getVisibleNavigation(role)) {
        expect(canAccessRoute(role, item.href), `${role} ${item.href}`).toBe(true);
      }
    }
  });

  it("marks admin entries with the admin section", () => {
    const admin = getVisibleNavigation("admin");
    expect(admin.filter((item) => item.section === "admin")).toHaveLength(7);
  });

  it("has an icon and a label in every locale for every entry", () => {
    for (const item of NAVIGATION) expect(NAV_ICONS[item.icon]).toBeDefined();
    for (const locale of LOCALES) {
      const nav = readNamespaces(locale).nav ?? {};
      for (const item of NAVIGATION)
        expect(typeof nav[item.key], `${locale} ${item.key}`).toBe("string");
    }
  });

  it("redirects each role to its landing page", () => {
    expect(homeRouteFor("employee")).toBe(ROUTES.plan);
    expect(homeRouteFor("team_lead")).toBe(ROUTES.team);
    expect(homeRouteFor("admin")).toBe(ROUTES.admin);
  });
});

describe("isActiveRoute", () => {
  it("matches the route and its children only", () => {
    expect(isActiveRoute("/admin", "/admin")).toBe(true);
    expect(isActiveRoute("/admin/users", "/admin/users/123")).toBe(true);
    expect(isActiveRoute("/admin/users", "/admin/users-x")).toBe(false);
  });
});

describe("activeNavHref", () => {
  const adminHrefs = getVisibleNavigation("admin").map((item) => item.href);

  it("highlights only the most specific entry", () => {
    expect(activeNavHref(adminHrefs, ROUTES.adminUsers)).toBe(ROUTES.adminUsers);
    expect(activeNavHref(adminHrefs, ROUTES.adminTemplate("1"))).toBe(ROUTES.adminTemplates);
    expect(activeNavHref(adminHrefs, ROUTES.admin)).toBe(ROUTES.admin);
  });

  it("returns null when no entry matches", () => {
    expect(activeNavHref(adminHrefs, ROUTES.profile)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("accepts in-app paths", () => {
    expect(safeNextPath("/plan")).toBe("/plan");
    expect(safeNextPath("/pages/1?x=2")).toBe("/pages/1?x=2");
  });

  it("rejects external and malformed targets", () => {
    for (const value of [
      "//evil.example",
      "https://evil.example",
      "/\\evil",
      "plan",
      "",
      null,
      undefined,
      "/a\nb",
    ]) {
      expect(safeNextPath(value)).toBeNull();
    }
  });
});

describe("initialsOf", () => {
  it("uses two upper-case letters", () => {
    expect(initialsOf("ada", "lovelace")).toBe("AL");
    expect(initialsOf("", "x")).toBe("X");
  });
});
