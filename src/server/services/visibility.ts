import "server-only";
import { and, eq, exists, inArray, or, sql, type SQL } from "drizzle-orm";
import type { Actor } from "@/server/auth/types";
import type { DbExecutor } from "@/server/db/client";
import { modules, pages, teams, userPlanSteps, users } from "@/server/db/schema";

export interface VisibilityOptions {
  /** Honoured for admins and, for their own department's pages, team leads. */
  includeArchived?: boolean;
}

/**
 * The single "which pages may this actor see" rule (pages, uploads, plans, search use it).
 * - employee: published pages that are part of their own plan
 * - team_lead: published pages plus draft pages of modules owned by their own department
 *   (archived ones too with `includeArchived`, for library management); a lead without a team
 *   owns no department
 * - admin: draft and published; archived only with `includeArchived`
 */
export function visiblePagesCondition(actor: Actor, options: VisibilityOptions = {}): SQL {
  switch (actor.role) {
    case "employee":
      return and(
        eq(pages.status, "published"),
        exists(
          sql`(select 1 from ${userPlanSteps} where ${userPlanSteps.userId} = ${actor.id} and ${userPlanSteps.pageId} = ${pages.id})`,
        ),
      ) as SQL;
    case "team_lead":
      return or(
        eq(pages.status, "published"),
        and(
          inArray(
            pages.status,
            options.includeArchived ? (["draft", "archived"] as const) : (["draft"] as const),
          ),
          exists(
            sql`(select 1 from ${modules} inner join ${teams} on ${teams.departmentId} = ${modules.departmentId} inner join ${users} on ${users.teamId} = ${teams.id} where ${modules.id} = ${pages.moduleId} and ${users.id} = ${actor.id})`,
          ),
        ),
      ) as SQL;
    case "admin":
      return options.includeArchived
        ? sql`true`
        : inArray(pages.status, ["draft", "published"] as const);
  }
}

/** Same rule as `visiblePagesCondition`, for one page inside a transaction. */
export async function canViewPageInTx(
  tx: DbExecutor,
  actor: Actor,
  pageId: string,
  options: VisibilityOptions = {},
): Promise<boolean> {
  const [row] = await tx
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), visiblePagesCondition(actor, options)))
    .limit(1);
  return row !== undefined;
}
