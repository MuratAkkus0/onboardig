import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { hasEnglish } from "@/lib/domain/locale-content";
import {
  allowedPageActions,
  nextPageStatus,
  type PageAction,
  type PageStatus,
} from "@/lib/domain/page-status";
import { collectUploadIds } from "@/lib/tiptap/uploads";
import { extractText } from "@/lib/tiptap/extract-text";
import { InvalidDocumentError, sanitizeDoc } from "@/lib/tiptap/sanitize";
import {
  changePageStatusSchema,
  createPageSchema,
  deletePageSchema,
  idInputSchema,
  listLibrarySchema,
  movePageToModuleSchema,
  moveSchema,
  savePageContentSchema,
  type Direction,
} from "@/lib/validation/content";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { db, type DbExecutor, type Tx } from "@/server/db/client";
import {
  modules,
  pageCompletions,
  pages,
  templateSteps,
  uploads,
  userPlanSteps,
  users,
} from "@/server/db/schema";
import type { TiptapDoc } from "@/server/db/schema/custom-types";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { getStorage } from "@/server/storage";
import { assertLockHeldInTx, getLockStateInTx, type LockState } from "./locks";
import {
  isForeignKeyError,
  loadModulesWithPages,
  moveWithinOrder,
  pageOrder,
  type LibraryModule,
  type PageStatusValue,
} from "./modules";
import * as planHooks from "./plan-hooks";
import { canViewPageInTx, visiblePagesCondition } from "./visibility";

export interface PageEditDto {
  id: string;
  moduleId: string;
  moduleTitle: string;
  status: PageStatusValue;
  titleDe: string;
  titleEn: string | null;
  contentDe: TiptapDoc;
  contentEn: TiptapDoc | null;
  /** Displayed "last edited at": `content_updated_at`, unchanged by moves and status changes. */
  lastEditedAt: Date;
  lastEditedByName: string | null;
  allowedActions: PageAction[];
  lock: LockState;
}

export interface PageViewDto {
  title: string;
  content: TiptapDoc;
  /** The viewer reads English but only the German variant exists. */
  isFallback: boolean;
  status: PageStatusValue;
  lastEditedAt: Date;
  lastEditedByName: string | null;
}

export interface PageDeletionImpact {
  used: boolean;
  templateCount: number;
  planCount: number;
  activePlanCount: number;
  completionCount: number;
}

export interface PickerPage {
  id: string;
  title: string;
  moduleTitle: string;
  status: PageStatusValue;
}

async function loadEditDto(
  executor: DbExecutor,
  viewerId: string,
  pageId: string,
): Promise<PageEditDto> {
  const [row] = await executor
    .select({
      page: pages,
      moduleTitle: modules.titleDe,
      lastEditedByName: users.name,
    })
    .from(pages)
    .innerJoin(modules, eq(modules.id, pages.moduleId))
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .where(eq(pages.id, pageId));
  if (!row) throw new AppError("NOT_FOUND");
  const { page } = row;
  return {
    id: page.id,
    moduleId: page.moduleId,
    moduleTitle: row.moduleTitle,
    status: page.status,
    titleDe: page.titleDe,
    titleEn: page.titleEn,
    contentDe: page.contentDe,
    contentEn: page.contentEn,
    lastEditedAt: page.contentUpdatedAt,
    lastEditedByName: row.lastEditedByName,
    allowedActions: allowedPageActions(page.status),
    lock: await getLockStateInTx(executor, { pageId, viewerId }),
  };
}

/** Locks the page row against concurrent status changes, saves and deletes (never blocks FK key-share locks). */
async function lockPageInTx(
  tx: Tx,
  pageId: string,
): Promise<{ id: string; status: PageStatus; titleDe: string; moduleId: string }> {
  const [page] = await tx
    .select({
      id: pages.id,
      status: pages.status,
      titleDe: pages.titleDe,
      moduleId: pages.moduleId,
    })
    .from(pages)
    .where(eq(pages.id, pageId))
    .for("no key update");
  if (!page) throw new AppError("NOT_FOUND");
  return page;
}

/** Status transition plus the plan hook, inside the caller's transaction. */
async function applyStatusChangeInTx(
  tx: Tx,
  actorId: string,
  page: { id: string; status: PageStatus },
  action: PageAction,
): Promise<void> {
  const to = nextPageStatus(page.status, action);
  await tx.update(pages).set({ status: to }).where(eq(pages.id, page.id));
  await planHooks.onPageStatusChanged(tx, {
    pageId: page.id,
    from: page.status,
    to,
    actorId,
  });
}

async function nextSortOrderInModule(tx: Tx, moduleId: string): Promise<number> {
  const [max] = await tx
    .select({ value: sql<number>`coalesce(max(${pages.sortOrder}), -1)` })
    .from(pages)
    .where(eq(pages.moduleId, moduleId));
  return (max?.value ?? -1) + 1;
}

export async function createPage(
  actor: Actor,
  input: { moduleId: string; titleDe: string },
): Promise<{ id: string }> {
  assertPermission(actor, "content.manage");
  const data = createPageSchema.parse(input);
  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.id, data.moduleId))
      .for("update");
    if (!parent) throw new AppError("NOT_FOUND");
    const [row] = await tx
      .insert(pages)
      .values({
        moduleId: data.moduleId,
        titleDe: data.titleDe,
        sortOrder: await nextSortOrderInModule(tx, data.moduleId),
      })
      .returning({ id: pages.id });
    if (!row) throw new AppError("INTERNAL");
    return { id: row.id };
  });
}

export async function getPageForEdit(actor: Actor, input: { id: string }): Promise<PageEditDto> {
  assertPermission(actor, "content.manage");
  const { id } = idInputSchema.parse(input);
  return loadEditDto(db, actor.id, id);
}

/** Page as the viewer reads it. Admins may also open archived pages (preview). */
export async function getPageForView(actor: Actor, input: { id: string }): Promise<PageViewDto> {
  const { id } = idInputSchema.parse(input);
  return db.transaction(async (tx) => {
    if (!(await canViewPageInTx(tx, actor, id, { includeArchived: true }))) {
      throw new AppError("NOT_FOUND");
    }
    const [row] = await tx
      .select({ page: pages, lastEditedByName: users.name })
      .from(pages)
      .leftJoin(users, eq(users.id, pages.updatedBy))
      .where(eq(pages.id, id));
    if (!row) throw new AppError("NOT_FOUND");
    const { page } = row;
    const english = hasEnglish(page);
    const useEnglish = actor.locale === "en" && english && page.contentEn !== null;
    return {
      title: useEnglish && page.titleEn ? page.titleEn : page.titleDe,
      content: useEnglish && page.contentEn ? page.contentEn : page.contentDe,
      isFallback: actor.locale === "en" && !english,
      status: page.status,
      lastEditedAt: page.contentUpdatedAt,
      lastEditedByName: row.lastEditedByName,
    };
  });
}

function sanitizeField(doc: unknown, field: "contentDe" | "contentEn"): TiptapDoc {
  try {
    return sanitizeDoc(doc);
  } catch (e) {
    if (!(e instanceof InvalidDocumentError)) throw e;
    const key =
      e.reason === "tooLarge" ? "editor.errors.contentTooLarge" : "editor.errors.invalidContent";
    throw new AppError("VALIDATION", { fieldErrors: { [field]: [key] } });
  }
}

/** Every image in the content must be an upload of this very page (blueprint section 2.3). */
async function assertImagesBelongToPage(tx: Tx, pageId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = await tx
    .select({ id: uploads.id, pageId: uploads.pageId })
    .from(uploads)
    .where(inArray(uploads.id, ids));
  const owned = new Set(rows.filter((row) => row.pageId === pageId).map((row) => row.id));
  if (ids.some((id) => !owned.has(id))) {
    throw new AppError("VALIDATION", { reasonKey: "editor.errors.foreignImage" });
  }
}

/**
 * Saves both language variants. Requires the caller's unexpired edit lock (verified `FOR UPDATE`
 * in the same transaction, never re-acquired), sanitizes the documents, extracts the search text
 * and stores the English variant only when it is complete.
 */
export async function savePageContent(
  actor: Actor,
  input: {
    id: string;
    titleDe: string;
    titleEn?: string | null;
    contentDe: unknown;
    contentEn?: unknown;
  },
): Promise<PageEditDto> {
  assertPermission(actor, "content.manage");
  const raw = savePageContentSchema.parse(input);
  const contentDe = sanitizeField(raw.contentDe, "contentDe");
  const contentEn = raw.contentEn == null ? null : sanitizeField(raw.contentEn, "contentEn");
  // Sanitizing can empty a document, so the EN all-or-nothing rule is checked again.
  const data = savePageContentSchema.parse({ ...raw, contentDe, contentEn });
  const english = hasEnglish({ titleEn: data.titleEn, contentEn: data.contentEn });
  const imageIds = collectUploadIds(data.contentDe, english ? data.contentEn : null);

  return db.transaction(async (tx) => {
    const page = await lockPageInTx(tx, data.id);
    await assertLockHeldInTx(tx, { pageId: page.id, userId: actor.id });
    await assertImagesBelongToPage(tx, page.id, imageIds);
    await tx
      .update(pages)
      .set({
        titleDe: data.titleDe,
        titleEn: english ? data.titleEn : null,
        contentDe: data.contentDe,
        contentEn: english ? data.contentEn : null,
        textDe: extractText(data.contentDe),
        textEn: english ? extractText(data.contentEn) : null,
        contentUpdatedAt: sql`now()`,
        updatedBy: actor.id,
      })
      .where(eq(pages.id, page.id));
    if (page.status === "published") {
      await planHooks.onPublishedPageContentChanged(tx, { pageId: page.id, actorId: actor.id });
    }
    return loadEditDto(tx, actor.id, page.id);
  });
}

export async function changePageStatus(
  actor: Actor,
  input: { id: string; action: PageAction },
): Promise<PageEditDto> {
  assertPermission(actor, "content.manage");
  const { id, action } = changePageStatusSchema.parse(input);
  return db.transaction(async (tx) => {
    const page = await lockPageInTx(tx, id);
    await applyStatusChangeInTx(tx, actor.id, page, action);
    return loadEditDto(tx, actor.id, id);
  });
}

export async function movePage(
  actor: Actor,
  input: { id: string; direction: Direction },
): Promise<void> {
  assertPermission(actor, "content.manage");
  const { id, direction } = moveSchema.parse(input);
  await db.transaction(async (tx) => {
    const [page] = await tx
      .select({ moduleId: pages.moduleId })
      .from(pages)
      .where(eq(pages.id, id));
    if (!page) throw new AppError("NOT_FOUND");
    await tx
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.id, page.moduleId))
      .for("update");
    const siblings = await tx
      .select({ id: pages.id, sortOrder: pages.sortOrder })
      .from(pages)
      .where(eq(pages.moduleId, page.moduleId))
      .orderBy(...pageOrder)
      .for("update");
    await moveWithinOrder(tx, pages, siblings, id, direction);
  });
}

/** Appends the page to the end of another module. Does not touch the "last edited" data. */
export async function movePageToModule(
  actor: Actor,
  input: { id: string; moduleId: string },
): Promise<void> {
  assertPermission(actor, "content.manage");
  const { id, moduleId } = movePageToModuleSchema.parse(input);
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ moduleId: pages.moduleId })
      .from(pages)
      .where(eq(pages.id, id));
    if (!current) throw new AppError("NOT_FOUND");
    if (current.moduleId === moduleId) return;
    const parents = await tx
      .select({ id: modules.id })
      .from(modules)
      .where(inArray(modules.id, [current.moduleId, moduleId]))
      .orderBy(asc(modules.id))
      .for("update");
    if (!parents.some((parent) => parent.id === moduleId)) throw new AppError("NOT_FOUND");
    const page = await lockPageInTx(tx, id);
    if (page.moduleId !== current.moduleId) throw new AppError("CONFLICT");
    await tx
      .update(pages)
      .set({ moduleId, sortOrder: await nextSortOrderInModule(tx, moduleId) })
      .where(eq(pages.id, id));
  });
}

async function computeImpact(executor: DbExecutor, pageId: string): Promise<PageDeletionImpact> {
  const [templates] = await executor
    .select({ value: sql<number>`count(distinct ${templateSteps.templateId})::int` })
    .from(templateSteps)
    .where(eq(templateSteps.pageId, pageId));
  const [plans] = await executor
    .select({
      all: sql<number>`count(distinct ${userPlanSteps.userId})::int`,
      active: sql<number>`count(distinct ${userPlanSteps.userId}) filter (where ${users.onboardingStatus} in ('active', 'completed'))::int`,
    })
    .from(userPlanSteps)
    .innerJoin(users, eq(users.id, userPlanSteps.userId))
    .where(eq(userPlanSteps.pageId, pageId));
  const [completions] = await executor
    .select({ value: sql<number>`count(*)::int` })
    .from(pageCompletions)
    .where(eq(pageCompletions.pageId, pageId));
  const templateCount = templates?.value ?? 0;
  const planCount = plans?.all ?? 0;
  const completionCount = completions?.value ?? 0;
  return {
    // used <=> template step OR plan step (any user status) OR completion record
    used: templateCount > 0 || planCount > 0 || completionCount > 0,
    templateCount,
    planCount,
    activePlanCount: plans?.active ?? 0,
    completionCount,
  };
}

export async function getPageDeletionImpact(
  actor: Actor,
  input: { id: string },
): Promise<PageDeletionImpact> {
  assertPermission(actor, "content.manage");
  const { id } = idInputSchema.parse(input);
  const [page] = await db.select({ id: pages.id }).from(pages).where(eq(pages.id, id));
  if (!page) throw new AppError("NOT_FOUND");
  return computeImpact(db, id);
}

/**
 * Unused pages are deleted for good (files after commit). Used pages are archived instead and
 * need `confirmName === titleDe`. A reference inserted concurrently makes the DELETE fail with an
 * FK error, reported as CONFLICT `library.errors.pageBecameUsed`; the retry takes the archive path.
 */
export async function deletePage(
  actor: Actor,
  input: { id: string; confirmName?: string },
): Promise<{ result: "deleted" | "archived" }> {
  assertPermission(actor, "content.manage");
  const { id, confirmName } = deletePageSchema.parse(input);
  let storageKeys: string[] = [];
  let result: "deleted" | "archived";
  try {
    result = await db.transaction(async (tx) => {
      const page = await lockPageInTx(tx, id);
      const impact = await computeImpact(tx, id);
      if (!impact.used) {
        storageKeys = (
          await tx.select({ key: uploads.storageKey }).from(uploads).where(eq(uploads.pageId, id))
        ).map((row) => row.key);
        await tx.delete(pages).where(eq(pages.id, id));
        return "deleted" as const;
      }
      if (page.status === "archived") {
        throw new AppError("IN_USE", { reasonKey: "library.errors.pageInUse", ...impact });
      }
      if (confirmName !== page.titleDe) {
        throw new AppError("VALIDATION", {
          reasonKey: "library.errors.confirmNameMismatch",
          fieldErrors: { confirmName: ["library.errors.confirmNameMismatch"] },
        });
      }
      await applyStatusChangeInTx(tx, actor.id, page, "archive");
      return "archived" as const;
    });
  } catch (e) {
    if (isForeignKeyError(e)) {
      throw new AppError("CONFLICT", { reasonKey: "library.errors.pageBecameUsed" });
    }
    throw e;
  }
  await Promise.all(
    storageKeys.map((key) =>
      getStorage()
        .delete(key)
        .catch((error: unknown) =>
          logger.error(
            { err: error instanceof Error ? error.message : "unknown", pageId: id },
            "deleting an upload file failed",
          ),
        ),
    ),
  );
  return { result };
}

export async function listLibrary(
  actor: Actor,
  input: { status?: PageStatusValue } = {},
): Promise<LibraryModule[]> {
  assertPermission(actor, "library.read");
  const { status } = listLibrarySchema.parse(input);
  return loadModulesWithPages(actor, status);
}

/** Pages a template or plan step could point to (archived pages are never offered). */
export async function listPagesForPicker(actor: Actor): Promise<PickerPage[]> {
  assertPermission(actor, "library.read");
  const rows = await db
    .select({
      id: pages.id,
      titleDe: pages.titleDe,
      titleEn: pages.titleEn,
      moduleTitleDe: modules.titleDe,
      moduleTitleEn: modules.titleEn,
      status: pages.status,
    })
    .from(pages)
    .innerJoin(modules, eq(modules.id, pages.moduleId))
    .where(visiblePagesCondition(actor))
    .orderBy(asc(modules.sortOrder), asc(modules.createdAt), asc(modules.id), ...pageOrder);
  const english = actor.locale === "en";
  return rows.map((row) => ({
    id: row.id,
    title: english && row.titleEn !== null ? row.titleEn : row.titleDe,
    moduleTitle: english && row.moduleTitleEn !== null ? row.moduleTitleEn : row.moduleTitleDe,
    status: row.status,
  }));
}
