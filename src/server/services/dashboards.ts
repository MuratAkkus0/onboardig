import "server-only";
import { and, asc, eq, ne, type SQL } from "drizzle-orm";
import { adminOverviewSchema, type AdminOverviewInput } from "@/lib/validation/dashboards";
import type { OnboardingStatus } from "@/lib/domain/onboarding-status";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { db, type DbExecutor } from "@/server/db/client";
import { departments, teams, users } from "@/server/db/schema";
import { getProgressForUsersInTx } from "./plans";

export interface OverviewRow {
  id: string;
  name: string;
  teamName: string | null;
  departmentName: string | null;
  /** ISO date (`YYYY-MM-DD`) or null. */
  startDate: string | null;
  completed: number;
  total: number;
  percent: number;
  /** Latest completion of the employee (same number as on the plan pages). */
  lastActivityAt: Date | null;
  status: OnboardingStatus;
}

export type TeamRow = OverviewRow;

/** Users matching the condition, joined with team/department, enriched with the plans progress. */
async function loadRows(executor: DbExecutor, where: SQL | undefined): Promise<OverviewRow[]> {
  const rows = await executor
    .select({
      id: users.id,
      name: users.name,
      teamName: teams.name,
      departmentName: departments.name,
      startDate: users.startDate,
      status: users.onboardingStatus,
    })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .leftJoin(departments, eq(departments.id, teams.departmentId))
    .where(where)
    .orderBy(asc(users.lastName), asc(users.firstName), asc(users.id));
  const progress = await getProgressForUsersInTx(
    executor,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const p = progress.get(row.id);
    return {
      ...row,
      completed: p?.completed ?? 0,
      total: p?.total ?? 0,
      percent: p?.percent ?? 0,
      lastActivityAt: p?.lastActivityAt ?? null,
    };
  });
}

/** Team lead / admin: the non-archived people whose lead is the actor. */
export async function getTeamOverview(actor: Actor): Promise<TeamRow[]> {
  assertPermission(actor, "progress.viewOthers");
  return db.transaction(
    (tx) => loadRows(tx, and(eq(users.leadId, actor.id), ne(users.onboardingStatus, "archived"))),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/** Admin: everyone, optionally filtered; archived people only when `status: "archived"` is asked for. */
export async function getAdminOverview(
  actor: Actor,
  input: AdminOverviewInput = {},
): Promise<OverviewRow[]> {
  assertPermission(actor, "users.manage");
  const filters = adminOverviewSchema.parse(input);
  const where = and(
    filters.status
      ? eq(users.onboardingStatus, filters.status)
      : ne(users.onboardingStatus, "archived"),
    filters.departmentId ? eq(teams.departmentId, filters.departmentId) : undefined,
    filters.teamId ? eq(users.teamId, filters.teamId) : undefined,
  );
  return db.transaction((tx) => loadRows(tx, where), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}
