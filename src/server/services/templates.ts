import "server-only";
import { and, asc, count, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { PHASES, type TEMPLATE_STATUSES } from "@/config/app";
import {
  addTemplateStepSchema,
  ALL_DEPARTMENTS,
  changeTemplateStepPhaseSchema,
  createTemplateSchema,
  deleteTemplateSchema,
  listTemplatesSchema,
  moveTemplateStepSchema,
  stepIdSchema,
  templateIdSchema,
  updateTemplateSchema,
  type AddTemplateStepInput,
  type ChangeTemplateStepPhaseInput,
  type CreateTemplateInput,
  type DeleteTemplateInput,
  type ListTemplatesInput,
  type MoveTemplateStepInput,
  type StepIdInput,
  type TemplateIdInput,
  type UpdateTemplateInput,
} from "@/lib/validation/templates";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { assertJobRoleFitsDepartmentInTx, type OrgOptions } from "@/server/services/org";
import { db, type DbExecutor, type Tx } from "@/server/db/client";
import {
  departments,
  jobRoles,
  modules,
  pages,
  teams,
  templateSteps,
  templates,
  userTemplateAssignments,
  users,
} from "@/server/db/schema";
import { AppError, PG_ERROR, pgErrorCode, rethrowDbError } from "@/server/errors";
import { logger } from "@/server/logger";
import {
  canManageTemplate,
  canViewTemplate,
  editorDepartmentIdInTx,
  type EditorDepartment,
} from "./content-access";
import { canViewPageInTx, visiblePagesCondition } from "./visibility";

type Phase = (typeof PHASES)[number];
type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];
type PageStatus = (typeof pages.status.enumValues)[number];

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  /** `null` = company-wide ("Alle"). */
  departmentId: string | null;
  departmentName: string | null;
  teamId: string | null;
  teamName: string | null;
  jobRoleId: string | null;
  jobRoleName: string | null;
  stepCount: number;
  assignmentCount: number;
  updatedAt: Date;
  /** Created by a team lead; leads may only manage these (admins manage all). */
  leadManaged: boolean;
  /** Whether the actor may change this template (always true for admins). */
  canManage: boolean;
}

export interface TemplateStepDto {
  id: string;
  pageId: string;
  /** Title in the actor's language (German fallback); `null` when the actor cannot view the page. */
  title: string | null;
  /** Module title in the actor's language; `null` when the actor cannot view the page. */
  moduleTitle: string | null;
  pageStatus: PageStatus;
  sortOrder: number;
}

export interface TemplateDetail extends Omit<TemplateListItem, "stepCount"> {
  /** Always all four phases, in phase order; steps in their display order. */
  phases: { phase: Phase; steps: TemplateStepDto[] }[];
  stepCount: number;
}

export interface TemplateDeletionImpact {
  name: string;
  used: boolean;
  /** People that have this template assigned. */
  assignmentCount: number;
  /** Of those, people whose onboarding is currently active. */
  activePlanCount: number;
}

const ERR = {
  teamNotInDepartment: "templates.errors.teamNotInDepartment",
  teamNeedsDepartment: "templates.errors.teamNeedsDepartment",
  pageArchived: "templates.errors.pageArchived",
  duplicatePage: "templates.errors.duplicatePage",
  confirmNameMismatch: "templates.errors.confirmNameMismatch",
} as const;

const NAME_SORT = [asc(templates.name), asc(templates.id)];

function pick<T>(row: T | undefined): T {
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

async function loadListItems(
  tx: Pick<Tx, "select">,
  editor: EditorDepartment,
  condition?: SQL,
): Promise<TemplateListItem[]> {
  const [rows, stepCounts, assignmentCounts] = await Promise.all([
    tx
      .select({
        template: templates,
        departmentName: departments.name,
        teamName: teams.name,
        jobRoleName: jobRoles.name,
      })
      .from(templates)
      .leftJoin(departments, eq(departments.id, templates.departmentId))
      .leftJoin(teams, eq(teams.id, templates.teamId))
      .leftJoin(jobRoles, eq(jobRoles.id, templates.jobRoleId))
      .where(condition)
      .orderBy(...NAME_SORT),
    tx
      .select({ templateId: templateSteps.templateId, total: count() })
      .from(templateSteps)
      .groupBy(templateSteps.templateId),
    tx
      .select({ templateId: userTemplateAssignments.templateId, total: count() })
      .from(userTemplateAssignments)
      .groupBy(userTemplateAssignments.templateId),
  ]);
  const steps = new Map(stepCounts.map((row) => [row.templateId, row.total]));
  const assignments = new Map(assignmentCounts.map((row) => [row.templateId, row.total]));
  return rows.map((row) => ({
    id: row.template.id,
    name: row.template.name,
    description: row.template.description,
    status: row.template.status,
    departmentId: row.template.departmentId,
    departmentName: row.departmentName,
    teamId: row.template.teamId,
    teamName: row.teamName,
    jobRoleId: row.template.jobRoleId,
    jobRoleName: row.jobRoleName,
    stepCount: steps.get(row.template.id) ?? 0,
    assignmentCount: assignments.get(row.template.id) ?? 0,
    updatedAt: row.template.updatedAt,
    leadManaged: row.template.leadManaged,
    canManage: canManageTemplate(editor, row.template),
  }));
}

/** SQL form of `canViewTemplate`: a lead sees company-wide templates and those of their department. */
function viewableTemplatesCondition(editor: EditorDepartment): SQL | undefined {
  if (editor === "all") return undefined;
  return editor === null
    ? isNull(templates.departmentId)
    : or(isNull(templates.departmentId), eq(templates.departmentId, editor));
}

/**
 * Admin: all templates by name. Team lead: company-wide and own-department templates, each with
 * `canManage`. Optionally only one status.
 */
export async function listTemplates(
  actor: Actor,
  input: ListTemplatesInput = {},
): Promise<TemplateListItem[]> {
  assertPermission(actor, "templates.edit");
  const { status } = listTemplatesSchema.parse(input);
  const editor = await editorDepartmentIdInTx(db, actor);
  return loadListItems(
    db,
    editor,
    and(viewableTemplatesCondition(editor), status ? eq(templates.status, status) : undefined),
  );
}

/**
 * Admin / team lead: one template with its steps grouped by phase and the status of each step's
 * page. A lead gets NOT_FOUND outside their view set; steps of pages they cannot view carry no titles.
 */
export async function getTemplate(actor: Actor, input: TemplateIdInput): Promise<TemplateDetail> {
  assertPermission(actor, "templates.edit");
  const { id } = templateIdSchema.parse(input);
  const editor = await editorDepartmentIdInTx(db, actor);
  const [item, stepRows] = await Promise.all([
    loadListItems(db, editor, and(eq(templates.id, id), viewableTemplatesCondition(editor))),
    db
      .select({
        id: templateSteps.id,
        pageId: templateSteps.pageId,
        phase: templateSteps.phase,
        sortOrder: templateSteps.sortOrder,
        titleDe: pages.titleDe,
        titleEn: pages.titleEn,
        pageStatus: pages.status,
        moduleTitleDe: modules.titleDe,
        moduleTitleEn: modules.titleEn,
      })
      .from(templateSteps)
      .innerJoin(pages, eq(pages.id, templateSteps.pageId))
      .innerJoin(modules, eq(modules.id, pages.moduleId))
      .where(eq(templateSteps.templateId, id))
      .orderBy(asc(templateSteps.sortOrder), asc(templateSteps.createdAt), asc(templateSteps.id)),
  ]);
  const base = pick(item[0]);
  const english = actor.locale === "en";
  const viewable =
    editor === "all" || stepRows.length === 0
      ? null
      : new Set(
          (
            await db
              .select({ id: pages.id })
              .from(pages)
              .where(
                and(
                  inArray(
                    pages.id,
                    stepRows.map((row) => row.pageId),
                  ),
                  visiblePagesCondition(actor, { includeArchived: true }),
                ),
              )
          ).map((row) => row.id),
        );
  const dtos = stepRows.map((row) => ({
    phase: row.phase,
    step: {
      id: row.id,
      pageId: row.pageId,
      title:
        viewable && !viewable.has(row.pageId)
          ? null
          : english && row.titleEn !== null
            ? row.titleEn
            : row.titleDe,
      moduleTitle:
        viewable && !viewable.has(row.pageId)
          ? null
          : english && row.moduleTitleEn !== null
            ? row.moduleTitleEn
            : row.moduleTitleDe,
      pageStatus: row.pageStatus,
      sortOrder: row.sortOrder,
    } satisfies TemplateStepDto,
  }));
  return {
    ...base,
    phases: PHASES.map((phase) => ({
      phase,
      steps: dtos.filter((entry) => entry.phase === phase).map((entry) => entry.step),
    })),
  };
}

/**
 * Select options for the template form. Admin: everything (`listOrgOptions`). Team lead: only their
 * own department, its teams and the job roles that fit it; a lead without a team gets empty lists.
 */
export async function listTemplateOptions(actor: Actor): Promise<OrgOptions> {
  assertPermission(actor, "templates.edit");
  const editor = await editorDepartmentIdInTx(db, actor);
  if (editor === null) return { departments: [], teams: [], jobRoles: [] };
  const [departmentRows, teamRows, jobRoleRows] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(editor === "all" ? undefined : eq(departments.id, editor))
      .orderBy(asc(departments.name), asc(departments.id)),
    db
      .select({ id: teams.id, name: teams.name, departmentId: teams.departmentId })
      .from(teams)
      .where(editor === "all" ? undefined : eq(teams.departmentId, editor))
      .orderBy(asc(teams.name), asc(teams.id)),
    db
      .select({ id: jobRoles.id, name: jobRoles.name, departmentId: jobRoles.departmentId })
      .from(jobRoles)
      .where(
        editor === "all"
          ? undefined
          : or(isNull(jobRoles.departmentId), eq(jobRoles.departmentId, editor)),
      )
      .orderBy(asc(jobRoles.name), asc(jobRoles.id)),
  ]);
  return {
    departments: departmentRows,
    teams: teamRows,
    jobRoles: jobRoleRows,
  };
}

interface ResolvedScope {
  departmentId: string | null;
  teamId: string | null;
  jobRoleId: string | null;
}

/**
 * Maps "all" to null and verifies that department, team and job role exist and fit together
 * (a role must be company-wide or bound to the template department).
 */
async function resolveScope(
  tx: Tx,
  data: {
    departmentId: string;
    teamId: string | null;
    jobRoleId: string | null;
  },
): Promise<ResolvedScope> {
  const departmentId = data.departmentId === ALL_DEPARTMENTS ? null : data.departmentId;
  if (departmentId === null && data.teamId !== null) {
    throw new AppError("VALIDATION", {
      reasonKey: ERR.teamNeedsDepartment,
      fieldErrors: { teamId: [ERR.teamNeedsDepartment] },
    });
  }
  if (departmentId !== null) {
    const [department] = await tx
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, departmentId))
      .for("share");
    pick(department);
  }
  if (data.teamId !== null) {
    const [team] = await tx
      .select({ id: teams.id, departmentId: teams.departmentId })
      .from(teams)
      .where(eq(teams.id, data.teamId))
      .for("share");
    if (pick(team).departmentId !== departmentId) {
      throw new AppError("VALIDATION", {
        reasonKey: ERR.teamNotInDepartment,
        fieldErrors: { teamId: [ERR.teamNotInDepartment] },
      });
    }
  }
  if (data.jobRoleId !== null) {
    await assertJobRoleFitsDepartmentInTx(
      tx,
      data.jobRoleId,
      departmentId,
      () => new AppError("NOT_FOUND"),
    );
  }
  return { departmentId, teamId: data.teamId, jobRoleId: data.jobRoleId };
}

/**
 * Admin: any scope. Team lead: only their own department (a lead without a team gets FORBIDDEN,
 * naming another department or "all" too); the template is marked lead-managed.
 */
export async function createTemplate(
  actor: Actor,
  input: CreateTemplateInput,
): Promise<{ id: string }> {
  assertPermission(actor, "templates.edit");
  const data = createTemplateSchema.parse(input);
  try {
    const id = await db.transaction(async (tx) => {
      const editor = await editorDepartmentIdInTx(tx, actor);
      if (editor === null || (editor !== "all" && data.departmentId !== editor)) {
        throw new AppError("FORBIDDEN");
      }
      const scope = await resolveScope(tx, data);
      const [row] = await tx
        .insert(templates)
        .values({
          name: data.name,
          description: data.description,
          ...scope,
          leadManaged: editor !== "all",
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({ id: templates.id });
      return pick(row).id;
    });
    logger.info({ action: "templates.create", entityId: id, actorId: actor.id }, "mutation");
    return { id };
  } catch (e) {
    return rethrowDbError(e);
  }
}

/** A lead may not move a template to another department; admin edits keep `lead_managed`. */
export async function updateTemplate(
  actor: Actor,
  input: UpdateTemplateInput,
): Promise<{ id: string }> {
  assertPermission(actor, "templates.edit");
  const data = updateTemplateSchema.parse(input);
  try {
    await db.transaction(async (tx) => {
      const { editor } = await lockManageableTemplate(tx, actor, data.id);
      if (editor !== "all" && data.departmentId !== editor) throw new AppError("FORBIDDEN");
      const scope = await resolveScope(tx, data);
      await tx
        .update(templates)
        .set({
          name: data.name,
          description: data.description,
          ...scope,
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(templates.id, data.id));
    });
    logger.info({ action: "templates.update", entityId: data.id, actorId: actor.id }, "mutation");
    return { id: data.id };
  } catch (e) {
    return rethrowDbError(e);
  }
}

interface TemplateAccessRow {
  id: string;
  name: string;
  status: TemplateStatus;
  departmentId: string | null;
  leadManaged: boolean;
}

/**
 * Throws FORBIDDEN when the actor can see the template but not change it, NOT_FOUND when it is
 * outside their view set (the same answer as for a missing template).
 */
async function assertCanManageTemplateInTx(
  executor: DbExecutor,
  actor: Actor,
  template: TemplateAccessRow,
): Promise<EditorDepartment> {
  const editor = await editorDepartmentIdInTx(executor, actor);
  if (canManageTemplate(editor, template)) return editor;
  throw new AppError(canViewTemplate(editor, template) ? "FORBIDDEN" : "NOT_FOUND");
}

/**
 * Locks the template row so step edits and status changes on one template serialize, then checks
 * the actor may change it. The editor scope is read in the same transaction as the write.
 */
async function lockManageableTemplate(
  tx: Tx,
  actor: Actor,
  id: string,
): Promise<TemplateAccessRow & { editor: EditorDepartment }> {
  const [row] = await tx
    .select({
      id: templates.id,
      name: templates.name,
      status: templates.status,
      departmentId: templates.departmentId,
      leadManaged: templates.leadManaged,
    })
    .from(templates)
    .where(eq(templates.id, id))
    .for("update");
  const template = pick(row);
  const editor = await assertCanManageTemplateInTx(tx, actor, template);
  return { ...template, editor };
}

async function setStatus(actor: Actor, input: TemplateIdInput, status: TemplateStatus) {
  assertPermission(actor, "templates.edit");
  const { id } = templateIdSchema.parse(input);
  await db.transaction(async (tx) => {
    await lockManageableTemplate(tx, actor, id);
    await tx
      .update(templates)
      .set({ status, updatedBy: actor.id, updatedAt: new Date() })
      .where(eq(templates.id, id));
  });
  logger.info({ action: `templates.${status}`, entityId: id, actorId: actor.id }, "mutation");
}

/** Archived templates are no longer offered for assignment; existing plans stay as they are. */
export async function archiveTemplate(actor: Actor, input: TemplateIdInput): Promise<void> {
  await setStatus(actor, input, "archived");
}

export async function restoreTemplate(actor: Actor, input: TemplateIdInput): Promise<void> {
  await setStatus(actor, input, "active");
}

async function impactOf(
  executor: Pick<Tx, "select">,
  template: { id: string; name: string },
): Promise<TemplateDeletionImpact> {
  const [row] = await executor
    .select({
      assignments: count(),
      active: sql<number>`count(*) filter (where ${users.onboardingStatus} = 'active')`.mapWith(
        Number,
      ),
    })
    .from(userTemplateAssignments)
    .innerJoin(users, eq(users.id, userTemplateAssignments.userId))
    .where(eq(userTemplateAssignments.templateId, template.id));
  const assignmentCount = row?.assignments ?? 0;
  return {
    name: template.name,
    used: assignmentCount > 0,
    assignmentCount,
    activePlanCount: row?.active ?? 0,
  };
}

/** What a delete would do (K§8): unused templates are deleted, used ones archived. */
export async function getTemplateDeletionImpact(
  actor: Actor,
  input: TemplateIdInput,
): Promise<TemplateDeletionImpact> {
  assertPermission(actor, "templates.edit");
  const { id } = templateIdSchema.parse(input);
  const [template] = await db
    .select({
      id: templates.id,
      name: templates.name,
      status: templates.status,
      departmentId: templates.departmentId,
      leadManaged: templates.leadManaged,
    })
    .from(templates)
    .where(eq(templates.id, id));
  await assertCanManageTemplateInTx(db, actor, pick(template));
  return impactOf(db, pick(template));
}

/**
 * Deletes an unused template for good; a template that people were assigned is archived
 * instead and the admin must type its name (K§8). Existing plans are never affected.
 */
export async function deleteTemplate(
  actor: Actor,
  input: DeleteTemplateInput,
): Promise<{ result: "deleted" | "archived" }> {
  assertPermission(actor, "templates.edit");
  const data = deleteTemplateSchema.parse(input);
  let result: "deleted" | "archived";
  try {
    result = await db.transaction(async (tx) => {
      // FOR UPDATE also blocks concurrent assignments (their FK insert takes a key-share lock).
      const template = await lockManageableTemplate(tx, actor, data.id);
      const impact = await impactOf(tx, template);
      if (!impact.used) {
        await tx.delete(templates).where(eq(templates.id, data.id));
        return "deleted" as const;
      }
      if (data.confirmName?.trim() !== template.name) {
        throw new AppError("VALIDATION", {
          reasonKey: ERR.confirmNameMismatch,
          fieldErrors: { confirmName: [ERR.confirmNameMismatch] },
        });
      }
      await tx
        .update(templates)
        .set({ status: "archived", updatedBy: actor.id, updatedAt: new Date() })
        .where(eq(templates.id, data.id));
      return "archived" as const;
    });
  } catch (e) {
    return rethrowDbError(e);
  }
  logger.info({ action: `templates.${result}`, entityId: data.id, actorId: actor.id }, "mutation");
  return { result };
}

// ---- steps ----

interface StepRow {
  id: string;
  templateId: string;
  phase: Phase;
}

/** Reads a step, locks its template, then re-reads the step (it may have moved meanwhile). */
async function lockStepTemplate(tx: Tx, actor: Actor, stepId: string): Promise<StepRow> {
  const [first] = await tx
    .select({ templateId: templateSteps.templateId })
    .from(templateSteps)
    .where(eq(templateSteps.id, stepId));
  await lockManageableTemplate(tx, actor, pick(first).templateId);
  const [step] = await tx
    .select({
      id: templateSteps.id,
      templateId: templateSteps.templateId,
      phase: templateSteps.phase,
    })
    .from(templateSteps)
    .where(eq(templateSteps.id, stepId));
  return pick(step);
}

async function nextSortOrder(tx: Tx, templateId: string, phase: Phase): Promise<number> {
  const [row] = await tx
    .select({
      next: sql<number>`coalesce(max(${templateSteps.sortOrder}), -1) + 1`.mapWith(Number),
    })
    .from(templateSteps)
    .where(and(eq(templateSteps.templateId, templateId), eq(templateSteps.phase, phase)));
  return row?.next ?? 0;
}

async function touchTemplate(tx: Tx, actor: Actor, templateId: string): Promise<void> {
  await tx
    .update(templates)
    .set({ updatedBy: actor.id, updatedAt: new Date() })
    .where(eq(templates.id, templateId));
}

/**
 * Adds a page at the end of a phase. Archived pages are refused, a page may appear once. A lead
 * may only add pages they can see (published, or drafts of their own department).
 */
export async function addTemplateStep(
  actor: Actor,
  input: AddTemplateStepInput,
): Promise<{ id: string }> {
  assertPermission(actor, "templates.edit");
  const data = addTemplateStepSchema.parse(input);
  try {
    const id = await db.transaction(async (tx) => {
      const { editor } = await lockManageableTemplate(tx, actor, data.templateId);
      const [page] = await tx
        .select({ id: pages.id, status: pages.status })
        .from(pages)
        .where(eq(pages.id, data.pageId));
      if (
        editor !== "all" &&
        !(await canViewPageInTx(tx, actor, data.pageId, { includeArchived: true }))
      ) {
        throw new AppError("NOT_FOUND");
      }
      if (pick(page).status === "archived") {
        throw new AppError("VALIDATION", {
          reasonKey: ERR.pageArchived,
          fieldErrors: { pageId: [ERR.pageArchived] },
        });
      }
      const [existing] = await tx
        .select({ id: templateSteps.id })
        .from(templateSteps)
        .where(
          and(eq(templateSteps.templateId, data.templateId), eq(templateSteps.pageId, data.pageId)),
        );
      if (existing) throw new AppError("CONFLICT", { reasonKey: ERR.duplicatePage });
      const [row] = await tx
        .insert(templateSteps)
        .values({
          templateId: data.templateId,
          pageId: data.pageId,
          phase: data.phase,
          sortOrder: await nextSortOrder(tx, data.templateId, data.phase),
        })
        .returning({ id: templateSteps.id });
      await touchTemplate(tx, actor, data.templateId);
      return pick(row).id;
    });
    logger.info({ action: "templates.step.add", entityId: id, actorId: actor.id }, "mutation");
    return { id };
  } catch (e) {
    if (pgErrorCode(e) === PG_ERROR.uniqueViolation) {
      throw new AppError("CONFLICT", { reasonKey: ERR.duplicatePage });
    }
    return rethrowDbError(e);
  }
}

export async function removeTemplateStep(actor: Actor, input: StepIdInput): Promise<void> {
  assertPermission(actor, "templates.edit");
  const { stepId } = stepIdSchema.parse(input);
  await db.transaction(async (tx) => {
    const step = await lockStepTemplate(tx, actor, stepId);
    await tx.delete(templateSteps).where(eq(templateSteps.id, stepId));
    await touchTemplate(tx, actor, step.templateId);
  });
  logger.info({ action: "templates.step.remove", entityId: stepId, actorId: actor.id }, "mutation");
}

/** Swaps a step with its neighbour inside the same phase; at the edge nothing changes. */
export async function moveTemplateStep(actor: Actor, input: MoveTemplateStepInput): Promise<void> {
  assertPermission(actor, "templates.edit");
  const { stepId, direction } = moveTemplateStepSchema.parse(input);
  await db.transaction(async (tx) => {
    const step = await lockStepTemplate(tx, actor, stepId);
    const siblings = await tx
      .select({ id: templateSteps.id, sortOrder: templateSteps.sortOrder })
      .from(templateSteps)
      .where(
        and(eq(templateSteps.templateId, step.templateId), eq(templateSteps.phase, step.phase)),
      )
      .orderBy(asc(templateSteps.sortOrder), asc(templateSteps.createdAt), asc(templateSteps.id));
    const index = siblings.findIndex((row) => row.id === stepId);
    const target = direction === "up" ? index - 1 : index + 1;
    const ordered = [...siblings];
    const [moved, neighbour] = [ordered[index], ordered[target]];
    if (!moved || !neighbour) return;
    ordered[index] = neighbour;
    ordered[target] = moved;
    // Renumber 0..n-1 (also repairs equal sort orders), writing only changed rows.
    for (const [position, row] of ordered.entries()) {
      if (row.sortOrder === position) continue;
      await tx
        .update(templateSteps)
        .set({ sortOrder: position })
        .where(eq(templateSteps.id, row.id));
    }
    await touchTemplate(tx, actor, step.templateId);
  });
  logger.info({ action: "templates.step.move", entityId: stepId, actorId: actor.id }, "mutation");
}

/** Moves a step to another phase, at the end of it. */
export async function changeTemplateStepPhase(
  actor: Actor,
  input: ChangeTemplateStepPhaseInput,
): Promise<void> {
  assertPermission(actor, "templates.edit");
  const { stepId, phase } = changeTemplateStepPhaseSchema.parse(input);
  await db.transaction(async (tx) => {
    const step = await lockStepTemplate(tx, actor, stepId);
    if (step.phase === phase) return;
    await tx
      .update(templateSteps)
      .set({ phase, sortOrder: await nextSortOrder(tx, step.templateId, phase) })
      .where(eq(templateSteps.id, stepId));
    await touchTemplate(tx, actor, step.templateId);
  });
  logger.info({ action: "templates.step.phase", entityId: stepId, actorId: actor.id }, "mutation");
}
