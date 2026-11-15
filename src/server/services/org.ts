import "server-only";
import { asc, count, eq, inArray, or, type SQL } from "drizzle-orm";
import {
  createDepartmentSchema,
  createJobRoleSchema,
  createTeamSchema,
  orgIdInputSchema,
  updateDepartmentSchema,
  updateJobRoleSchema,
  updateTeamSchema,
  type CreateDepartmentInput,
  type CreateJobRoleInput,
  type CreateTeamInput,
  type OrgIdInput,
  type UpdateDepartmentInput,
  type UpdateJobRoleInput,
  type UpdateTeamInput,
} from "@/lib/validation/org";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { db, type DbExecutor, type Tx } from "@/server/db/client";
import { departments, jobRoles, teams, templates, users } from "@/server/db/schema";
import { AppError, PG_ERROR, pgErrorCode, rethrowDbError } from "@/server/errors";
import { logger } from "@/server/logger";

export interface OrgEntry {
  id: string;
  name: string;
}

export interface TeamItem {
  id: string;
  name: string;
  departmentId: string;
  userCount: number;
}

export interface DepartmentWithTeams {
  id: string;
  name: string;
  teams: TeamItem[];
}

export interface JobRoleItem {
  id: string;
  name: string;
  userCount: number;
}

export interface TeamUsage {
  used: boolean;
  users: OrgEntry[];
  templates: OrgEntry[];
}

export interface DepartmentUsage extends TeamUsage {
  /** Teams of the department that no user and no template references. */
  emptyTeams: OrgEntry[];
}

export type JobRoleUsage = TeamUsage;

export interface OrgOptions {
  departments: OrgEntry[];
  teams: { id: string; name: string; departmentId: string }[];
  jobRoles: OrgEntry[];
}

const NAME_TAKEN = "org.errors.nameTaken";

/** Unique violations on the name columns become CONFLICT with a readable reason; the rest as usual. */
function rethrowNameError(e: unknown): never {
  if (pgErrorCode(e) === PG_ERROR.uniqueViolation) {
    throw new AppError("CONFLICT", { reasonKey: NAME_TAKEN });
  }
  return rethrowDbError(e);
}

function userLabel(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

async function usersOfTeams(executor: DbExecutor, teamIds: string[]): Promise<OrgEntry[]> {
  if (teamIds.length === 0) return [];
  const rows = await executor
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(inArray(users.teamId, teamIds))
    .orderBy(asc(users.lastName), asc(users.firstName), asc(users.id));
  return rows.map((row) => ({ id: row.id, name: userLabel(row) }));
}

async function templatesWhere(
  executor: DbExecutor,
  condition: SQL | undefined,
): Promise<OrgEntry[]> {
  return executor
    .select({ id: templates.id, name: templates.name })
    .from(templates)
    .where(condition)
    .orderBy(asc(templates.name), asc(templates.id));
}

async function teamUsageInTx(executor: DbExecutor, teamId: string): Promise<TeamUsage> {
  const [teamUsers, teamTemplates] = await Promise.all([
    usersOfTeams(executor, [teamId]),
    templatesWhere(executor, eq(templates.teamId, teamId)),
  ]);
  return {
    used: teamUsers.length > 0 || teamTemplates.length > 0,
    users: teamUsers,
    templates: teamTemplates,
  };
}

async function departmentUsageInTx(
  executor: DbExecutor,
  departmentId: string,
): Promise<DepartmentUsage> {
  const departmentTeams = await executor
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.departmentId, departmentId))
    .orderBy(asc(teams.name), asc(teams.id));
  const teamIds = departmentTeams.map((team) => team.id);
  const [departmentUsers, departmentTemplates] = await Promise.all([
    usersOfTeams(executor, teamIds),
    templatesWhere(
      executor,
      teamIds.length > 0
        ? or(eq(templates.departmentId, departmentId), inArray(templates.teamId, teamIds))
        : eq(templates.departmentId, departmentId),
    ),
  ]);
  const referencedTeamIds = new Set<string>();
  if (teamIds.length > 0) {
    const [userTeams, templateTeams] = await Promise.all([
      executor
        .selectDistinct({ id: users.teamId })
        .from(users)
        .where(inArray(users.teamId, teamIds)),
      executor
        .selectDistinct({ id: templates.teamId })
        .from(templates)
        .where(inArray(templates.teamId, teamIds)),
    ]);
    for (const row of [...userTeams, ...templateTeams]) {
      if (row.id) referencedTeamIds.add(row.id);
    }
  }
  return {
    used: departmentUsers.length > 0 || departmentTemplates.length > 0,
    users: departmentUsers,
    templates: departmentTemplates,
    emptyTeams: departmentTeams.filter((team) => !referencedTeamIds.has(team.id)),
  };
}

async function jobRoleUsageInTx(executor: DbExecutor, jobRoleId: string): Promise<JobRoleUsage> {
  const [roleUsers, roleTemplates] = await Promise.all([
    executor
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.jobRoleId, jobRoleId))
      .orderBy(asc(users.lastName), asc(users.firstName), asc(users.id)),
    templatesWhere(executor, eq(templates.jobRoleId, jobRoleId)),
  ]);
  return {
    used: roleUsers.length > 0 || roleTemplates.length > 0,
    users: roleUsers.map((row) => ({ id: row.id, name: userLabel(row) })),
    templates: roleTemplates,
  };
}

function inUse(usage: TeamUsage): AppError {
  return new AppError("IN_USE", { users: usage.users, templates: usage.templates });
}

// ---- departments ----

/** Admin: all departments with their teams (and how many people sit in each team). */
export async function listDepartments(actor: Actor): Promise<DepartmentWithTeams[]> {
  assertPermission(actor, "org.manage");
  const [departmentRows, teamRows, userCounts] = await Promise.all([
    db.select().from(departments).orderBy(asc(departments.name), asc(departments.id)),
    db.select().from(teams).orderBy(asc(teams.name), asc(teams.id)),
    db.select({ teamId: users.teamId, total: count() }).from(users).groupBy(users.teamId),
  ]);
  const countByTeam = new Map(userCounts.map((row) => [row.teamId, row.total]));
  return departmentRows.map((department) => ({
    id: department.id,
    name: department.name,
    teams: teamRows
      .filter((team) => team.departmentId === department.id)
      .map((team) => ({
        id: team.id,
        name: team.name,
        departmentId: team.departmentId,
        userCount: countByTeam.get(team.id) ?? 0,
      })),
  }));
}

export async function createDepartment(
  actor: Actor,
  input: CreateDepartmentInput,
): Promise<OrgEntry> {
  assertPermission(actor, "org.manage");
  const data = createDepartmentSchema.parse(input);
  try {
    const [row] = await db.insert(departments).values({ name: data.name }).returning();
    if (!row) throw new AppError("INTERNAL");
    logger.info(
      { action: "org.department.create", entityId: row.id, actorId: actor.id },
      "mutation",
    );
    return { id: row.id, name: row.name };
  } catch (e) {
    return rethrowNameError(e);
  }
}

export async function updateDepartment(
  actor: Actor,
  input: UpdateDepartmentInput,
): Promise<OrgEntry> {
  assertPermission(actor, "org.manage");
  const data = updateDepartmentSchema.parse(input);
  try {
    const [row] = await db
      .update(departments)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(departments.id, data.id))
      .returning();
    if (!row) throw new AppError("NOT_FOUND");
    logger.info(
      { action: "org.department.update", entityId: row.id, actorId: actor.id },
      "mutation",
    );
    return { id: row.id, name: row.name };
  } catch (e) {
    return rethrowNameError(e);
  }
}

export async function getDepartmentUsage(
  actor: Actor,
  input: OrgIdInput,
): Promise<DepartmentUsage> {
  assertPermission(actor, "org.manage");
  const { id } = orgIdInputSchema.parse(input);
  const [department] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.id, id));
  if (!department) throw new AppError("NOT_FOUND");
  return departmentUsageInTx(db, id);
}

/**
 * Admin: deletes an unused department together with its (then necessarily empty) teams.
 * @throws AppError IN_USE with `{ users, templates }` while people or templates reference it
 */
export async function deleteDepartment(actor: Actor, input: OrgIdInput): Promise<void> {
  assertPermission(actor, "org.manage");
  const { id } = orgIdInputSchema.parse(input);
  try {
    await db.transaction(async (tx) => {
      const [department] = await tx
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, id))
        .for("update");
      if (!department) throw new AppError("NOT_FOUND");
      const usage = await departmentUsageInTx(tx, id);
      if (usage.used) throw inUse(usage);
      await tx.delete(teams).where(eq(teams.departmentId, id));
      await tx.delete(departments).where(eq(departments.id, id));
    });
  } catch (e) {
    return rethrowDbError(e, { fk: "IN_USE" });
  }
  logger.info({ action: "org.department.delete", entityId: id, actorId: actor.id }, "mutation");
}

// ---- teams ----

export async function createTeam(actor: Actor, input: CreateTeamInput): Promise<OrgEntry> {
  assertPermission(actor, "org.manage");
  const data = createTeamSchema.parse(input);
  try {
    return await db.transaction(async (tx) => {
      // Locks the department so a concurrent delete cannot slip in between check and insert.
      const [department] = await tx
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, data.departmentId))
        .for("share");
      if (!department) throw new AppError("NOT_FOUND");
      const [row] = await tx
        .insert(teams)
        .values({ departmentId: data.departmentId, name: data.name })
        .returning();
      if (!row) throw new AppError("INTERNAL");
      logger.info({ action: "org.team.create", entityId: row.id, actorId: actor.id }, "mutation");
      return { id: row.id, name: row.name };
    });
  } catch (e) {
    return rethrowNameError(e);
  }
}

async function assertTeamMovable(tx: Tx, teamId: string): Promise<void> {
  const referencing = await templatesWhere(tx, eq(templates.teamId, teamId));
  if (referencing.length > 0) {
    throw new AppError("IN_USE", {
      reasonKey: "org.errors.teamHasTemplates",
      templates: referencing,
    });
  }
}

/**
 * Admin: renames a team and/or moves it to another department (users derive their department
 * from the team). A move is refused while a template references the team.
 */
export async function updateTeam(actor: Actor, input: UpdateTeamInput): Promise<OrgEntry> {
  assertPermission(actor, "org.manage");
  const data = updateTeamSchema.parse(input);
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: teams.id, departmentId: teams.departmentId })
        .from(teams)
        .where(eq(teams.id, data.id))
        .for("update");
      if (!current) throw new AppError("NOT_FOUND");
      if (current.departmentId !== data.departmentId) {
        const [target] = await tx
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.id, data.departmentId))
          .for("share");
        if (!target) throw new AppError("NOT_FOUND");
        await assertTeamMovable(tx, data.id);
      }
      const [row] = await tx
        .update(teams)
        .set({ name: data.name, departmentId: data.departmentId, updatedAt: new Date() })
        .where(eq(teams.id, data.id))
        .returning();
      if (!row) throw new AppError("NOT_FOUND");
      logger.info({ action: "org.team.update", entityId: row.id, actorId: actor.id }, "mutation");
      return { id: row.id, name: row.name };
    });
  } catch (e) {
    return rethrowNameError(e);
  }
}

export async function getTeamUsage(actor: Actor, input: OrgIdInput): Promise<TeamUsage> {
  assertPermission(actor, "org.manage");
  const { id } = orgIdInputSchema.parse(input);
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, id));
  if (!team) throw new AppError("NOT_FOUND");
  return teamUsageInTx(db, id);
}

/** @throws AppError IN_USE with `{ users, templates }` while people or templates reference the team */
export async function deleteTeam(actor: Actor, input: OrgIdInput): Promise<void> {
  assertPermission(actor, "org.manage");
  const { id } = orgIdInputSchema.parse(input);
  try {
    await db.transaction(async (tx) => {
      const [team] = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.id, id))
        .for("update");
      if (!team) throw new AppError("NOT_FOUND");
      const usage = await teamUsageInTx(tx, id);
      if (usage.used) throw inUse(usage);
      await tx.delete(teams).where(eq(teams.id, id));
    });
  } catch (e) {
    return rethrowDbError(e, { fk: "IN_USE" });
  }
  logger.info({ action: "org.team.delete", entityId: id, actorId: actor.id }, "mutation");
}

// ---- job roles ----

export async function listJobRoles(actor: Actor): Promise<JobRoleItem[]> {
  assertPermission(actor, "org.manage");
  const [roleRows, userCounts] = await Promise.all([
    db.select().from(jobRoles).orderBy(asc(jobRoles.name), asc(jobRoles.id)),
    db.select({ jobRoleId: users.jobRoleId, total: count() }).from(users).groupBy(users.jobRoleId),
  ]);
  const countByRole = new Map(userCounts.map((row) => [row.jobRoleId, row.total]));
  return roleRows.map((role) => ({
    id: role.id,
    name: role.name,
    userCount: countByRole.get(role.id) ?? 0,
  }));
}

export async function createJobRole(actor: Actor, input: CreateJobRoleInput): Promise<OrgEntry> {
  assertPermission(actor, "org.manage");
  const data = createJobRoleSchema.parse(input);
  try {
    const [row] = await db.insert(jobRoles).values({ name: data.name }).returning();
    if (!row) throw new AppError("INTERNAL");
    logger.info({ action: "org.jobRole.create", entityId: row.id, actorId: actor.id }, "mutation");
    return { id: row.id, name: row.name };
  } catch (e) {
    return rethrowNameError(e);
  }
}

export async function updateJobRole(actor: Actor, input: UpdateJobRoleInput): Promise<OrgEntry> {
  assertPermission(actor, "org.manage");
  const data = updateJobRoleSchema.parse(input);
  try {
    const [row] = await db
      .update(jobRoles)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(jobRoles.id, data.id))
      .returning();
    if (!row) throw new AppError("NOT_FOUND");
    logger.info({ action: "org.jobRole.update", entityId: row.id, actorId: actor.id }, "mutation");
    return { id: row.id, name: row.name };
  } catch (e) {
    return rethrowNameError(e);
  }
}

export async function getJobRoleUsage(actor: Actor, input: OrgIdInput): Promise<JobRoleUsage> {
  assertPermission(actor, "org.manage");
  const { id } = orgIdInputSchema.parse(input);
  const [role] = await db.select({ id: jobRoles.id }).from(jobRoles).where(eq(jobRoles.id, id));
  if (!role) throw new AppError("NOT_FOUND");
  return jobRoleUsageInTx(db, id);
}

/** @throws AppError IN_USE with `{ users, templates }` while people or templates reference the role */
export async function deleteJobRole(actor: Actor, input: OrgIdInput): Promise<void> {
  assertPermission(actor, "org.manage");
  const { id } = orgIdInputSchema.parse(input);
  try {
    await db.transaction(async (tx) => {
      const [role] = await tx
        .select({ id: jobRoles.id })
        .from(jobRoles)
        .where(eq(jobRoles.id, id))
        .for("update");
      if (!role) throw new AppError("NOT_FOUND");
      const usage = await jobRoleUsageInTx(tx, id);
      if (usage.used) throw inUse(usage);
      await tx.delete(jobRoles).where(eq(jobRoles.id, id));
    });
  } catch (e) {
    return rethrowDbError(e, { fk: "IN_USE" });
  }
  logger.info({ action: "org.jobRole.delete", entityId: id, actorId: actor.id }, "mutation");
}

// ---- options for selects and filters ----

/** Admin and team lead: flat lists for selects and filters. */
export async function listOrgOptions(actor: Actor): Promise<OrgOptions> {
  assertPermission(actor, "plan.manage");
  const [departmentRows, teamRows, jobRoleRows] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .orderBy(asc(departments.name), asc(departments.id)),
    db
      .select({ id: teams.id, name: teams.name, departmentId: teams.departmentId })
      .from(teams)
      .orderBy(asc(teams.name), asc(teams.id)),
    db
      .select({ id: jobRoles.id, name: jobRoles.name })
      .from(jobRoles)
      .orderBy(asc(jobRoles.name), asc(jobRoles.id)),
  ]);
  return { departments: departmentRows, teams: teamRows, jobRoles: jobRoleRows };
}
