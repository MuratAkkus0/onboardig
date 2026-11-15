import { NAVIGATION, F2B_CONFIG, ROUTES } from "@/config/app";
import type { Role } from "@/server/auth/types";

export type NavItem = (typeof NAVIGATION)[number];
export type NavIconName = NavItem["icon"];
export interface VisibleNavItem {
  key: NavItem["key"];
  href: string;
  icon: NavIconName;
  section: "main" | "admin";
}

/** Navigation entries of the role, in config order. */
export function getVisibleNavigation(role: Role): VisibleNavItem[] {
  return NAVIGATION.filter((item) => (item.roles as readonly Role[]).includes(role)).map(
    (item) => ({
      key: item.key,
      href: item.href,
      icon: item.icon,
      section: "section" in item ? item.section : "main",
    }),
  );
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
