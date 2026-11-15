import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { APP_CONFIG } from "@/config/app";
import { pageIdInputSchema } from "@/lib/validation/content";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { db, type DbExecutor, type Tx } from "@/server/db/client";
import { pageEditLocks, pages, users } from "@/server/db/schema";
import { AppError, pgErrorCode, PG_ERROR } from "@/server/errors";

/** K§4 lease lock of a page. `holder` is null when the lock is free or expired. */
export interface LockState {
  holder: { id: string; name: string } | null;
  since: Date | null;
  expiresAt: Date | null;
  isMine: boolean;
}

export type HeartbeatResult =
  { held: true; expiresAt: Date } | { held: false; holderName: string | null; since: Date | null };

const leaseSeconds = APP_CONFIG.locks.leaseDurationSeconds;
const newExpiry = sql`now() + make_interval(secs => ${leaseSeconds})`;

/** Current (unexpired) holder of a page lock, read with the database clock. */
async function readLockInTx(
  executor: DbExecutor,
  pageId: string,
  viewerId: string,
): Promise<LockState> {
  const [row] = await executor
    .select({
      userId: pageEditLocks.userId,
      name: users.name,
      acquiredAt: pageEditLocks.acquiredAt,
      expiresAt: pageEditLocks.expiresAt,
    })
    .from(pageEditLocks)
    .innerJoin(users, eq(users.id, pageEditLocks.userId))
    .where(and(eq(pageEditLocks.pageId, pageId), gt(pageEditLocks.expiresAt, sql`now()`)));
  if (!row) return { holder: null, since: null, expiresAt: null, isMine: false };
  return {
    holder: { id: row.userId, name: row.name },
    since: row.acquiredAt,
    expiresAt: row.expiresAt,
    isMine: row.userId === viewerId,
  };
}

/** Internal (trusted caller, no auth check): lock state as seen by `viewerId`. */
export function getLockStateInTx(
  executor: DbExecutor,
  input: { pageId: string; viewerId: string },
): Promise<LockState> {
  return readLockInTx(executor, input.pageId, input.viewerId);
}

/** The single atomic acquire statement. Returns false when someone else holds a live lock. */
async function tryAcquire(pageId: string, userId: string): Promise<boolean> {
  const rows = await db
    .insert(pageEditLocks)
    .values({ pageId, userId, acquiredAt: sql`now()`, expiresAt: newExpiry })
    .onConflictDoUpdate({
      target: pageEditLocks.pageId,
      set: {
        userId: sql`excluded.user_id`,
        acquiredAt: sql`case when ${pageEditLocks.userId} = excluded.user_id then ${pageEditLocks.acquiredAt} else now() end`,
        expiresAt: sql`excluded.expires_at`,
      },
      setWhere: sql`${pageEditLocks.expiresAt} < now() or ${pageEditLocks.userId} = excluded.user_id`,
    })
    .returning({ pageId: pageEditLocks.pageId });
  return rows.length > 0;
}

async function assertPageExists(pageId: string): Promise<void> {
  const [page] = await db.select({ id: pages.id }).from(pages).where(eq(pages.id, pageId));
  if (!page) throw new AppError("NOT_FOUND");
}

/** Acquire (or renew) the edit lock. Throws LOCK_HELD { holderName, since } when someone else holds it. */
export async function acquireLock(actor: Actor, input: { pageId: string }): Promise<LockState> {
  assertPermission(actor, "content.manage");
  const { pageId } = pageIdInputSchema.parse(input);
  await assertPageExists(pageId);
  let acquired = await tryAcquire(pageId, actor.id);
  if (!acquired) {
    let state = await readLockInTx(db, pageId, actor.id);
    if (!state.holder) {
      // The holder released between our upsert and the read: retry once.
      acquired = await tryAcquire(pageId, actor.id);
      if (!acquired) state = await readLockInTx(db, pageId, actor.id);
    }
    if (!acquired) {
      throw new AppError("LOCK_HELD", {
        holderName: state.holder?.name ?? null,
        since: state.since,
      });
    }
  }
  return readLockInTx(db, pageId, actor.id);
}

/**
 * Extends the lease. Only an own row is renewed (even when it already expired, as long as nobody
 * took it over). A missing row means the lock was taken over, released or the page is gone: the
 * heartbeat never creates a lease, so a stale editor cannot silently get its lock back and
 * overwrite a newer save (K§4). `held: false` carries the current holder, if any.
 */
export async function heartbeat(actor: Actor, input: { pageId: string }): Promise<HeartbeatResult> {
  assertPermission(actor, "content.manage");
  const { pageId } = pageIdInputSchema.parse(input);
  const [renewed] = await db
    .update(pageEditLocks)
    .set({ expiresAt: newExpiry })
    .where(and(eq(pageEditLocks.pageId, pageId), eq(pageEditLocks.userId, actor.id)))
    .returning({ expiresAt: pageEditLocks.expiresAt });
  if (renewed) return { held: true, expiresAt: renewed.expiresAt };
  const state = await readLockInTx(db, pageId, actor.id);
  return { held: false, holderName: state.holder?.name ?? null, since: state.since };
}

/** Deletes the actor's own lock row (never someone else's). */
export async function releaseLock(actor: Actor, input: { pageId: string }): Promise<void> {
  assertPermission(actor, "content.manage");
  const { pageId } = pageIdInputSchema.parse(input);
  await db
    .delete(pageEditLocks)
    .where(and(eq(pageEditLocks.pageId, pageId), eq(pageEditLocks.userId, actor.id)));
}

/** Unconditionally writes the lock to the actor ("Bearbeitung take over"; the UI confirms first). */
export async function takeOverLock(actor: Actor, input: { pageId: string }): Promise<LockState> {
  assertPermission(actor, "content.manage");
  const { pageId } = pageIdInputSchema.parse(input);
  await assertPageExists(pageId);
  try {
    await db
      .insert(pageEditLocks)
      .values({ pageId, userId: actor.id, acquiredAt: sql`now()`, expiresAt: newExpiry })
      .onConflictDoUpdate({
        target: pageEditLocks.pageId,
        set: {
          userId: sql`excluded.user_id`,
          acquiredAt: sql`now()`,
          expiresAt: sql`excluded.expires_at`,
        },
      });
  } catch (e) {
    if (pgErrorCode(e) === PG_ERROR.foreignKeyViolation) throw new AppError("NOT_FOUND");
    throw e;
  }
  return readLockInTx(db, pageId, actor.id);
}

export async function getLockState(actor: Actor, input: { pageId: string }): Promise<LockState> {
  assertPermission(actor, "content.manage");
  const { pageId } = pageIdInputSchema.parse(input);
  await assertPageExists(pageId);
  return readLockInTx(db, pageId, actor.id);
}

/**
 * Internal (trusted caller, no auth check): the lock row must be mine and unexpired, else
 * LOCK_LOST. Takes the row `FOR UPDATE`, so a concurrent takeover waits until the save commits.
 * The save path never re-acquires a lost lock (K§4).
 */
export async function assertLockHeldInTx(
  tx: Tx,
  input: { pageId: string; userId: string },
): Promise<void> {
  const [row] = await tx
    .select({ pageId: pageEditLocks.pageId })
    .from(pageEditLocks)
    .where(
      and(
        eq(pageEditLocks.pageId, input.pageId),
        eq(pageEditLocks.userId, input.userId),
        gt(pageEditLocks.expiresAt, sql`now()`),
      ),
    )
    .for("update");
  if (!row) {
    // Name the new holder (if any) so the previous editor can say who took over.
    const state = await readLockInTx(tx, input.pageId, input.userId);
    throw new AppError("LOCK_LOST", {
      holderName: state.holder?.name ?? null,
      since: state.since,
    });
  }
}
