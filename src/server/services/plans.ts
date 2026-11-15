import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { PHASES } from "@/config/app";
import type { OnboardingStatus } from "@/lib/domain/onboarding-status";
import {
  addPlanStepSchema,
  assignTemplatesSchema,
  pageIdInputSchema,
  removePlanStepSchema,
  setStepCompletionSchema,
  userIdInputSchema,
  type AddPlanStepInput,
  type AssignTemplatesInput,
  type RemovePlanStepInput,
  type SetStepCompletionInput,
} from "@/lib/validation/plans";
import { assertPermission, canManagePlanOf, canViewProgressOf } from "@/server/auth/permissions";
import type { Actor, Locale } from "@/server/auth/types";
import { db, type DbExecutor, type Tx } from "@/server/db/client";
import {
  departments,
  jobRoles,
  modules,
  pageCompletions,
  pages,
  teams,
  templateSteps,
  templates,
  userPlanSteps,
  userTemplateAssignments,
  users,
} from "@/server/db/schema";
import { AppError, rethrowDbError } from "@/server/errors";
import { logger } from "@/server/logger";
import { createNotificationInTx } from "./notifications-core";
import {
  applyRecomputeInTx,
  loadProgressForUsersInTx,
  recomputeOnboardingStatusInTx,
  type UserProgress,
} from "./plan-hooks";
import { lockUserInTx, type LockedUser } from "./row-locks";

type Phase = (typeof PHASES)[number];
type PageStatusValue = "draft" | "published" | "archived";

export interface StepDto {
  pageId: string;
  title: string;
  isFallback: boolean;
  completedAt: Date | null;
  /** The page content changed after the employee completed the step. */
  updatedSinceCompletion: boolean;
}

export interface PlanDto {
  status: OnboardingStatus;
  progress: UserProgress;
  phases: { phase: Phase; steps: StepDto[] }[];
}

export interface EmployeeStepDto {
  pageId: string;
  phase: Phase;
  /** `null` for team leads on a step whose page is not published (status flag only). */
  title: string | null;
  isFallback: boolean;
  pageStatus: PageStatusValue;
  /** Active = the page is published; only active steps count towards progress. */
  isActive: boolean;
  completedAt: Date | null;
  updatedSinceCompletion: boolean;
}

export interface EmployeeModuleDto {
  moduleId: string;
  title: string;
  completed: number;
  total: number;
  steps: EmployeeStepDto[];
}

export interface EmployeePlanDto {
  user: {
    id: string;
    name: string;
    status: OnboardingStatus;
    startDate: string | null;
  };
  /** The actor may assign templates and add/remove steps (admin, or the lead of an active employee). */
  canManage: boolean;
  progress: UserProgress;
  assignedTemplates: { templateId: string; name: string; assignedAt: Date }[];
  phases: { phase: Phase; steps: EmployeeStepDto[] }[];
  modules: EmployeeModuleDto[];
}

export interface AssignableTemplate {
  id: string;
  name: string;
  scope: { department: string | null; team: string | null; jobRole: string | null };
  suggested: boolean;
}

export interface AddablePage {
  id: string;
  title: string;
  moduleTitle: string;
}

const PLAN_ORDER = [
  userPlanSteps.phase,
  userPlanSteps.sortOrder,
  userPlanSteps.createdAt,
  userPlanSteps.id,
] as const;

function pick(
  de: string,
  en: string | null,
  locale: Locale,
): { text: string; isFallback: boolean } {
  if (locale === "en")
    return en !== null ? { text: en, isFallback: false } : { text: de, isFallback: true };
  return { text: de, isFallback: false };
}

function groupByPhase<T extends { phase: Phase }>(steps: T[]): { phase: Phase; steps: T[] }[] {
  const groups = new Map<Phase, T[]>();
  for (const step of steps) {
    const group = groups.get(step.phase);
    if (group) group.push(step);
    else groups.set(step.phase, [step]);
  }
  return PHASES.flatMap((phase) => {
    const group = groups.get(phase);
    return group ? [{ phase, steps: group }] : [];
  });
}

async function withDbErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    return rethrowDbError(e);
  }
}

/**
 * Internal: authorizes plan management for `userId` and locks the target (blueprint 4.4). Called
 * first by every plans function that changes a plan. Employees are `FORBIDDEN`; a missing user or
 * (for team leads) someone else's employee is `NOT_FOUND`; an archived target is
 * `INVALID_TRANSITION`.
 */
async function loadManageableTargetInTx(tx: Tx, actor: Actor, userId: string): Promise<LockedUser> {
  assertPermission(actor, "plan.manage");
  const target = await lockUserInTx(tx, userId);
  if (!target || !canManagePlanOf(actor, target)) throw new AppError("NOT_FOUND");
  if (target.onboardingStatus === "archived") throw new AppError("INVALID_TRANSITION");
  return target;
}

/** Same scope check without a row lock, for the read-only listings. */
async function loadManageableTargetReadOnly(
  executor: DbExecutor,
  actor: Actor,
  userId: string,
): Promise<{
  id: string;
  teamId: string | null;
  jobRoleId: string | null;
  departmentId: string | null;
}> {
  assertPermission(actor, "plan.manage");
  const [target] = await executor
    .select({
      id: users.id,
      leadId: users.leadId,
      teamId: users.teamId,
      jobRoleId: users.jobRoleId,
      departmentId: teams.departmentId,
      status: users.onboardingStatus,
    })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(eq(users.id, userId));
  if (!target || !canManagePlanOf(actor, target)) throw new AppError("NOT_FOUND");
  if (target.status === "archived") throw new AppError("INVALID_TRANSITION");
  return target;
}

async function nextSortOrderInPhase(tx: Tx, userId: string, phase: Phase): Promise<number> {
  const [row] = await tx
    .select({ value: sql<number>`coalesce(max(${userPlanSteps.sortOrder}), -1)` })
    .from(userPlanSteps)
    .where(and(eq(userPlanSteps.userId, userId), eq(userPlanSteps.phase, phase)));
  return (row?.value ?? -1) + 1;
}

/** Own plan: only active steps (published pages), grouped by phase in plan order. */
export async function getMyPlan(actor: Actor): Promise<PlanDto> {
  assertPermission(actor, "plan.viewOwn");
  const [user] = await db
    .select({ status: users.onboardingStatus })
    .from(users)
    .where(eq(users.id, actor.id));
  if (!user) throw new AppError("NOT_FOUND");

  const [rows, progress] = await Promise.all([
    db
      .select({
        pageId: userPlanSteps.pageId,
        phase: userPlanSteps.phase,
        titleDe: pages.titleDe,
        titleEn: pages.titleEn,
        contentUpdatedAt: pages.contentUpdatedAt,
        completedAt: pageCompletions.completedAt,
      })
      .from(userPlanSteps)
      .innerJoin(pages, eq(pages.id, userPlanSteps.pageId))
      .leftJoin(
        pageCompletions,
        and(
          eq(pageCompletions.userId, userPlanSteps.userId),
          eq(pageCompletions.pageId, userPlanSteps.pageId),
        ),
      )
      .where(and(eq(userPlanSteps.userId, actor.id), eq(pages.status, "published")))
      .orderBy(...PLAN_ORDER),
    loadProgressForUsersInTx(db, [actor.id]),
  ]);

  const steps = rows.map((row) => {
    const { text, isFallback } = pick(row.titleDe, row.titleEn, actor.locale);
    const step: StepDto = {
      pageId: row.pageId,
      title: text,
      isFallback,
      completedAt: row.completedAt,
      updatedSinceCompletion:
        row.completedAt !== null && row.contentUpdatedAt.getTime() > row.completedAt.getTime(),
    };
    return { phase: row.phase, step };
  });
  const emptyProgress: UserProgress = { completed: 0, total: 0, percent: 0, lastActivityAt: null };
  return {
    status: user.status,
    progress: progress.get(actor.id) ?? emptyProgress,
    phases: groupByPhase(steps).map(({ phase, steps: group }) => ({
      phase,
      steps: group.map(({ step }) => step),
    })),
  };
}

/**
 * Own step state for the "Erledigt" toggle on the page view; `null` when the page is not an active
 * step of the actor's plan.
 */
export async function getMyStepState(
  actor: Actor,
  input: { pageId: string },
): Promise<{ completedAt: Date | null; updatedSinceCompletion: boolean } | null> {
  assertPermission(actor, "plan.viewOwn");
  const { pageId } = pageIdInputSchema.parse(input);
  const [row] = await db
    .select({
      contentUpdatedAt: pages.contentUpdatedAt,
      completedAt: pageCompletions.completedAt,
    })
    .from(userPlanSteps)
    .innerJoin(pages, eq(pages.id, userPlanSteps.pageId))
    .leftJoin(
      pageCompletions,
      and(
        eq(pageCompletions.userId, userPlanSteps.userId),
        eq(pageCompletions.pageId, userPlanSteps.pageId),
      ),
    )
    .where(
      and(
        eq(userPlanSteps.userId, actor.id),
        eq(userPlanSteps.pageId, pageId),
        eq(pages.status, "published"),
      ),
    );
  if (!row) return null;
  return {
    completedAt: row.completedAt,
    updatedSinceCompletion:
      row.completedAt !== null && row.contentUpdatedAt.getTime() > row.completedAt.getTime(),
  };
}

/**
 * Plan of an employee for their lead or an admin. Inactive steps are flagged; admins see their
 * title and status, team leads only the status (they cannot read drafts in the library either).
 */
export async function getPlanForUser(
  actor: Actor,
  input: { userId: string },
): Promise<EmployeePlanDto> {
  assertPermission(actor, "progress.viewOthers");
  const { userId } = userIdInputSchema.parse(input);
  const [target] = await db
    .select({
      id: users.id,
      leadId: users.leadId,
      name: users.name,
      status: users.onboardingStatus,
      startDate: users.startDate,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!target || !canViewProgressOf(actor, target)) throw new AppError("NOT_FOUND");

  const [rows, assigned, progress] = await Promise.all([
    db
      .select({
        pageId: userPlanSteps.pageId,
        phase: userPlanSteps.phase,
        pageStatus: pages.status,
        titleDe: pages.titleDe,
        titleEn: pages.titleEn,
        contentUpdatedAt: pages.contentUpdatedAt,
        completedAt: pageCompletions.completedAt,
        moduleId: modules.id,
        moduleTitleDe: modules.titleDe,
        moduleTitleEn: modules.titleEn,
        moduleSortOrder: modules.sortOrder,
        moduleCreatedAt: modules.createdAt,
      })
      .from(userPlanSteps)
      .innerJoin(pages, eq(pages.id, userPlanSteps.pageId))
      .innerJoin(modules, eq(modules.id, pages.moduleId))
      .leftJoin(
        pageCompletions,
        and(
          eq(pageCompletions.userId, userPlanSteps.userId),
          eq(pageCompletions.pageId, userPlanSteps.pageId),
        ),
      )
      .where(eq(userPlanSteps.userId, userId))
      .orderBy(...PLAN_ORDER),
    db
      .select({
        templateId: templates.id,
        name: templates.name,
        assignedAt: userTemplateAssignments.assignedAt,
      })
      .from(userTemplateAssignments)
      .innerJoin(templates, eq(templates.id, userTemplateAssignments.templateId))
      .where(eq(userTemplateAssignments.userId, userId))
      .orderBy(asc(userTemplateAssignments.assignedAt), asc(templates.id)),
    loadProgressForUsersInTx(db, [userId]),
  ]);

  const showTitle = (status: PageStatusValue) => status === "published" || actor.role === "admin";
  const flat = rows.map((row) => {
    const isActive = row.pageStatus === "published";
    const { text, isFallback } = pick(row.titleDe, row.titleEn, actor.locale);
    const step: EmployeeStepDto = {
      pageId: row.pageId,
      phase: row.phase,
      title: showTitle(row.pageStatus) ? text : null,
      isFallback: showTitle(row.pageStatus) && isFallback,
      pageStatus: row.pageStatus,
      isActive,
      completedAt: row.completedAt,
      updatedSinceCompletion:
        isActive &&
        row.completedAt !== null &&
        row.contentUpdatedAt.getTime() > row.completedAt.getTime(),
    };
    return { step, row };
  });

  const moduleGroups = new Map<
    string,
    { sortKey: [number, number, string]; dto: EmployeeModuleDto }
  >();
  for (const { step, row } of flat) {
    let group = moduleGroups.get(row.moduleId);
    if (!group) {
      group = {
        sortKey: [row.moduleSortOrder, row.moduleCreatedAt.getTime(), row.moduleId],
        dto: {
          moduleId: row.moduleId,
          title: pick(row.moduleTitleDe, row.moduleTitleEn, actor.locale).text,
          completed: 0,
          total: 0,
          steps: [],
        },
      };
      moduleGroups.set(row.moduleId, group);
    }
    group.dto.steps.push(step);
    if (step.isActive) {
      group.dto.total += 1;
      if (step.completedAt !== null) group.dto.completed += 1;
    }
  }
  const orderedModules = [...moduleGroups.values()]
    .sort(
      (a, b) =>
        a.sortKey[0] - b.sortKey[0] ||
        a.sortKey[1] - b.sortKey[1] ||
        a.sortKey[2].localeCompare(b.sortKey[2]),
    )
    .map((group) => group.dto);

  return {
    user: { id: target.id, name: target.name, status: target.status, startDate: target.startDate },
    canManage: canManagePlanOf(actor, target) && target.status !== "archived",
    progress: progress.get(userId) ?? { completed: 0, total: 0, percent: 0, lastActivityAt: null },
    assignedTemplates: assigned,
    phases: groupByPhase(flat.map(({ step }) => step)),
    modules: orderedModules,
  };
}

/** Level used to order templates for the snapshot: company-wide, department, team, job role. */
function specificity(template: {
  departmentId: string | null;
  teamId: string | null;
  jobRoleId: string | null;
}): number {
  if (template.jobRoleId) return 3;
  if (template.teamId) return 2;
  return template.departmentId ? 1 : 0;
}

/** Active templates for the employee; `suggested` matches department, team and job role (K§5). */
export async function listAssignableTemplates(
  actor: Actor,
  input: { userId: string },
): Promise<AssignableTemplate[]> {
  const { userId } = userIdInputSchema.parse(input);
  const target = await loadManageableTargetReadOnly(db, actor, userId);
  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      departmentId: templates.departmentId,
      teamId: templates.teamId,
      jobRoleId: templates.jobRoleId,
      departmentName: departments.name,
      teamName: teams.name,
      jobRoleName: jobRoles.name,
    })
    .from(templates)
    .leftJoin(departments, eq(departments.id, templates.departmentId))
    .leftJoin(teams, eq(teams.id, templates.teamId))
    .leftJoin(jobRoles, eq(jobRoles.id, templates.jobRoleId))
    .where(eq(templates.status, "active"));
  return rows
    .sort(
      (a, b) =>
        specificity(a) - specificity(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      scope: { department: row.departmentName, team: row.teamName, jobRole: row.jobRoleName },
      suggested:
        (row.departmentId === null || row.departmentId === target.departmentId) &&
        (row.teamId === null || row.teamId === target.teamId) &&
        (row.jobRoleId === null || row.jobRoleId === target.jobRoleId),
    }));
}

/**
 * Snapshot: copies the steps of the selected templates into the employee's plan (blueprint 4.6).
 * One transaction under the user lock. Later template edits never touch the plan.
 */
export async function assignTemplates(
  actor: Actor,
  input: AssignTemplatesInput,
): Promise<{ addedSteps: number }> {
  assertPermission(actor, "plan.manage");
  const data = assignTemplatesSchema.parse(input);
  const result = await withDbErrors(() =>
    db.transaction(async (tx) => {
      const target = await loadManageableTargetInTx(tx, actor, data.userId);

      const selected = await tx
        .select()
        .from(templates)
        .where(inArray(templates.id, data.templateIds));
      if (
        selected.length !== data.templateIds.length ||
        selected.some((t) => t.status !== "active")
      ) {
        throw new AppError("VALIDATION", { reasonKey: "plan.errors.templateNotAssignable" });
      }
      selected.sort(
        (a, b) =>
          specificity(a) - specificity(b) ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id),
      );

      const [candidateSteps, existing] = await Promise.all([
        tx
          .select({
            templateId: templateSteps.templateId,
            pageId: templateSteps.pageId,
            phase: templateSteps.phase,
            pageStatus: pages.status,
          })
          .from(templateSteps)
          .innerJoin(pages, eq(pages.id, templateSteps.pageId))
          .where(
            and(inArray(templateSteps.templateId, data.templateIds), ne(pages.status, "archived")),
          )
          .orderBy(
            asc(templateSteps.phase),
            asc(templateSteps.sortOrder),
            asc(templateSteps.createdAt),
            asc(templateSteps.id),
          ),
        tx
          .select({
            pageId: userPlanSteps.pageId,
            phase: userPlanSteps.phase,
            sortOrder: userPlanSteps.sortOrder,
          })
          .from(userPlanSteps)
          .where(eq(userPlanSteps.userId, target.id)),
      ]);

      const known = new Set(existing.map((step) => step.pageId));
      const nextOrder = new Map<Phase, number>();
      for (const step of existing) {
        nextOrder.set(step.phase, Math.max(nextOrder.get(step.phase) ?? 0, step.sortOrder + 1));
      }

      const stepsByTemplate = new Map<string, typeof candidateSteps>();
      for (const step of candidateSteps) {
        const list = stepsByTemplate.get(step.templateId);
        if (list) list.push(step);
        else stepsByTemplate.set(step.templateId, [step]);
      }

      const toInsert: {
        userId: string;
        pageId: string;
        phase: Phase;
        sortOrder: number;
        sourceTemplateId: string;
        addedBy: string;
      }[] = [];
      let publishedAdded = false;
      for (const template of selected) {
        for (const step of stepsByTemplate.get(template.id) ?? []) {
          if (known.has(step.pageId)) continue;
          known.add(step.pageId);
          const sortOrder = nextOrder.get(step.phase) ?? 0;
          nextOrder.set(step.phase, sortOrder + 1);
          toInsert.push({
            userId: target.id,
            pageId: step.pageId,
            phase: step.phase,
            sortOrder,
            sourceTemplateId: template.id,
            addedBy: actor.id,
          });
          if (step.pageStatus === "published") publishedAdded = true;
        }
      }

      if (toInsert.length > 0) await tx.insert(userPlanSteps).values(toInsert);

      await tx
        .insert(userTemplateAssignments)
        .values(
          data.templateIds.map((templateId) => ({
            userId: target.id,
            templateId,
            assignedBy: actor.id,
          })),
        )
        .onConflictDoUpdate({
          target: [userTemplateAssignments.userId, userTemplateAssignments.templateId],
          set: { assignedAt: sql`now()`, assignedBy: actor.id },
        });

      if (publishedAdded)
        await createNotificationInTx(tx, { userId: target.id, type: "step_added" });
      await recomputeOnboardingStatusInTx(tx, { userId: target.id });
      return { addedSteps: toInsert.length };
    }),
  );
  logger.info(
    {
      action: "assignTemplates",
      userId: data.userId,
      actorId: actor.id,
      addedSteps: result.addedSteps,
    },
    "templates assigned",
  );
  return result;
}

/** Published pages that are not yet part of the employee's plan. */
export async function listAddablePages(
  actor: Actor,
  input: { userId: string },
): Promise<AddablePage[]> {
  const { userId } = userIdInputSchema.parse(input);
  await loadManageableTargetReadOnly(db, actor, userId);
  const rows = await db
    .select({
      id: pages.id,
      titleDe: pages.titleDe,
      titleEn: pages.titleEn,
      moduleTitleDe: modules.titleDe,
      moduleTitleEn: modules.titleEn,
    })
    .from(pages)
    .innerJoin(modules, eq(modules.id, pages.moduleId))
    .where(
      and(
        eq(pages.status, "published"),
        sql`not exists (select 1 from ${userPlanSteps} where ${userPlanSteps.userId} = ${userId} and ${userPlanSteps.pageId} = ${pages.id})`,
      ),
    )
    .orderBy(
      asc(modules.sortOrder),
      asc(modules.createdAt),
      asc(modules.id),
      asc(pages.sortOrder),
      asc(pages.createdAt),
      asc(pages.id),
    );
  return rows.map((row) => ({
    id: row.id,
    title: pick(row.titleDe, row.titleEn, actor.locale).text,
    moduleTitle: pick(row.moduleTitleDe, row.moduleTitleEn, actor.locale).text,
  }));
}

/** Adds a published library page at the end of the phase; the employee gets `step_added`. */
export async function addPlanStep(actor: Actor, input: AddPlanStepInput): Promise<void> {
  assertPermission(actor, "plan.manage");
  const data = addPlanStepSchema.parse(input);
  await withDbErrors(() =>
    db.transaction(async (tx) => {
      const target = await loadManageableTargetInTx(tx, actor, data.userId);
      const [page] = await tx
        .select({ status: pages.status })
        .from(pages)
        .where(eq(pages.id, data.pageId));
      // A missing page is reported like an unpublished one: leads must not learn that a draft exists.
      if (page?.status !== "published") {
        throw new AppError("VALIDATION", { reasonKey: "plan.errors.pageNotPublished" });
      }
      const [existing] = await tx
        .select({ id: userPlanSteps.id })
        .from(userPlanSteps)
        .where(and(eq(userPlanSteps.userId, target.id), eq(userPlanSteps.pageId, data.pageId)));
      if (existing) throw new AppError("CONFLICT", { reasonKey: "plan.errors.alreadyInPlan" });

      await tx.insert(userPlanSteps).values({
        userId: target.id,
        pageId: data.pageId,
        phase: data.phase,
        sortOrder: await nextSortOrderInPhase(tx, target.id, data.phase),
        addedBy: actor.id,
      });
      await createNotificationInTx(tx, { userId: target.id, type: "step_added" });
      await recomputeOnboardingStatusInTx(tx, { userId: target.id });
    }),
  );
  logger.info({ action: "addPlanStep", userId: data.userId, actorId: actor.id }, "plan step added");
}

/** Removes a step from the plan; the completion record is kept (blueprint 2.3). */
export async function removePlanStep(actor: Actor, input: RemovePlanStepInput): Promise<void> {
  assertPermission(actor, "plan.manage");
  const data = removePlanStepSchema.parse(input);
  await withDbErrors(() =>
    db.transaction(async (tx) => {
      const target = await loadManageableTargetInTx(tx, actor, data.userId);
      const removed = await tx
        .delete(userPlanSteps)
        .where(and(eq(userPlanSteps.userId, target.id), eq(userPlanSteps.pageId, data.pageId)))
        .returning({ id: userPlanSteps.id });
      if (removed.length === 0) throw new AppError("NOT_FOUND");
      await recomputeOnboardingStatusInTx(tx, { userId: target.id });
    }),
  );
  logger.info(
    { action: "removePlanStep", userId: data.userId, actorId: actor.id },
    "plan step removed",
  );
}

/**
 * "Erledigt" toggle and undo. Always acts on the actor's own plan; the page must be an active step.
 * Returns the new progress and onboarding status (which may have flipped).
 */
export async function setStepCompletion(
  actor: Actor,
  input: SetStepCompletionInput,
): Promise<{ progress: UserProgress; status: OnboardingStatus }> {
  assertPermission(actor, "plan.completeOwn");
  const data = setStepCompletionSchema.parse(input);
  return withDbErrors(() =>
    db.transaction(async (tx) => {
      const self = await lockUserInTx(tx, actor.id);
      if (!self) throw new AppError("NOT_FOUND");
      if (self.onboardingStatus === "archived") throw new AppError("FORBIDDEN");

      const [step] = await tx
        .select({ id: userPlanSteps.id })
        .from(userPlanSteps)
        .innerJoin(pages, eq(pages.id, userPlanSteps.pageId))
        .where(
          and(
            eq(userPlanSteps.userId, actor.id),
            eq(userPlanSteps.pageId, data.pageId),
            eq(pages.status, "published"),
          ),
        );
      if (!step) throw new AppError("NOT_FOUND");

      if (data.completed) {
        await tx
          .insert(pageCompletions)
          .values({ userId: actor.id, pageId: data.pageId })
          .onConflictDoNothing();
      } else {
        await tx
          .delete(pageCompletions)
          .where(
            and(eq(pageCompletions.userId, actor.id), eq(pageCompletions.pageId, data.pageId)),
          );
      }
      const recomputed = await applyRecomputeInTx(tx, { userId: actor.id });
      if (!recomputed) throw new AppError("NOT_FOUND");
      return recomputed;
    }),
  );
}

/** Internal: progress and last activity per user (dashboards use the same numbers as the plan). */
export async function getProgressForUsersInTx(
  tx: DbExecutor,
  userIds: readonly string[],
): Promise<Map<string, UserProgress>> {
  return loadProgressForUsersInTx(tx, userIds);
}
