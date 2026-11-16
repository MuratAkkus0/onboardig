import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { ROUTES } from "@/config/app";
import { safeNextPath } from "@/lib/navigation";
import type { Tx } from "@/server/db/client";
import { notifications, users } from "@/server/db/schema";
import type { NewNotification } from "@/server/db/types";

export type NotificationInput =
  | { userId: string; type: "step_added"; params?: Record<string, never> }
  | {
      userId: string;
      type: "page_updated";
      pageId: string;
      params: { titleDe: string; titleEn: string | null };
    }
  | {
      userId: string;
      type: "event_announced";
      eventId: string;
      params: { titleDe: string; titleEn: string | null; startsAt: string };
    }
  | {
      userId: string;
      type: "employee_assigned";
      subjectUserId: string;
      params: { employeeName: string };
    }
  | {
      userId: string;
      type: "onboarding_completed";
      subjectUserId: string;
      params: { employeeName: string };
    }
  | {
      userId: string;
      type: "feedback_resolved";
      reportId: string;
      /** In-app path the report was filed from; becomes the notification link when safe. */
      path?: string | null;
      params: { subject: string; response: string | null };
    };

/** Derives message key, link and dedupe key from the type; callers cannot pass free text. */
function toRow(input: NotificationInput): NewNotification & { dedupeKey: string } {
  switch (input.type) {
    case "step_added":
      return {
        userId: input.userId,
        type: input.type,
        messageKey: "notificationItems.stepAdded",
        params: {},
        link: ROUTES.plan,
        dedupeKey: "plan_steps_added",
      };
    case "page_updated":
      return {
        userId: input.userId,
        type: input.type,
        messageKey: "notificationItems.pageUpdated",
        params: input.params,
        link: ROUTES.page(input.pageId),
        pageId: input.pageId,
        dedupeKey: `page_updated:${input.pageId}`,
      };
    case "event_announced":
      return {
        userId: input.userId,
        type: input.type,
        messageKey: "notificationItems.eventAnnounced",
        params: input.params,
        link: `${ROUTES.events}#event-${input.eventId}`,
        eventId: input.eventId,
        dedupeKey: `event_announced:${input.eventId}`,
      };
    case "employee_assigned":
      return {
        userId: input.userId,
        type: input.type,
        messageKey: "notificationItems.employeeAssigned",
        params: input.params,
        link: ROUTES.teamMember(input.subjectUserId),
        subjectUserId: input.subjectUserId,
        dedupeKey: `employee_assigned:${input.subjectUserId}`,
      };
    case "onboarding_completed":
      return {
        userId: input.userId,
        type: input.type,
        messageKey: "notificationItems.onboardingCompleted",
        params: input.params,
        link: ROUTES.teamMember(input.subjectUserId),
        subjectUserId: input.subjectUserId,
        dedupeKey: `onboarding_completed:${input.subjectUserId}`,
      };
    case "feedback_resolved":
      return {
        userId: input.userId,
        type: input.type,
        messageKey: input.params.response
          ? "notificationItems.feedbackResolvedWithResponse"
          : "notificationItems.feedbackResolved",
        params: input.params,
        link: safeNextPath(input.path),
        dedupeKey: `feedback_resolved:${input.reportId}`,
      };
  }
}

/**
 * One `INSERT ... ON CONFLICT DO UPDATE` for all inputs. Inputs are de-duplicated by
 * `userId|dedupeKey` first (last one wins), because Postgres aborts the whole statement when two
 * rows of one INSERT hit the same conflict key, which would roll back the caller's transaction.
 */
async function insertNotifications(
  tx: Tx,
  inputs: readonly NotificationInput[],
): Promise<{ id: string; inserted: boolean }[]> {
  const unique = new Map<string, NewNotification>();
  for (const input of inputs) {
    const row = toRow(input);
    unique.set(`${row.userId}|${row.dedupeKey}`, row);
  }
  if (unique.size === 0) return [];

  return tx
    .insert(notifications)
    .values([...unique.values()])
    .onConflictDoUpdate({
      target: [notifications.userId, notifications.dedupeKey],
      targetWhere: sql`${notifications.readAt} IS NULL AND ${notifications.dedupeKey} IS NOT NULL`,
      set: {
        occurredAt: sql`now()`,
        params: sql.raw("excluded.params"),
        link: sql.raw("excluded.link"),
      },
    })
    .returning({ id: notifications.id, inserted: sql<boolean>`(xmax = 0)` });
}

/**
 * Internal (trusted caller, no auth check). An unread notification with the same dedupe key is
 * refreshed (`occurred_at`, params, link) instead of duplicated; once read, the next occurrence
 * creates a new row.
 */
export async function createNotificationInTx(
  tx: Tx,
  input: NotificationInput,
): Promise<{ id: string; deduped: boolean }> {
  const [row] = await insertNotifications(tx, [input]);
  if (!row) throw new Error("notification insert returned no row");
  return { id: row.id, deduped: !row.inserted };
}

/** Internal: bulk variant of `createNotificationInTx`. */
export async function createNotificationsInTx(
  tx: Tx,
  inputs: readonly NotificationInput[],
): Promise<{ created: number; deduped: number }> {
  const rows = await insertNotifications(tx, inputs);
  const created = rows.filter((row) => row.inserted).length;
  return { created, deduped: rows.length - created };
}

/** Internal: ids of all non-archived admins. */
export async function listActiveAdminIdsInTx(tx: Tx): Promise<string[]> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), ne(users.onboardingStatus, "archived")));
  return rows.map((row) => row.id);
}

/** Internal: ids of all non-archived users. */
export async function listActiveUserIdsInTx(tx: Tx): Promise<string[]> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(ne(users.onboardingStatus, "archived"));
  return rows.map((row) => row.id);
}

async function activeLeadIdInTx(tx: Tx, leadId: string | null): Promise<string | null> {
  if (!leadId) return null;
  const [lead] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, leadId), ne(users.onboardingStatus, "archived")));
  return lead?.id ?? null;
}

/** Internal: (lead if set and not archived) ∪ non-archived admins, minus the subject. */
export async function onboardingCompletedRecipientsInTx(
  tx: Tx,
  subjectUserId: string,
): Promise<string[]> {
  const [subject] = await tx
    .select({ leadId: users.leadId })
    .from(users)
    .where(eq(users.id, subjectUserId));
  const recipients = new Set(await listActiveAdminIdsInTx(tx));
  const leadId = await activeLeadIdInTx(tx, subject?.leadId ?? null);
  if (leadId) recipients.add(leadId);
  recipients.delete(subjectUserId);
  return [...recipients];
}

/** Internal: the lead if set, not archived and not the actor (nobody is notified of their own action). */
export async function employeeAssignedRecipientInTx(
  tx: Tx,
  input: { leadId: string | null; actorId: string },
): Promise<string | null> {
  if (input.leadId === input.actorId) return null;
  return activeLeadIdInTx(tx, input.leadId);
}
