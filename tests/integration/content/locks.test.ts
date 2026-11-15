import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { pageEditLocks } from "@/server/db/schema";
import {
  acquireLock,
  assertLockHeldInTx,
  getLockState,
  heartbeat,
  releaseLock,
  takeOverLock,
} from "@/server/services/locks";
import { createEmployee, createLead, createLock, createPage } from "../../factories";
import { actorOf, expireLock, minutesAgo, testDb } from "../../helpers";
import { adminActor } from "./fixtures";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function lockRow(pageId: string) {
  const [row] = await testDb.select().from(pageEditLocks).where(eq(pageEditLocks.pageId, pageId));
  return row;
}

describe("acquireLock", () => {
  it("fails with NOT_FOUND for a missing page", async () => {
    const { actor } = await adminActor();
    await expect(acquireLock(actor, { pageId: UNKNOWN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("acquires a free page and reports the state", async () => {
    const { actor, user } = await adminActor();
    const page = await createPage();
    const state = await acquireLock(actor, { pageId: page.id });
    expect(state.isMine).toBe(true);
    expect(state.holder).toEqual({ id: user.id, name: user.name });
    expect(state.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 100_000);
  });

  it("is refused with LOCK_HELD { holderName, since } while another admin holds it", async () => {
    const owner = await adminActor({ firstName: "Anna", lastName: "Admin", name: "Anna Admin" });
    const other = await adminActor();
    const page = await createPage();
    await acquireLock(owner.actor, { pageId: page.id });
    const error = await acquireLock(other.actor, { pageId: page.id }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "LOCK_HELD", details: { holderName: "Anna Admin" } });
    expect((error as { details: { since: Date } }).details.since).toBeInstanceOf(Date);
    expect((await lockRow(page.id))!.userId).toBe(owner.user.id);
  });

  it("treats an expired lock as free", async () => {
    const owner = await adminActor();
    const other = await adminActor();
    const page = await createPage();
    await acquireLock(owner.actor, { pageId: page.id });
    await expireLock(page.id);
    const state = await acquireLock(other.actor, { pageId: page.id });
    expect(state.holder?.id).toBe(other.user.id);
    expect((await lockRow(page.id))!.userId).toBe(other.user.id);
  });

  it("keeps acquired_at when the holder acquires again", async () => {
    const { actor, user } = await adminActor();
    const page = await createPage();
    const earlier = minutesAgo(10);
    await createLock({ pageId: page.id, userId: user.id, acquiredAt: earlier });
    await acquireLock(actor, { pageId: page.id });
    expect((await lockRow(page.id))!.acquiredAt.getTime()).toBe(earlier.getTime());
  });

  it("lets exactly one of two concurrent admins win", async () => {
    const a = await adminActor();
    const b = await adminActor();
    const page = await createPage();
    const results = await Promise.allSettled([
      acquireLock(a.actor, { pageId: page.id }),
      acquireLock(b.actor, { pageId: page.id }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "LOCK_HELD" });
  });

  it("is admin only", async () => {
    const page = await createPage();
    for (const user of [await createEmployee(), await createLead()]) {
      await expect(acquireLock(actorOf(user), { pageId: page.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });
});

describe("heartbeat", () => {
  it("extends the lease of the holder", async () => {
    const { actor, user } = await adminActor();
    const page = await createPage();
    await createLock({ pageId: page.id, userId: user.id, expiresAt: new Date(Date.now() + 5_000) });
    const result = await heartbeat(actor, { pageId: page.id });
    expect(result.held).toBe(true);
    if (result.held) expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now() + 100_000);
  });

  it("renews an own lock that expired while nobody took it over", async () => {
    const { actor, user } = await adminActor();
    const page = await createPage();
    await createLock({
      pageId: page.id,
      userId: user.id,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const result = await heartbeat(actor, { pageId: page.id });
    expect(result.held).toBe(true);
    expect((await lockRow(page.id))!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("re-acquires when the lock row is gone", async () => {
    const { actor, user } = await adminActor();
    const page = await createPage();
    const result = await heartbeat(actor, { pageId: page.id });
    expect(result.held).toBe(true);
    expect((await lockRow(page.id))!.userId).toBe(user.id);
  });

  it("reports held:false with the holder when somebody else holds the lock", async () => {
    const owner = await adminActor({ name: "Berta Boss", firstName: "Berta", lastName: "Boss" });
    const me = await adminActor();
    const page = await createPage();
    await acquireLock(owner.actor, { pageId: page.id });
    const result = await heartbeat(me.actor, { pageId: page.id });
    expect(result).toMatchObject({ held: false, holderName: "Berta Boss" });
    expect((await lockRow(page.id))!.userId).toBe(owner.user.id);
  });

  it("takes over a lock of somebody else once it expired", async () => {
    const owner = await adminActor();
    const me = await adminActor();
    const page = await createPage();
    await acquireLock(owner.actor, { pageId: page.id });
    await expireLock(page.id);
    expect((await heartbeat(me.actor, { pageId: page.id })).held).toBe(true);
    expect((await lockRow(page.id))!.userId).toBe(me.user.id);
  });

  it("reports held:false without holder when the page is gone", async () => {
    const { actor } = await adminActor();
    expect(await heartbeat(actor, { pageId: UNKNOWN_ID })).toEqual({
      held: false,
      holderName: null,
      since: null,
    });
  });
});

describe("releaseLock, takeOverLock, getLockState", () => {
  it("releases only the own lock", async () => {
    const owner = await adminActor();
    const other = await adminActor();
    const page = await createPage();
    await acquireLock(owner.actor, { pageId: page.id });
    await releaseLock(other.actor, { pageId: page.id });
    expect(await lockRow(page.id)).toBeDefined();
    await releaseLock(owner.actor, { pageId: page.id });
    expect(await lockRow(page.id)).toBeUndefined();
  });

  it("takeover writes the lock to the actor and resets acquired_at", async () => {
    const owner = await adminActor();
    const me = await adminActor();
    const page = await createPage();
    await createLock({ pageId: page.id, userId: owner.user.id, acquiredAt: minutesAgo(30) });
    const state = await takeOverLock(me.actor, { pageId: page.id });
    expect(state.isMine).toBe(true);
    const row = (await lockRow(page.id))!;
    expect(row.userId).toBe(me.user.id);
    expect(Date.now() - row.acquiredAt.getTime()).toBeLessThan(60_000);
    // the previous holder now learns about it through their heartbeat
    expect(await heartbeat(owner.actor, { pageId: page.id })).toMatchObject({
      held: false,
      holderName: me.user.name,
    });
  });

  it("takeover of a missing page is NOT_FOUND", async () => {
    const { actor } = await adminActor();
    await expect(takeOverLock(actor, { pageId: UNKNOWN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getLockState shows no holder for a free or expired lock", async () => {
    const { actor, user } = await adminActor();
    const page = await createPage();
    expect(await getLockState(actor, { pageId: page.id })).toEqual({
      holder: null,
      since: null,
      expiresAt: null,
      isMine: false,
    });
    await createLock({ pageId: page.id, userId: user.id, expiresAt: new Date(Date.now() - 1_000) });
    expect((await getLockState(actor, { pageId: page.id })).holder).toBeNull();
  });
});

describe("assertLockHeldInTx", () => {
  it("passes for a live own lock and throws LOCK_LOST otherwise", async () => {
    const owner = await adminActor();
    const other = await adminActor();
    const page = await createPage();
    const check = (userId: string) =>
      testDb.transaction((tx) => assertLockHeldInTx(tx, { pageId: page.id, userId }));

    await expect(check(owner.user.id)).rejects.toMatchObject({ code: "LOCK_LOST" });
    await acquireLock(owner.actor, { pageId: page.id });
    await expect(check(owner.user.id)).resolves.toBeUndefined();
    await expect(check(other.user.id)).rejects.toMatchObject({ code: "LOCK_LOST" });
    await testDb.execute(
      sql`update page_edit_locks set expires_at = now() - interval '1 second' where page_id = ${page.id}`,
    );
    await expect(check(owner.user.id)).rejects.toMatchObject({ code: "LOCK_LOST" });
  });
});
