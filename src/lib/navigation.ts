import { NAVIGATION, F2B_CONFIG, ROUTES } from "@/config/app";
import type { Role } from "@/server/auth/types";

export type NavItem = (typeof NAVIGATION)[number];
export type NavIconName = NavItem["icon"];
export interface VisibleNavItem {
  key: NavItem["key"];
  href: string;
  icon: NavIconName;
  section: "main" | "admin";
  /** Optional count shown as a badge (e.g. open reports); omitted or 0 shows nothing. */
  badge?: number;
}

/** Badge counts by navigation key. */
export type NavBadges = Partial<Record<NavItem["key"], number>>;

/** Navigation entries of the role, in config order. */
export function getVisibleNavigation(role: Role, badges: NavBadges = {}): VisibleNavItem[] {
  return NAVIGATION.filter((item) => (item.roles as readonly Role[]).includes(role)).map((item) => {
    const badge = badges[item.key];
    return {
      key: item.key,
      href: item.href,
      icon: item.icon,
      section: "section" in item ? item.section : "main",
      ...(badge ? { badge } : {}),
    };
  });
}

/** The navigation key that carries the open-reports count for the role (null: no reports entry). */
export function reportsNavKey(role: Role): "reports" | "adminReports" | null {
  if (role === "admin") return "adminReports";
  if (role === "team_lead") return "reports";
  return null;
}

/** The role's landing page (employee: plan, team lead: team, admin: admin). */
export function homeRouteFor(role: Role): string {
  if (role === "admin") return ROUTES.admin;
  if (role === "team_lead") return ROUTES.team;
  return ROUTES.plan;
}

/** True when `pathname` is the item's route or below it (the "/" home route is never a prefix). */
export function isActiveRoute(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The href of the most specific item matching `pathname`, so a parent entry ("/admin") is not
 * highlighted together with a child entry ("/admin/users").
 */
export function activeNavHref(hrefs: readonly string[], pathname: string): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (isActiveRoute(href, pathname) && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/**
 * Accepts only same-origin absolute paths ("/plan?x=1"); protocol-relative ("//evil"), backslash
 * tricks and full URLs fall back to null.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const prefix = F2B_CONFIG.safePathPrefix;
  if (!value.startsWith(prefix) || value.startsWith(`${prefix}${prefix}`)) return null;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  return value;
}

/** Two upper-case initials from first and last name, for the avatar fallback. */
export function initialsOf(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => part.trim().charAt(0))
    .join("")
    .slice(0, F2B_CONFIG.avatarInitialsLength)
    .toUpperCase();
}
