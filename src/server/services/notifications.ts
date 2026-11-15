import "server-only";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { APP_CONFIG, F2A_CONFIG, ROUTES } from "@/config/app";
import { idSchema } from "@/lib/validation/common";
import type { Actor } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import type { Notification } from "@/server/db/types";

export interface NotificationDto {
  id: string;
  type: Notification["type"];
  messageKey: string;
  params: Notification["params"];
  link: string | null;
  subjectUserId: string | null;
  read: boolean;
  occurredAt: Date;
}

export interface NotificationPage {
  items: NotificationDto[];
  nextCursor: string | null;
}

// Postgres timestamptz text with microseconds ("2026-11-15 22:12:01.123456+00"). The cursor keeps
// the exact text so rows with equal or sub-millisecond timestamps are neither skipped nor repeated.
const CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/;
const cursorSchema = z
  .string()
  .transform((value) => value.split("|"))
  .pipe(z.tuple([z.string().regex(CURSOR_TIMESTAMP), idSchema]));
const listInput = z.object({
  cursor: cursorSchema.optional(),
  limit: z.number().int().min(1).max(F2A_CONFIG.notifications.maxPageSize).optional(),
});

const columns = {
  id: notifications.id,
  type: notifications.type,
  messageKey: notifications.messageKey,
  params: notifications.params,
  link: notifications.link,
  eventId: notifications.eventId,
  subjectUserId: notifications.subjectUserId,
  readAt: notifications.readAt,
  occurredAt: notifications.occurredAt,
  occurredAtText: sql<string>`${notifications.occurredAt}::text`,
};

type Row = Pick<
  Notification,
  | "id"
  | "type"
  | "messageKey"
  | "params"
  | "link"
  | "eventId"
  | "subjectUserId"
  | "readAt"
  | "occurredAt"
> & { occurredAtText: string };

function toDto(row: Row): NotificationDto {
  // An announcement whose event was deleted shows "event removed" and links to the plain list.
  const eventRemoved = row.type === "event_announced" && row.eventId === null;
  return {
    id: row.id,
    type: row.type,
    messageKey: eventRemoved ? "notificationItems.eventRemoved" : row.messageKey,
    params: row.params,
    link: eventRemoved ? ROUTES.events : row.link,
    subjectUserId: row.subjectUserId,
    read: row.readAt !== null,
    occurredAt: row.occurredAt,
  };
}

/** Lazy retention (no cron): the actor's own rows older than the retention period are deleted. */
async function purgeExpired(userId: string): Promise<void> {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        lt(
          notifications.occurredAt,
          sql`now() - make_interval(days => ${APP_CONFIG.notifications.retentionDays})`,
        ),
      ),
    );
}

/** Own notifications, newest first, keyset-paginated by `(occurred_at, id)`. */
export async function listNotifications(
  actor: Actor,
  input: { cursor?: string; limit?: number } = {},
): Promise<NotificationPage> {
  const parsed = listInput.parse(input);
  const limit = parsed.limit ?? APP_CONFIG.notifications.pageSize;
  await purgeExpired(actor.id);

  const after = parsed.cursor
    ? sql`(${notifications.occurredAt}, ${notifications.id}) < (${parsed.cursor[0]}::timestamptz, ${parsed.cursor[1]}::uuid)`
    : undefined;
  const rows = await db
    .select(columns)
    .from(notifications)
    .where(and(eq(notifications.userId, actor.id), after))
    .orderBy(desc(notifications.occurredAt), desc(notifications.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(toDto),
    nextCursor: rows.length > limit && last ? `${last.occurredAtText}|${last.id}` : null,
  };
}

/** Bell and poll endpoint: unread count plus the latest notifications for the dropdown. */
export async function getUnreadSummary(
  actor: Actor,
): Promise<{ unreadCount: number; latest: NotificationDto[] }> {
  await purgeExpired(actor.id);
  const [counted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
  const latest = await db
    .select(columns)
    .from(notifications)
    .where(eq(notifications.userId, actor.id))
    .orderBy(desc(notifications.occurredAt), desc(notifications.id))
    .limit(APP_CONFIG.notifications.bellPreviewLimit);
  return { unreadCount: counted?.count ?? 0, latest: latest.map(toDto) };
}

/** Marks one of the actor's own notifications as read (idempotent). Others' rows are NOT_FOUND. */
export async function markRead(actor: Actor, input: { id: string }): Promise<void> {
  const { id } = z.object({ id: idSchema }).parse(input);
  const own = and(eq(notifications.id, id), eq(notifications.userId, actor.id));
  const updated = await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(own, isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  if (updated.length > 0) return;
  const [existing] = await db.select({ id: notifications.id }).from(notifications).where(own);
  if (!existing) throw new AppError("NOT_FOUND");
}

/** Marks all of the actor's unread notifications as read. */
export async function markAllRead(actor: Actor): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
}
