import "server-only";
import { aliasedTable, and, count, desc, eq, exists, gte, lt, sql, type SQL } from "drizzle-orm";
import { V_FB_CONFIG } from "@/config/app";
import {
  createReportSchema,
  listReportsSchema,
  reportIdSchema,
  updateReportSchema,
  type CreateReportInput,
  type ListReportsInput,
  type UpdateReportInput,
} from "@/lib/validation/feedback";
import { idSchema } from "@/lib/validation/common";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { db, type DbExecutor } from "@/server/db/client";
import { feedbackReports, modules, pages, users } from "@/server/db/schema";
import type { FeedbackReport } from "@/server/db/types";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { editorDepartmentIdInTx, type EditorDepartment } from "./content-access";
import { createNotificationInTx } from "./notifications-core";
import { canViewPageInTx } from "./visibility";

export interface ReportDto {
  id: string;
  type: FeedbackReport["type"];
  subject: string;
  message: string;
  path: string | null;
  pageId: string | null;
  status: FeedbackReport["status"];
  response: string | null;
  /** Null when the reporter was deleted ("gelöschter Benutzer"). */
  reporter: { id: string; name: string } | null;
  handledByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

const PAGE_PATH = /^\/pages\/([^/?#]+)\/?(?:[?#].*)?$/;

/** The page id of a `/pages/<uuid>` path, or null for every other path. */
function pageIdFromPath(path: string | null): string | null {
  const candidate = path === null ? undefined : PAGE_PATH.exec(path)?.[1];
  const parsed = idSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Which reports an editor scope covers: admin all; lead only `content_issue` reports whose page is
 * in a module of their department (joined at read time, so a department change re-routes them).
 * `null` (lead without team) covers nothing.
 */
function scopeCondition(editor: EditorDepartment): SQL {
  if (editor === "all") return sql`true`;
  if (editor === null) return sql`false`;
  return and(
    eq(feedbackReports.type, "content_issue"),
    exists(
      db
        .select({ one: sql`1` })
        .from(pages)
        .innerJoin(modules, eq(modules.id, pages.moduleId))
        .where(and(eq(pages.id, feedbackReports.pageId), eq(modules.departmentId, editor))),
    ),
  ) as SQL;
}

const reporter = aliasedTable(users, "reporter");
const handler = aliasedTable(users, "handler");

const selection = {
  report: feedbackReports,
  reporterId: reporter.id,
  reporterFirstName: reporter.firstName,
  reporterLastName: reporter.lastName,
  handlerFirstName: handler.firstName,
  handlerLastName: handler.lastName,
};

function toDto(row: {
  report: FeedbackReport;
  reporterId: string | null;
  reporterFirstName: string | null;
  reporterLastName: string | null;
  handlerFirstName: string | null;
  handlerLastName: string | null;
}): ReportDto {
  const { report } = row;
  return {
    id: report.id,
    type: report.type,
    subject: report.subject,
    message: report.message,
    path: report.path,
    pageId: report.pageId,
    status: report.status,
    response: report.response,
    reporter:
      row.reporterId === null
        ? null
        : { id: row.reporterId, name: `${row.reporterFirstName} ${row.reporterLastName}` },
    handledByName:
      row.handlerFirstName === null ? null : `${row.handlerFirstName} ${row.handlerLastName}`,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    resolvedAt: report.resolvedAt,
  };
}

async function loadDtoInTx(tx: DbExecutor, id: string): Promise<ReportDto> {
  const [row] = await tx
    .select(selection)
    .from(feedbackReports)
    .leftJoin(reporter, eq(reporter.id, feedbackReports.reporterId))
    .leftJoin(handler, eq(handler.id, feedbackReports.handledBy))
    .where(eq(feedbackReports.id, id));
  if (!row) throw new AppError("NOT_FOUND");
  return toDto(row);
}

/**
 * Any signed-in role. The page is derived from `path` (`/pages/<uuid>`) only when the reporter may
 * view it; at most `maxReportsPerHour` reports per reporter in a rolling hour (`RATE_LIMITED`).
 */
export async function createReport(actor: Actor, input: CreateReportInput): Promise<ReportDto> {
  assertPermission(actor, "feedback.create");
  const data = createReportSchema.parse(input);
  const candidatePageId = pageIdFromPath(data.path);
  return db.transaction(async (tx) => {
    // Serialises one reporter's submissions so concurrent requests cannot exceed the limit.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${V_FB_CONFIG.rateLimitLockNamespace}:${actor.id}`}, 0))`,
    );
    const [recent] = await tx
      .select({ value: count() })
      .from(feedbackReports)
      .where(
        and(
          eq(feedbackReports.reporterId, actor.id),
          gte(
            feedbackReports.createdAt,
            sql`now() - make_interval(mins => ${V_FB_CONFIG.rateLimitWindowMinutes})`,
          ),
        ),
      );
    if ((recent?.value ?? 0) >= V_FB_CONFIG.maxReportsPerHour) throw new AppError("RATE_LIMITED");

    const pageId =
      candidatePageId !== null && (await canViewPageInTx(tx, actor, candidatePageId))
        ? candidatePageId
        : null;
    const [row] = await tx
      .insert(feedbackReports)
      .values({ ...data, reporterId: actor.id, pageId })
      .returning({ id: feedbackReports.id });
    if (!row) throw new AppError("INTERNAL");
    logger.info(
      { action: "createReport", reportId: row.id, actorId: actor.id, type: data.type },
      "report created",
    );
    return loadDtoInTx(tx, row.id);
  });
}

/** Admin: all reports; team lead: content reports of their department. Purges expired reports first. */
export async function listReports(
  actor: Actor,
  input: ListReportsInput = {},
): Promise<ReportDto[]> {
  assertPermission(actor, "feedback.manage");
  const filter = listReportsSchema.parse(input);
  return db.transaction(async (tx) => {
    await tx
      .delete(feedbackReports)
      .where(
        and(
          eq(feedbackReports.status, "done"),
          lt(
            feedbackReports.resolvedAt,
            sql`now() - make_interval(days => ${V_FB_CONFIG.retentionDays})`,
          ),
        ),
      );
    const editor = await editorDepartmentIdInTx(tx, actor);
    const rows = await tx
      .select(selection)
      .from(feedbackReports)
      .leftJoin(reporter, eq(reporter.id, feedbackReports.reporterId))
      .leftJoin(handler, eq(handler.id, feedbackReports.handledBy))
      .where(
        and(
          scopeCondition(editor),
          filter.status ? eq(feedbackReports.status, filter.status) : undefined,
          filter.type ? eq(feedbackReports.type, filter.type) : undefined,
        ),
      )
      .orderBy(desc(feedbackReports.createdAt), desc(feedbackReports.id));
    return rows.map(toDto);
  });
}

/** Open reports within the actor's scope (navigation badge). */
export async function countOpenReports(actor: Actor): Promise<number> {
  assertPermission(actor, "feedback.manage");
  const editor = await editorDepartmentIdInTx(db, actor);
  const [row] = await db
    .select({ value: count() })
    .from(feedbackReports)
    .where(and(eq(feedbackReports.status, "open"), scopeCondition(editor)));
  return row?.value ?? 0;
}

/**
 * Sets status and response note; the handler is recorded. `resolved_at` is set when moving into
 * `done` and cleared when leaving it. Every transition into `done` notifies the reporter (when
 * they still exist and are not archived). Out-of-scope ids are `NOT_FOUND`.
 */
export async function updateReport(actor: Actor, input: UpdateReportInput): Promise<ReportDto> {
  assertPermission(actor, "feedback.manage");
  const { id, status, response } = updateReportSchema.parse(input);
  return db.transaction(async (tx) => {
    const editor = await editorDepartmentIdInTx(tx, actor);
    const [current] = await tx
      .select()
      .from(feedbackReports)
      .where(and(eq(feedbackReports.id, id), scopeCondition(editor)))
      .for("update");
    if (!current) throw new AppError("NOT_FOUND");

    const intoDone = status === "done" && current.status !== "done";
    await tx
      .update(feedbackReports)
      .set({
        status,
        response,
        handledBy: actor.id,
        resolvedAt: status !== "done" ? null : intoDone ? new Date() : current.resolvedAt,
      })
      .where(eq(feedbackReports.id, id));

    if (intoDone && current.reporterId !== null) {
      const [recipient] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, current.reporterId), sql`${users.onboardingStatus} <> 'archived'`));
      if (recipient) {
        await createNotificationInTx(tx, {
          userId: recipient.id,
          type: "feedback_resolved",
          reportId: id,
          path: current.path,
          params: { subject: current.subject, response },
        });
      }
    }
    logger.info(
      { action: "updateReport", reportId: id, actorId: actor.id, status },
      "report updated",
    );
    return loadDtoInTx(tx, id);
  });
}

/** Admin only. */
export async function deleteReport(actor: Actor, input: { id: string }): Promise<void> {
  assertPermission(actor, "feedback.manage");
  if (actor.role !== "admin") throw new AppError("FORBIDDEN");
  const { id } = reportIdSchema.parse(input);
  const deleted = await db
    .delete(feedbackReports)
    .where(eq(feedbackReports.id, id))
    .returning({ id: feedbackReports.id });
  if (deleted.length === 0) throw new AppError("NOT_FOUND");
  logger.info({ action: "deleteReport", reportId: id, actorId: actor.id }, "report deleted");
}
