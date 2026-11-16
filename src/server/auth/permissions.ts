import { ROUTE_ACCESS } from "@/config/app";
import { AppError } from "@/server/errors";
import type { Actor, Role } from "./types";

export const PERMISSIONS = {
  "plan.viewOwn": ["employee", "team_lead", "admin"],
  "plan.completeOwn": ["employee", "team_lead", "admin"],
  "library.read": ["team_lead", "admin"],
  "plan.manage": ["team_lead", "admin"], // + scope check: lead only for own employees
  "progress.viewOthers": ["team_lead", "admin"], // + scope check
  "content.manage": ["admin"], // admin-only content operations: module order/department, page hard delete
  "content.edit": ["team_lead", "admin"], // modules, pages, uploads, locks + scope check (own department)
  "templates.manage": ["admin"],
  "templates.edit": ["team_lead", "admin"], // + scope check (lead-managed templates of own department)
  "org.manage": ["admin"], // departments, teams, job roles
  "users.manage": ["admin"],
  "events.manage": ["admin"], // CRUD + announce
  "events.view": ["employee", "team_lead", "admin"],
  "feedback.create": ["employee", "team_lead", "admin"],
  "feedback.manage": ["team_lead", "admin"], // + scope check (lead: content reports of own department)
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(actor: Actor, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(actor.role);
}

/** @throws AppError("FORBIDDEN") */
export function assertPermission(actor: Actor, permission: Permission): void {
  if (!hasPermission(actor, permission)) throw new AppError("FORBIDDEN", { permission });
}

interface PlanTarget {
  id: string;
  leadId: string | null;
}

/** admin: always; team_lead: only when they are the target's lead. */
export function canManagePlanOf(actor: Actor, target: PlanTarget): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "team_lead") return target.leadId === actor.id;
  return false;
}

/** self, admin, or the lead of the target. */
export function canViewProgressOf(actor: Actor, target: PlanTarget): boolean {
  if (actor.id === target.id || actor.role === "admin") return true;
  return actor.role === "team_lead" && target.leadId === actor.id;
}

/** Prefix rules from ROUTE_ACCESS; paths not covered by a rule are open to every signed-in role. */
export function canAccessRoute(role: Role, pathname: string): boolean {
  const rule = ROUTE_ACCESS.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return rule ? (rule.roles as readonly Role[]).includes(role) : true;
}
