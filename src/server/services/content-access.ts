import "server-only";
import { and, eq } from "drizzle-orm";
import type { Actor } from "@/server/auth/types";
import type { DbExecutor } from "@/server/db/client";
import { modules, pages, teams, users } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { canViewPageInTx, visiblePagesCondition } from "./visibility";

/**
 * Which modules an actor may edit: `"all"` (admin), the department id of a team lead's team, or
 * `null` (employee, or a lead without a team: edits nothing).
 */
export type EditorDepartment = "all" | string | null;

/** Reads the editor scope with the caller's executor, so writes see the same snapshot as the check. */
export async function editorDepartmentIdInTx(
  executor: DbExecutor,
  actor: Actor,
): Promise<EditorDepartment> {
  if (actor.role === "admin") return "all";
  if (actor.role !== "team_lead") return null;
  const [row] = await executor
    .select({ departmentId: teams.departmentId })
    .from(users)
    .innerJoin(teams, eq(teams.id, users.teamId))
    .where(eq(users.id, actor.id));
  return row?.departmentId ?? null;
}

/** Admin always; a lead only for modules owned by their own department (company-wide: admin only). */
export function canEditModule(
  editor: EditorDepartment,
  module: { departmentId: string | null },
): boolean {
  if (editor === "all") return true;
  return editor !== null && module.departmentId !== null && module.departmentId === editor;
}

/** A page is editable exactly when its module is. */
export function canEditPage(
  editor: EditorDepartment,
  page: { moduleDepartmentId: string | null },
): boolean {
  return canEditModule(editor, { departmentId: page.moduleDepartmentId });
}

/**
 * Throws FORBIDDEN when the actor can see the module but not edit it, NOT_FOUND when they cannot
 * even see it (a module is visible when it holds a page the actor may see).
 */
export async function assertCanEditModuleInTx(
  executor: DbExecutor,
  actor: Actor,
  editor: EditorDepartment,
  module: { id: string; departmentId: string | null },
): Promise<void> {
  if (canEditModule(editor, module)) return;
  const [visible] = await executor
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.moduleId, module.id), visiblePagesCondition(actor)))
    .limit(1);
  throw new AppError(visible ? "FORBIDDEN" : "NOT_FOUND");
}

/** Loads the module (optionally locked) and checks edit rights; NOT_FOUND when it does not exist. */
export async function loadEditableModuleInTx(
  tx: DbExecutor,
  actor: Actor,
  moduleId: string,
  lock: "update" | null = null,
): Promise<{ id: string; departmentId: string | null; editor: EditorDepartment }> {
  const query = tx
    .select({ id: modules.id, departmentId: modules.departmentId })
    .from(modules)
    .where(eq(modules.id, moduleId));
  const [module] = await (lock === "update" ? query.for("update") : query);
  if (!module) throw new AppError("NOT_FOUND");
  const editor = await editorDepartmentIdInTx(tx, actor);
  await assertCanEditModuleInTx(tx, actor, editor, module);
  return { ...module, editor };
}

/** Checks edit rights on a page through its module; FORBIDDEN / NOT_FOUND as for modules. */
export async function assertCanEditPageInTx(
  executor: DbExecutor,
  actor: Actor,
  pageId: string,
): Promise<{ moduleId: string; moduleDepartmentId: string | null }> {
  const [row] = await executor
    .select({ moduleId: pages.moduleId, moduleDepartmentId: modules.departmentId })
    .from(pages)
    .innerJoin(modules, eq(modules.id, pages.moduleId))
    .where(eq(pages.id, pageId))
    // Serializes with an admin moving the module to another department during the caller's write.
    .for("share", { of: modules });
  if (!row) throw new AppError("NOT_FOUND");
  const editor = await editorDepartmentIdInTx(executor, actor);
  if (canEditPage(editor, row)) return row;
  const viewable = await canViewPageInTx(executor, actor, pageId, { includeArchived: true });
  throw new AppError(viewable ? "FORBIDDEN" : "NOT_FOUND");
}

/** Templates a lead may see: company-wide ones and those of their own department; admins see all. */
export function canViewTemplate(
  editor: EditorDepartment,
  template: { departmentId: string | null },
): boolean {
  if (editor === "all") return true;
  return template.departmentId === null || (editor !== null && template.departmentId === editor);
}

/** Admin always; a lead only for lead-managed templates of their own department. */
export function canManageTemplate(
  editor: EditorDepartment,
  template: { departmentId: string | null; leadManaged: boolean },
): boolean {
  if (editor === "all") return true;
  return (
    editor !== null &&
    template.leadManaged &&
    template.departmentId !== null &&
    template.departmentId === editor
  );
}
