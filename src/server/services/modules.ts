import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { W1_CONTENT_CONFIG, type PAGE_STATUSES } from "@/config/app";
import {
  createModuleSchema,
  idInputSchema,
  moveSchema,
  updateModuleSchema,
  type CreateModuleInput,
  type Direction,
  type UpdateModuleInput,
} from "@/lib/validation/content";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { db, type Tx } from "@/server/db/client";
import { modules, pages, users } from "@/server/db/schema";
import { AppError, pgErrorCode, PG_ERROR } from "@/server/errors";
import { visiblePagesCondition } from "./visibility";

export type PageStatusValue = (typeof PAGE_STATUSES)[number];

export interface LibraryPage {
  id: string;
  moduleId: string;
  /** Title in the viewer's language (DE fallback). */
  title: string;
  titleDe: string;
  titleEn: string | null;
  /** True when the viewer reads English but only the German title exists. */
  isFallback: boolean;
  /** SQL "EN available": `title_en IS NOT NULL` (the all-or-nothing CHECK guarantees content). */
  hasEnglish: boolean;
  status: PageStatusValue;
  sortOrder: number;
  contentUpdatedAt: Date;
  lastEditedByName: string | null;
}

export interface ModuleWithPages {
  id: string;
  title: string;
  titleDe: string;
  titleEn: string | null;
  isFallback: boolean;
  sortOrder: number;
  pages: LibraryPage[];
}

export type LibraryModule = ModuleWithPages;

export interface ModuleRow {
  id: string;
  titleDe: string;
  titleEn: string | null;
  sortOrder: number;
}

/** A delete blocked by a foreign key: RESTRICT reports 23001, NO ACTION / inserts report 23503. */
export function isForeignKeyError(e: unknown): boolean {
  const code = pgErrorCode(e);
  return code === PG_ERROR.foreignKeyViolation || code === W1_CONTENT_CONFIG.restrictViolationCode;
}

const moduleOrder = [asc(modules.sortOrder), asc(modules.createdAt), asc(modules.id)];
export const pageOrder = [asc(pages.sortOrder), asc(pages.createdAt), asc(pages.id)];

/**
 * Library tree as the actor may see it (visibility only through `visibility.ts`). Admins also see
 * archived pages and empty modules and may filter by status; everybody else gets published pages
 * of modules that have any. `status` is ignored for non-admins.
 */
export async function loadModulesWithPages(
  actor: Actor,
  status?: PageStatusValue,
): Promise<ModuleWithPages[]> {
  const isAdmin = actor.role === "admin";
  const wantsEnglish = actor.locale === "en";
  const moduleRows = await db
    .select()
    .from(modules)
    .orderBy(...moduleOrder);
  const pageRows = await db
    .select({
      id: pages.id,
      moduleId: pages.moduleId,
      titleDe: pages.titleDe,
      titleEn: pages.titleEn,
      status: pages.status,
      sortOrder: pages.sortOrder,
      contentUpdatedAt: pages.contentUpdatedAt,
      lastEditedByName: users.name,
    })
    .from(pages)
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .where(
      and(
        visiblePagesCondition(actor, { includeArchived: true }),
        isAdmin && status ? eq(pages.status, status) : undefined,
      ),
    )
    .orderBy(...pageOrder);

  const byModule = new Map<string, LibraryPage[]>();
  for (const row of pageRows) {
    const hasEnglish = row.titleEn !== null;
    const item: LibraryPage = {
      ...row,
      title: wantsEnglish && row.titleEn !== null ? row.titleEn : row.titleDe,
      isFallback: wantsEnglish && !hasEnglish,
      hasEnglish,
    };
    const list = byModule.get(row.moduleId);
    if (list) list.push(item);
    else byModule.set(row.moduleId, [item]);
  }
  return moduleRows
    .filter((row) => isAdmin || byModule.has(row.id))
    .map((row) => ({
      id: row.id,
      title: wantsEnglish && row.titleEn !== null ? row.titleEn : row.titleDe,
      titleDe: row.titleDe,
      titleEn: row.titleEn,
      isFallback: wantsEnglish && row.titleEn === null,
      sortOrder: row.sortOrder,
      pages: byModule.get(row.id) ?? [],
    }));
}

export async function listModules(actor: Actor): Promise<ModuleWithPages[]> {
  assertPermission(actor, "library.read");
  return loadModulesWithPages(actor);
}

function toRow(row: typeof modules.$inferSelect): ModuleRow {
  return { id: row.id, titleDe: row.titleDe, titleEn: row.titleEn, sortOrder: row.sortOrder };
}

export async function createModule(actor: Actor, input: CreateModuleInput): Promise<ModuleRow> {
  assertPermission(actor, "content.manage");
  const data = createModuleSchema.parse(input);
  return db.transaction(async (tx) => {
    // New modules get max(sort_order)+1; the advisory lock serialises concurrent creators.
    await tx.execute(sql`select pg_advisory_xact_lock(${W1_CONTENT_CONFIG.moduleSortLockKey})`);
    const [max] = await tx
      .select({ value: sql<number>`coalesce(max(${modules.sortOrder}), -1)` })
      .from(modules);
    const [row] = await tx
      .insert(modules)
      .values({ ...data, sortOrder: (max?.value ?? -1) + 1 })
      .returning();
    if (!row) throw new AppError("INTERNAL");
    return toRow(row);
  });
}

export async function updateModule(actor: Actor, input: UpdateModuleInput): Promise<ModuleRow> {
  assertPermission(actor, "content.manage");
  const { id, ...data } = updateModuleSchema.parse(input);
  const [row] = await db.update(modules).set(data).where(eq(modules.id, id)).returning();
  if (!row) throw new AppError("NOT_FOUND");
  return toRow(row);
}

/**
 * Swaps `id` with its neighbour inside `rows` (current display order) and renumbers the list to
 * 0..n-1, writing only rows whose sort_order changes. Renumbering instead of swapping two values
 * also repairs equal sort_order values. The caller holds the locks on all `rows`.
 */
export async function moveWithinOrder(
  tx: Tx,
  table: typeof modules | typeof pages,
  rows: { id: string; sortOrder: number }[],
  id: string,
  direction: Direction,
): Promise<void> {
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) throw new AppError("NOT_FOUND");
  const ordered = [...rows];
  const target = direction === "up" ? index - 1 : index + 1;
  const [moved, neighbour] = [ordered[index], ordered[target]];
  if (moved && neighbour) {
    ordered[index] = neighbour;
    ordered[target] = moved;
  }
  for (const [position, row] of ordered.entries()) {
    if (row.sortOrder === position) continue;
    await tx.update(table).set({ sortOrder: position }).where(eq(table.id, row.id));
  }
}

export async function moveModule(
  actor: Actor,
  input: { id: string; direction: Direction },
): Promise<void> {
  assertPermission(actor, "content.manage");
  const { id, direction } = moveSchema.parse(input);
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: modules.id, sortOrder: modules.sortOrder })
      .from(modules)
      .orderBy(...moduleOrder)
      .for("update");
    await moveWithinOrder(tx, modules, rows, id, direction);
  });
}

/** A module can only be deleted when it has no pages in any status. */
export async function deleteModule(actor: Actor, input: { id: string }): Promise<void> {
  assertPermission(actor, "content.manage");
  const { id } = idInputSchema.parse(input);
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ id: modules.id })
        .from(modules)
        .where(eq(modules.id, id))
        .for("update");
      if (!row) throw new AppError("NOT_FOUND");
      const [pageCount] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(pages)
        .where(eq(pages.moduleId, id));
      if ((pageCount?.value ?? 0) > 0) {
        throw new AppError("IN_USE", {
          reasonKey: "library.errors.moduleHasPages",
          pageCount: pageCount?.value,
        });
      }
      await tx.delete(modules).where(eq(modules.id, id));
    });
  } catch (e) {
    if (isForeignKeyError(e)) {
      throw new AppError("IN_USE", { reasonKey: "library.errors.moduleHasPages" });
    }
    throw e;
  }
}
