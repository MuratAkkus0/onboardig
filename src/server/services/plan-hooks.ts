import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { computeProgress, type Progress } from "@/lib/domain/progress";
import { applyOnboardingEvent, type OnboardingStatus } from "@/lib/domain/onboarding-status";
import type { PageStatus } from "@/lib/domain/page-status";
import type { DbExecutor, Tx } from "@/server/db/client";
import { pageCompletions, pages, userPlanSteps, users } from "@/server/db/schema";
import { lockUsersInTx } from "./row-locks";
import { createNotificationsInTx, onboardingCompletedRecipientsInTx } from "./notifications-core";

/*
 * The only coupling between content/org and plans: content and org services call these hooks inside
 * their own transaction and never import the plan services. Hooks run in the caller's transaction,
 * send no mail and use no Next APIs. Lock order (blueprint 4.2): page row(s) first (held by the
 * caller), then user rows in ascending id.
 */

export interface UserProgress extends Progress {
  lastActivityAt: Date | null;
}

/**
 * Internal: progress per user. Only steps whose page is `published` count (draft and archived
 * pages are excluded); last activity is the latest completion of the user. Every requested user
 * gets an entry.
 */
export async function loadProgressForUsersInTx(
  executor: DbExecutor,
  userIds: readonly string[],
): Promise<Map<string, UserProgress>> {
  const result = new Map<string, UserProgress>();
  if (userIds.length === 0) return result;
  const ids = [...userIds];

  const [counts, activity] = await Promise.all([
    executor
      .select({
        userId: userPlanSteps.userId,
        total: sql<number>`(count(*) filter (where ${pages.status} = 'published'))::int`,
        completed: sql<number>`(count(${pageCompletions.pageId}) filter (where ${pages.status} = 'published'))::int`,
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
      .where(inArray(userPlanSteps.userId, ids))
      .groupBy(userPlanSteps.userId),
    executor
      .select({
        userId: pageCompletions.userId,
        lastActivityAt: sql<Date | null>`max(${pageCompletions.completedAt})`.mapWith(
          pageCompletions.completedAt,
        ),
      })
      .from(pageCompletions)
      .where(inArray(pageCompletions.userId, ids))
      .groupBy(pageCompletions.userId),
  ]);

  const countsByUser = new Map(counts.map((row) => [row.userId, row]));
  const activityByUser = new Map(activity.map((row) => [row.userId, row.lastActivityAt]));
  for (const userId of ids) {
    const row = countsByUser.get(userId);
    result.set(userId, {
      ...computeProgress(row?.completed ?? 0, row?.total ?? 0),
      lastActivityAt: activityByUser.get(userId) ?? null,
    });
  }
  return result;
}

/**
 * Internal: recomputes one user's onboarding status and returns the result. The caller must
 * already hold the user lock. On a transition to `completed` (and `notify !== false`) the lead and
 * all admins, minus the user, get `onboarding_completed`.
 */
export async function applyRecomputeInTx(
  tx: Tx,
  input: { userId: string; notify?: boolean },
): Promise<{ status: OnboardingStatus; progress: UserProgress } | null> {
  const [user] = await tx
    .select({
      status: users.onboardingStatus,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!user) return null;

  const progress = (await loadProgressForUsersInTx(tx, [input.userId])).get(input.userId);
  if (!progress) return null;

  const transition = applyOnboardingEvent(user.status, {
    type: "progress",
    completed: progress.completed,
    total: progress.total,
  });
  if (!transition.changed) return { status: user.status, progress };

  await tx
    .update(users)
    .set({
      onboardingStatus: transition.status,
      onboardingCompletedAt: transition.status === "completed" ? new Date() : null,
    })
    .where(eq(users.id, input.userId));

  if (transition.becameCompleted && input.notify !== false) {
    const recipients = await onboardingCompletedRecipientsInTx(tx, input.userId);
    await createNotificationsInTx(
      tx,
      recipients.map((userId) => ({
        userId,
        type: "onboarding_completed" as const,
        subjectUserId: input.userId,
        params: { employeeName: `${user.firstName} ${user.lastName}` },
      })),
    );
  }
  return { status: transition.status, progress };
}

/** Recomputes one user's onboarding status. The caller must already hold the user lock. */
export async function recomputeOnboardingStatusInTx(
  tx: Tx,
  input: { userId: string; notify?: boolean },
): Promise<void> {
  await applyRecomputeInTx(tx, input);
}

/** Non-archived (active or completed) users whose plan contains the page, ascending id. */
async function listPlanHolderIdsInTx(tx: Tx, pageId: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ id: users.id })
    .from(userPlanSteps)
    .innerJoin(users, eq(users.id, userPlanSteps.userId))
    .where(and(eq(userPlanSteps.pageId, pageId), ne(users.onboardingStatus, "archived")))
    .orderBy(users.id);
  return rows.map((row) => row.id);
}

/**
 * Locks the page's plan holders (ascending id) and returns the ones that, after the lock, still
 * hold the page in an active or completed onboarding.
 */
async function lockPlanHoldersInTx(tx: Tx, pageId: string): Promise<string[]> {
  const candidates = await listPlanHolderIdsInTx(tx, pageId);
  if (candidates.length === 0) return [];
  await lockUsersInTx(tx, candidates);
  return listPlanHolderIdsInTx(tx, pageId);
}

async function notifyPageUpdatedInTx(tx: Tx, pageId: string, recipientIds: string[]) {
  if (recipientIds.length === 0) return;
  const [page] = await tx
    .select({ titleDe: pages.titleDe, titleEn: pages.titleEn })
    .from(pages)
    .where(eq(pages.id, pageId));
  if (!page) return;
  await createNotificationsInTx(
    tx,
    recipientIds.map((userId) => ({
      userId,
      type: "page_updated" as const,
      pageId,
      params: { titleDe: page.titleDe, titleEn: page.titleEn },
    })),
  );
}

/**
 * A published page's content changed: every active/completed plan holder except the editor gets
 * `page_updated` (deduped while unread, K§6).
 */
export async function onPublishedPageContentChanged(
  tx: Tx,
  input: { pageId: string; actorId: string },
): Promise<void> {
  const holders = await lockPlanHoldersInTx(tx, input.pageId);
  await notifyPageUpdatedInTx(
    tx,
    input.pageId,
    holders.filter((userId) => userId !== input.actorId),
  );
}

/**
 * A page changed status: the active-step set of every plan containing it changed, so each holder
 * is recomputed under their lock. On draft -> published the holders also get `page_updated`
 * (re-publish after draft edits), except the actor.
 */
export async function onPageStatusChanged(
  tx: Tx,
  input: { pageId: string; from: PageStatus; to: PageStatus; actorId: string },
): Promise<void> {
  const holders = await lockPlanHoldersInTx(tx, input.pageId);
  for (const userId of holders) {
    await recomputeOnboardingStatusInTx(tx, { userId });
  }
  if (input.from === "draft" && input.to === "published") {
    await notifyPageUpdatedInTx(
      tx,
      input.pageId,
      holders.filter((userId) => userId !== input.actorId),
    );
  }
}
