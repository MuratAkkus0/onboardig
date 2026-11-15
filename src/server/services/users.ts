import "server-only";
import { and, asc, eq, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ROLES } from "@/config/app";
import {
  applyOnboardingEvent,
  canDeletePermanently,
  type OnboardingStatus,
} from "@/lib/domain/onboarding-status";
import {
  createUserSchema,
  deleteUserPermanentlySchema,
  listUsersSchema,
  updateUserSchema,
  userIdInputSchema,
  type CreateUserInput,
  type DeleteUserPermanentlyInput,
  type ListUsersInput,
  type UpdateUserInput,
  type UserIdInput,
} from "@/lib/validation/users";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor, Locale } from "@/server/auth/types";
import { db, type DbExecutor, type Tx } from "@/server/db/client";
import {
  accounts,
  departments,
  invitations,
  jobRoles,
  pageEditLocks,
  sessions,
  teams,
  users,
} from "@/server/db/schema";
import { AppError, rethrowDbError } from "@/server/errors";
import { logger } from "@/server/logger";
import {
  getInvitationState,
  issueInvitationInTx,
  sendInvitationEmail,
  type InvitationState,
} from "./invitations";
import { createNotificationInTx, employeeAssignedRecipientInTx } from "./notifications-core";
import { recomputeOnboardingStatusInTx } from "./plan-hooks";
import { lockActiveAdminsIfAdminInTx, lockUserInTx, type LockedUser } from "./row-locks";

type Role = (typeof ROLES)[number];

const CREDENTIAL_PROVIDER = "credential";
const DEACTIVATED_REASON = "deactivated";
const LIKE_SPECIAL_CHARS = /[\\%_]/g;

export interface UserListItem {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: Role;
  onboardingStatus: OnboardingStatus;
  teamId: string | null;
  teamName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  jobRoleId: string | null;
  jobRoleName: string | null;
  leadId: string | null;
  leadName: string | null;
  startDate: string | null;
}

export interface UserDetail extends UserListItem {
  locale: Locale;
  invitationState: InvitationState;
  archivedAt: Date | null;
  createdAt: Date;
}

export interface LeadCandidate {
  id: string;
  name: string;
}

export interface DeactivationImpact {
  ledEmployees: { id: string; name: string }[];
}

const leads = alias(users, "leads");

function selectUserItems(executor: DbExecutor) {
  return executor
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
      role: users.role,
      onboardingStatus: users.onboardingStatus,
      teamId: users.teamId,
      teamName: teams.name,
      departmentId: departments.id,
      departmentName: departments.name,
      jobRoleId: users.jobRoleId,
      jobRoleName: jobRoles.name,
      leadId: users.leadId,
      leadName: leads.name,
      startDate: users.startDate,
      locale: users.locale,
      archivedAt: users.archivedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .leftJoin(departments, eq(departments.id, teams.departmentId))
    .leftJoin(jobRoles, eq(jobRoles.id, users.jobRoleId))
    .leftJoin(leads, eq(leads.id, users.leadId));
}

function toListItem(row: Awaited<ReturnType<typeof selectUserItems>>[number]): UserListItem {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    name: row.name,
    email: row.email,
    role: row.role,
    onboardingStatus: row.onboardingStatus,
    teamId: row.teamId,
    teamName: row.teamName,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    jobRoleId: row.jobRoleId,
    jobRoleName: row.jobRoleName,
    leadId: row.leadId,
    leadName: row.leadName,
    startDate: row.startDate,
  };
}

function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}

function fieldError(field: string, key: string): AppError {
  return new AppError("VALIDATION", { fieldErrors: { [field]: [key] } });
}

async function loadUserItem(executor: DbExecutor, id: string): Promise<UserListItem> {
  const [row] = await selectUserItems(executor).where(eq(users.id, id));
  if (!row) throw new AppError("NOT_FOUND");
  return toListItem(row);
}

async function ledEmployeesOf(
  executor: DbExecutor,
  leadId: string,
  options: { includeArchived: boolean },
): Promise<{ id: string; name: string }[]> {
  const conditions: SQL[] = [eq(users.leadId, leadId)];
  if (!options.includeArchived) conditions.push(ne(users.onboardingStatus, "archived"));
  const rows = await executor
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(users.lastName), asc(users.firstName), asc(users.id));
  return rows;
}

async function hasCredentialPassword(tx: Tx, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.providerId, CREDENTIAL_PROVIDER),
        isNotNull(accounts.password),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** Team and job role must exist; a missing one is a field error instead of a bare FK failure. */
async function assertOrgRefsExist(
  tx: Tx,
  refs: { teamId: string | null; jobRoleId: string | null },
): Promise<void> {
  if (refs.teamId) {
    const [team] = await tx.select({ id: teams.id }).from(teams).where(eq(teams.id, refs.teamId));
    if (!team) throw fieldError("teamId", "validation.invalidValue");
  }
  if (refs.jobRoleId) {
    const [role] = await tx
      .select({ id: jobRoles.id })
      .from(jobRoles)
      .where(eq(jobRoles.id, refs.jobRoleId));
    if (!role) throw fieldError("jobRoleId", "validation.invalidValue");
  }
}

/**
 * A lead must be a non-archived team lead or admin, never the user themselves, and must not sit
 * below the user in the lead chain (that would create a cycle). The candidate is locked FOR SHARE
 * so a concurrent deactivation or demotion of the candidate serializes with this check; two
 * concurrent changes that would close a cycle wait on each other's rows and one of them is
 * aborted as a deadlock (mapped to CONFLICT).
 */
async function assertValidLeadInTx(
  tx: Tx,
  input: { userId: string | null; leadId: string },
): Promise<void> {
  if (input.userId !== null && input.userId === input.leadId) {
    throw fieldError("leadId", "users.errors.leadSelf");
  }
  const [lead] = await tx
    .select({ role: users.role, onboardingStatus: users.onboardingStatus })
    .from(users)
    .where(eq(users.id, input.leadId))
    .for("share");
  if (!lead || lead.onboardingStatus === "archived" || lead.role === "employee") {
    throw fieldError("leadId", "users.errors.leadInvalid");
  }
  if (input.userId === null) return;
  const cycle = await tx.execute(sql`
    WITH RECURSIVE chain(id, lead_id) AS (
      SELECT id, lead_id FROM users WHERE id = ${input.leadId}
      UNION
      SELECT u.id, u.lead_id FROM users u JOIN chain c ON u.id = c.lead_id WHERE c.id <> ${input.userId}
    )
    SELECT 1 FROM chain WHERE id = ${input.userId} LIMIT 1
  `);
  if (cycle.rows.length > 0) throw fieldError("leadId", "users.errors.leadCycle");
}

/**
 * The target is an admin who is about to stop being an active admin: refuse for the last one.
 * `activeAdminIds` must come from `lockActiveAdminsIfAdminInTx`, taken before the user lock.
 */
function assertNotLastAdmin(activeAdminIds: string[], target: LockedUser): void {
  if (target.role !== "admin") return;
  // The role changed to admin after the admin set was locked: let the caller retry.
  if (!activeAdminIds.includes(target.id)) throw new AppError("CONFLICT");
  if (activeAdminIds.length <= 1) throw new AppError("LAST_ADMIN");
}

async function notifyLeadAssigned(
  tx: Tx,
  input: { leadId: string | null; actorId: string; subjectUserId: string; employeeName: string },
): Promise<void> {
  const recipient = await employeeAssignedRecipientInTx(tx, {
    leadId: input.leadId,
    actorId: input.actorId,
  });
  if (!recipient) return;
  await createNotificationInTx(tx, {
    userId: recipient,
    type: "employee_assigned",
    subjectUserId: input.subjectUserId,
    params: { employeeName: input.employeeName },
  });
}

// ---- queries ----

/** Admin: users filtered by status, role, department, team and a name/e-mail search. */
export async function listUsers(actor: Actor, input: ListUsersInput = {}): Promise<UserListItem[]> {
  assertPermission(actor, "users.manage");
  const filters = listUsersSchema.parse(input);
  const conditions: (SQL | undefined)[] = [
    filters.status ? eq(users.onboardingStatus, filters.status) : undefined,
    filters.role ? eq(users.role, filters.role) : undefined,
    filters.departmentId ? eq(teams.departmentId, filters.departmentId) : undefined,
    filters.teamId ? eq(users.teamId, filters.teamId) : undefined,
  ];
  if (filters.q) {
    const pattern = `%${filters.q.replace(LIKE_SPECIAL_CHARS, "\\$&")}%`;
    conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern)));
  }
  const rows = await selectUserItems(db)
    .where(and(...conditions))
    .orderBy(asc(users.lastName), asc(users.firstName), asc(users.id));
  return rows.map(toListItem);
}

/** Admin: one user including the invitation state. */
export async function getUser(actor: Actor, input: UserIdInput): Promise<UserDetail> {
  assertPermission(actor, "users.manage");
  const { id } = userIdInputSchema.parse(input);
  const [row] = await selectUserItems(db).where(eq(users.id, id));
  if (!row) throw new AppError("NOT_FOUND");
  const invitationState = await getInvitationState(actor, { userId: id });
  return {
    ...toListItem(row),
    locale: row.locale,
    invitationState,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
  };
}

/** Admin: non-archived team leads and admins that can be chosen as a lead. */
export async function listLeadCandidates(actor: Actor): Promise<LeadCandidate[]> {
  assertPermission(actor, "users.manage");
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(ne(users.role, "employee"), ne(users.onboardingStatus, "archived")))
    .orderBy(asc(users.lastName), asc(users.firstName), asc(users.id));
}

/**
 * Admin: the people who currently have this user as their lead. Before deactivating only active
 * people count; for an archived user (permanent delete) archived people count too, because they
 * block the deletion.
 */
export async function getUserDeactivationImpact(
  actor: Actor,
  input: UserIdInput,
): Promise<DeactivationImpact> {
  assertPermission(actor, "users.manage");
  const { id } = userIdInputSchema.parse(input);
  const [user] = await db
    .select({ id: users.id, onboardingStatus: users.onboardingStatus })
    .from(users)
    .where(eq(users.id, id));
  if (!user) throw new AppError("NOT_FOUND");
  return {
    ledEmployees: await ledEmployeesOf(db, id, {
      includeArchived: user.onboardingStatus === "archived",
    }),
  };
}

// ---- mutations ----

/**
 * Admin: creates the account (no password yet), issues the invitation and notifies the lead
 * (not when the actor names themselves). The invitation mail goes out after commit.
 */
export async function createUser(
  actor: Actor,
  input: CreateUserInput,
): Promise<{ user: UserListItem; inviteSent: boolean }> {
  assertPermission(actor, "users.manage");
  const data = createUserSchema.parse(input);

  let created: { id: string; token: string };
  try {
    created = await db.transaction(async (tx) => {
      await assertOrgRefsExist(tx, data);
      if (data.leadId) await assertValidLeadInTx(tx, { userId: null, leadId: data.leadId });
      const [row] = await tx
        .insert(users)
        .values({
          name: fullName(data),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: data.role,
          teamId: data.teamId,
          jobRoleId: data.jobRoleId,
          leadId: data.leadId,
          startDate: data.startDate,
          locale: data.locale,
        })
        .returning({ id: users.id });
      if (!row) throw new AppError("INTERNAL");
      const { token } = await issueInvitationInTx(tx, { userId: row.id, createdBy: actor.id });
      await notifyLeadAssigned(tx, {
        leadId: data.leadId,
        actorId: actor.id,
        subjectUserId: row.id,
        employeeName: fullName(data),
      });
      return { id: row.id, token };
    });
  } catch (e) {
    return rethrowDbError(e, { unique: "EMAIL_TAKEN" });
  }

  const { sent } = await sendInvitationEmail({ userId: created.id, token: created.token });
  logger.info({ action: "users.create", entityId: created.id, actorId: actor.id }, "mutation");
  return { user: await loadUserItem(db, created.id), inviteSent: sent };
}

/**
 * Admin: edits profile, org assignment and role. See blueprint 4.4 for the rules: lead validated
 * only when it changes, role -> employee refused while leading others, last admin protected,
 * e-mail locked once the invitation was accepted (a changed address gets a fresh invitation).
 */
export async function updateUser(actor: Actor, input: UpdateUserInput): Promise<UserDetail> {
  assertPermission(actor, "users.manage");
  const data = updateUserSchema.parse(input);

  let reinvite: { token: string } | null = null;
  try {
    reinvite = await db.transaction(async (tx) => {
      // Lock order: active admins (ascending id, only when the target is an admin) -> the user ->
      // the candidate lead.
      const activeAdminIds =
        data.role === "admin" ? [] : await lockActiveAdminsIfAdminInTx(tx, data.id);
      const locked = await lockUserInTx(tx, data.id);
      if (!locked) throw new AppError("NOT_FOUND");
      const [current] = await tx.select().from(users).where(eq(users.id, data.id));
      if (!current) throw new AppError("NOT_FOUND");
      if (current.onboardingStatus === "archived") {
        throw new AppError("CONFLICT", { reasonKey: "users.errors.userArchived" });
      }

      if (locked.role === "admin" && data.role !== "admin") {
        assertNotLastAdmin(activeAdminIds, locked);
      }
      if (data.role === "employee" && locked.role !== "employee") {
        const led = await ledEmployeesOf(tx, data.id, { includeArchived: true });
        if (led.length > 0) {
          throw new AppError("IN_USE", {
            reasonKey: "users.errors.leadsEmployees",
            ledEmployees: led,
          });
        }
      }

      const emailChanged = data.email !== current.email;
      if (emailChanged && (await hasCredentialPassword(tx, data.id))) {
        throw new AppError("CONFLICT", { reasonKey: "users.errors.emailLocked" });
      }
      await assertOrgRefsExist(tx, {
        teamId: data.teamId === current.teamId ? null : data.teamId,
        jobRoleId: data.jobRoleId === current.jobRoleId ? null : data.jobRoleId,
      });
      const leadChanged = data.leadId !== current.leadId;
      if (leadChanged && data.leadId) {
        await assertValidLeadInTx(tx, { userId: data.id, leadId: data.leadId });
      }

      await tx
        .update(users)
        .set({
          name: fullName(data),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: data.role,
          teamId: data.teamId,
          jobRoleId: data.jobRoleId,
          leadId: data.leadId,
          startDate: data.startDate,
          locale: data.locale,
          updatedAt: new Date(),
        })
        .where(eq(users.id, data.id));

      if (leadChanged) {
        await notifyLeadAssigned(tx, {
          leadId: data.leadId,
          actorId: actor.id,
          subjectUserId: data.id,
          employeeName: fullName(data),
        });
      }
      return emailChanged
        ? issueInvitationInTx(tx, { userId: data.id, createdBy: actor.id })
        : null;
    });
  } catch (e) {
    return rethrowDbError(e, { unique: "EMAIL_TAKEN" });
  }

  if (reinvite) await sendInvitationEmail({ userId: data.id, token: reinvite.token });
  logger.info({ action: "users.update", entityId: data.id, actorId: actor.id }, "mutation");
  return getUser(actor, { id: data.id });
}

/**
 * Admin: archives the user. Sessions are deleted at once and sign-in is refused (`banned`).
 * Employees that still have this user as lead keep the reference until reassigned (blueprint P4).
 * @throws AppError FORBIDDEN (reasonKey users.errors.cannotDeactivateSelf), LAST_ADMIN,
 *   INVALID_TRANSITION when already archived
 */
export async function deactivateUser(actor: Actor, input: UserIdInput): Promise<void> {
  assertPermission(actor, "users.manage");
  const { id } = userIdInputSchema.parse(input);
  if (id === actor.id) {
    throw new AppError("FORBIDDEN", { reasonKey: "users.errors.cannotDeactivateSelf" });
  }
  try {
    await db.transaction(async (tx) => {
      const activeAdminIds = await lockActiveAdminsIfAdminInTx(tx, id);
      const locked = await lockUserInTx(tx, id);
      if (!locked) throw new AppError("NOT_FOUND");
      const transition = applyOnboardingEvent(locked.onboardingStatus, { type: "deactivate" });
      assertNotLastAdmin(activeAdminIds, locked);

      const now = new Date();
      await tx
        .update(users)
        .set({
          banned: true,
          banReason: DEACTIVATED_REASON,
          onboardingStatus: transition.status,
          archivedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, id));
      await tx.delete(sessions).where(eq(sessions.userId, id));
      await tx
        .update(invitations)
        .set({ revokedAt: now })
        .where(
          and(
            eq(invitations.userId, id),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
          ),
        );
      await tx.delete(pageEditLocks).where(eq(pageEditLocks.userId, id));
    });
  } catch (e) {
    return rethrowDbError(e);
  }
  logger.info({ action: "users.deactivate", entityId: id, actorId: actor.id }, "mutation");
}

/** Admin: archived -> active, then a silent recompute (no completion notification, blueprint P2). */
export async function reactivateUser(actor: Actor, input: UserIdInput): Promise<void> {
  assertPermission(actor, "users.manage");
  const { id } = userIdInputSchema.parse(input);
  try {
    await db.transaction(async (tx) => {
      const locked = await lockUserInTx(tx, id);
      if (!locked) throw new AppError("NOT_FOUND");
      const transition = applyOnboardingEvent(locked.onboardingStatus, { type: "reactivate" });
      await tx
        .update(users)
        .set({
          banned: false,
          banReason: null,
          banExpires: null,
          onboardingStatus: transition.status,
          onboardingCompletedAt: null,
          archivedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
      await recomputeOnboardingStatusInTx(tx, { userId: id, notify: false });
    });
  } catch (e) {
    return rethrowDbError(e);
  }
  logger.info({ action: "users.reactivate", entityId: id, actorId: actor.id }, "mutation");
}

/**
 * Admin: deletes an archived user and, via FK cascade, everything of theirs (sessions, accounts,
 * invitations, plan, completions, own notifications and every notification about them).
 * Archived users are never in the active admin set, so this cannot remove the last admin.
 * @throws AppError INVALID_TRANSITION unless archived, IN_USE while they lead anyone,
 *   VALIDATION when `confirmName` is not the full name
 */
export async function deleteUserPermanently(
  actor: Actor,
  input: DeleteUserPermanentlyInput,
): Promise<void> {
  assertPermission(actor, "users.manage");
  const { id, confirmName } = deleteUserPermanentlySchema.parse(input);
  try {
    await db.transaction(async (tx) => {
      const locked = await lockUserInTx(tx, id);
      if (!locked) throw new AppError("NOT_FOUND");
      if (!canDeletePermanently(locked.onboardingStatus)) {
        throw new AppError("INVALID_TRANSITION", { from: locked.onboardingStatus });
      }
      const [person] = await tx
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, id));
      if (!person) throw new AppError("NOT_FOUND");
      if (confirmName.trim() !== fullName(person)) {
        throw fieldError("confirmName", "users.errors.confirmNameMismatch");
      }
      const led = await ledEmployeesOf(tx, id, { includeArchived: true });
      if (led.length > 0) {
        throw new AppError("IN_USE", {
          reasonKey: "users.errors.leadsEmployees",
          ledEmployees: led,
        });
      }
      await tx.delete(users).where(eq(users.id, id));
    });
  } catch (e) {
    return rethrowDbError(e, { fk: "IN_USE" });
  }
  logger.info({ action: "users.delete", entityId: id, actorId: actor.id }, "mutation");
}
