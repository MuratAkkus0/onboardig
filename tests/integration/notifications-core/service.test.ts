import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { APP_CONFIG, ROUTES } from "@/config/app";
import { events, notifications } from "@/server/db/schema";
import {
  getUnreadSummary,
  listNotifications,
  markAllRead,
  markRead,
} from "@/server/services/notifications";
import { createNotificationInTx } from "@/server/services/notifications-core";
import { createEmployee, createEvent, createNotification, createUser } from "../../factories";
import { actorOf, testDb } from "../../helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("notifications service", () => {
  it("lists only own notifications, newest first, with unread count", async () => {
    const me = await createEmployee();
    const other = await createUser();
    const older = await createNotification({
      userId: me.id,
      occurredAt: new Date(Date.now() - 2000),
    });
    const newer = await createNotification({
      userId: me.id,
      occurredAt: new Date(Date.now() - 1000),
    });
    await createNotification({ userId: other.id });

    const page = await listNotifications(actorOf(me));
    expect(page.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(page.nextCursor).toBeNull();
    const summary = await getUnreadSummary(actorOf(me));
    expect(summary.unreadCount).toBe(2);
    expect(summary.latest).toHaveLength(2);
  });

  it("paginates by keyset without skipping rows that share a timestamp", async () => {
    const me = await createEmployee();
    const at = new Date();
    const created = [];
    for (let i = 0; i < 5; i += 1) {
      created.push(await createNotification({ userId: me.id, occurredAt: at }));
    }
    // sub-millisecond differences must survive the cursor round trip
    await testDb.execute(
      sql`update notifications set occurred_at = occurred_at + (random() * 900) * interval '1 microsecond' where user_id = ${me.id}`,
    );

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await listNotifications(actorOf(me), { limit: 2, cursor });
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(created.map((row) => row.id)));
  });

  it("rejects malformed cursors and limits", async () => {
    const me = await createEmployee();
    await expect(listNotifications(actorOf(me), { cursor: "garbage" })).rejects.toThrow();
    await expect(listNotifications(actorOf(me), { limit: 0 })).rejects.toThrow();
  });

  it("purges own rows older than the retention period when reading", async () => {
    const me = await createEmployee();
    const other = await createUser();
    const old = new Date(Date.now() - (APP_CONFIG.notifications.retentionDays + 1) * DAY_MS);
    const fresh = await createNotification({ userId: me.id });
    await createNotification({ userId: me.id, occurredAt: old });
    const othersOld = await createNotification({ userId: other.id, occurredAt: old });

    const page = await listNotifications(actorOf(me));
    expect(page.items.map((item) => item.id)).toEqual([fresh.id]);
    expect(
      await testDb.select().from(notifications).where(eq(notifications.userId, me.id)),
    ).toHaveLength(1);
    // rows of other users are only purged when they read
    expect(
      await testDb.select().from(notifications).where(eq(notifications.id, othersOld.id)),
    ).toHaveLength(1);

    await createNotification({ userId: me.id, occurredAt: old });
    await getUnreadSummary(actorOf(me));
    expect(
      await testDb.select().from(notifications).where(eq(notifications.userId, me.id)),
    ).toHaveLength(1);
  });

  it("marks own notifications read, idempotently, and hides others' rows", async () => {
    const me = await createEmployee();
    const other = await createUser();
    const mine = await createNotification({ userId: me.id });
    const theirs = await createNotification({ userId: other.id });

    await markRead(actorOf(me), { id: mine.id });
    await markRead(actorOf(me), { id: mine.id });
    await expect(markRead(actorOf(me), { id: theirs.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await getUnreadSummary(actorOf(me))).unreadCount).toBe(0);
    expect((await getUnreadSummary(actorOf(other))).unreadCount).toBe(1);
  });

  it("marks all own notifications read without touching others", async () => {
    const me = await createEmployee();
    const other = await createUser();
    await createNotification({ userId: me.id, dedupeKey: "a" });
    await createNotification({ userId: me.id, dedupeKey: "b" });
    await createNotification({ userId: other.id });

    await markAllRead(actorOf(me));
    expect((await getUnreadSummary(actorOf(me))).unreadCount).toBe(0);
    expect((await getUnreadSummary(actorOf(other))).unreadCount).toBe(1);
  });

  it("renders an announcement of a deleted event as removed, linking to the plain list", async () => {
    const me = await createEmployee();
    const event = await createEvent();
    await testDb.transaction((tx) =>
      createNotificationInTx(tx, {
        userId: me.id,
        type: "event_announced",
        eventId: event.id,
        params: { titleDe: "Fest", titleEn: null, startsAt: "2026-12-01T10:00:00.000Z" },
      }),
    );
    const [before] = (await listNotifications(actorOf(me))).items;
    expect(before).toMatchObject({
      messageKey: "notificationItems.eventAnnounced",
      link: `${ROUTES.events}#event-${event.id}`,
    });

    await testDb.delete(events).where(eq(events.id, event.id));
    const [after] = (await listNotifications(actorOf(me))).items;
    expect(after).toMatchObject({
      messageKey: "notificationItems.eventRemoved",
      link: ROUTES.events,
    });
  });
});
