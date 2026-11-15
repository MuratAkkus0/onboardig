import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { Tx } from "@/server/db/client";
import { users } from "@/server/db/schema";
import type { Role } from "@/server/auth/types";
import type { OnboardingStatus } from "@/lib/domain/onboarding-status";

export interface LockedUser {
  id: string;
  leadId: string | null;
  role: Role;
  onboardingStatus: OnboardingStatus;
}

/**
 * Internal (trusted callers, no auth check): locks one user row FOR UPDATE. Every transaction
 * that changes a user's plan, completions or onboarding status takes this lock first.
 * Not the K§4 page edit lease (that lives in `locks.ts`).
 */
export async function lockUserInTx(tx: Tx, userId: string): Promise<LockedUser | null> {
  const [row] = await tx
    .select({
      id: users.id,
      leadId: users.leadId,
      role: users.role,
      onboardingStatus: users.onboardingStatus,
    })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  return row ?? null;
}

/** Internal: locks many users in ascending id order (deadlock avoidance). Returns the locked ids. */
export async function lockUsersInTx(tx: Tx, userIds: readonly string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, [...userIds]))
    .orderBy(users.id)
    .for("update");
  return rows.map((row) => row.id);
}

/** Internal: locks all non-archived admins; call before counting them for last-admin checks. */
export async function lockActiveAdminsInTx(tx: Tx): Promise<string[]> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), ne(users.onboardingStatus, "archived")))
    .orderBy(users.id)
    .for("update");
  return rows.map((row) => row.id);
}
