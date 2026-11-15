import "server-only";
import { and, eq, exists, inArray, sql, type SQL } from "drizzle-orm";
import type { Actor } from "@/server/auth/types";
import type { Tx } from "@/server/db/client";
import { pages, userPlanSteps } from "@/server/db/schema";

export interface VisibilityOptions {
  /** Honoured for admins only (e.g. admin preview). */
  includeArchived?: boolean;
}

/**
 * The single "which pages may this actor see" rule (pages, uploads, plans, search use it).
 * - employee: published pages that are part of their own plan
 * - team_lead: published pages (the library, which includes their own plan pages)
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
      return eq(pages.status, "published");
    case "admin":
      return options.includeArchived
        ? sql`true`
        : inArray(pages.status, ["draft", "published"] as const);
  }
}

/** Same rule as `visiblePagesCondition`, for one page inside a transaction. */
export async function canViewPageInTx(
  tx: Tx,
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
