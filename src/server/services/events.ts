import "server-only";
import { asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { W1_NOTIFY_EVENTS_CONFIG } from "@/config/app";
import { hasEnglishEvent } from "@/lib/domain/locale-content";
import {
  eventIdSchema,
  eventInputSchema,
  type EventInput,
  type UpdateEventInput,
} from "@/lib/validation/events";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { events } from "@/server/db/schema";
import type { AppEvent } from "@/server/db/types";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { createNotificationsInTx, listActiveUserIdsInTx } from "./notifications-core";

export interface EventDto {
  id: string;
  /** Title in the viewer's language (German when there is no English variant). */
  title: string;
  description: string;
  /** True when the viewer reads English but only German exists ("Nur auf Deutsch verfügbar"). */
  isFallback: boolean;
  titleDe: string;
  titleEn: string | null;
  descriptionDe: string;
  descriptionEn: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  lastAnnouncedAt: Date | null;
}

function toDto(row: AppEvent, actor: Actor): EventDto {
  const english = actor.locale === "en" && hasEnglishEvent(row);
  return {
    id: row.id,
    title: english && row.titleEn ? row.titleEn : row.titleDe,
    description: english && row.descriptionEn ? row.descriptionEn : row.descriptionDe,
    isFallback: actor.locale === "en" && !hasEnglishEvent(row),
    titleDe: row.titleDe,
    titleEn: row.titleEn,
    descriptionDe: row.descriptionDe,
    descriptionEn: row.descriptionEn,
    location: row.location,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    lastAnnouncedAt: row.lastAnnouncedAt,
  };
}

/** All roles: upcoming (ends_at >= now, soonest first) and past (latest first, capped). */
export async function listEvents(
  actor: Actor,
): Promise<{ upcoming: EventDto[]; past: EventDto[] }> {
  assertPermission(actor, "events.view");
  const [upcoming, past] = await Promise.all([
    db
      .select()
      .from(events)
      .where(gte(events.endsAt, sql`now()`))
      .orderBy(asc(events.startsAt), asc(events.id)),
    db
      .select()
      .from(events)
      .where(lt(events.endsAt, sql`now()`))
      .orderBy(desc(events.startsAt), desc(events.id))
      .limit(W1_NOTIFY_EVENTS_CONFIG.events.pastLimit),
  ]);
  return {
    upcoming: upcoming.map((row) => toDto(row, actor)),
    past: past.map((row) => toDto(row, actor)),
  };
}

export async function getEvent(actor: Actor, input: { id: string }): Promise<EventDto> {
  assertPermission(actor, "events.view");
  const { id } = eventIdSchema.parse(input);
  const [row] = await db.select().from(events).where(eq(events.id, id));
  if (!row) throw new AppError("NOT_FOUND");
  return toDto(row, actor);
}

export async function createEvent(actor: Actor, input: EventInput): Promise<EventDto> {
  assertPermission(actor, "events.manage");
  const data = eventInputSchema.parse(input);
  const [row] = await db
    .insert(events)
    .values({ ...data, createdBy: actor.id, updatedBy: actor.id })
    .returning();
  if (!row) throw new AppError("INTERNAL");
  logger.info({ action: "createEvent", eventId: row.id, actorId: actor.id }, "event created");
  return toDto(row, actor);
}

export async function updateEvent(actor: Actor, input: UpdateEventInput): Promise<EventDto> {
  assertPermission(actor, "events.manage");
  const { id } = eventIdSchema.parse({ id: input.id });
  const data = eventInputSchema.parse(input);
  const [row] = await db
    .update(events)
    .set({ ...data, updatedBy: actor.id, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  if (!row) throw new AppError("NOT_FOUND");
  logger.info({ action: "updateEvent", eventId: id, actorId: actor.id }, "event updated");
  return toDto(row, actor);
}

/** Deleting keeps earlier announcements: their `event_id` becomes null ("Veranstaltung entfernt"). */
export async function deleteEvent(actor: Actor, input: { id: string }): Promise<void> {
  assertPermission(actor, "events.manage");
  const { id } = eventIdSchema.parse(input);
  const deleted = await db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
  if (deleted.length === 0) throw new AppError("NOT_FOUND");
  logger.info({ action: "deleteEvent", eventId: id, actorId: actor.id }, "event deleted");
}

/**
 * Notifies every non-archived user (including the actor). While a user's earlier announcement of
 * this event is still unread it is refreshed instead of duplicated (dedupe `event_announced:<id>`).
 * May be repeated.
 */
export async function announceEvent(
  actor: Actor,
  input: { id: string },
): Promise<{ recipients: number }> {
  assertPermission(actor, "events.manage");
  const { id } = eventIdSchema.parse(input);
  const recipients = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(events).where(eq(events.id, id)).for("update");
    if (!row) throw new AppError("NOT_FOUND");
    const userIds = await listActiveUserIdsInTx(tx);
    await createNotificationsInTx(
      tx,
      userIds.map((userId) => ({
        userId,
        type: "event_announced" as const,
        eventId: row.id,
        params: {
          titleDe: row.titleDe,
          titleEn: row.titleEn,
          startsAt: row.startsAt.toISOString(),
        },
      })),
    );
    await tx
      .update(events)
      .set({ lastAnnouncedAt: sql`now()` })
      .where(eq(events.id, id));
    return userIds.length;
  });
  logger.info(
    { action: "announceEvent", eventId: id, actorId: actor.id, recipients },
    "event announced",
  );
  return { recipients };
}
