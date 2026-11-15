import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { APP_CONFIG, ROUTES } from "@/config/app";
import { events, notifications, pages } from "@/server/db/schema";
import {
  getUnreadSummary,
  listNotifications,
  markAllRead,
  markRead,
} from "@/server/services/notifications";
import { createEmployee, createEvent, createNotification, createPage } from "../../factories";
import { actorOf, testDb } from "../../helpers";
import { announceEvent, deleteEvent } from "@/server/services/events";
import { createAdmin } from "../../factories";

describe("own-rows-only", () => {
  it("lists, counts and marks only the actor's notifications", async () => {
    const me = await createEmployee();
    const other = await createEmployee();
    const mine = await createNotification({ userId: me.id });
    const theirs = await createNotification({ userId: other.id });

    const list = await listNotifications(actorOf(me));
    expect(list.items.map((i) => i.id)).toEqual([mine.id]);
    expect((await getUnreadSummary(actorOf(me))).unreadCount).toBe(1);

    await expect(markRead(actorOf(me), { id: theirs.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await markAllRead(actorOf(me));

    const [stillUnread] = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.id, theirs.id));
    expect(stillUnread?.readAt).toBeNull();
    expect((await getUnreadSummary(actorOf(me))).unreadCount).toBe(0);
    expect((await getUnreadSummary(actorOf(other))).unreadCount).toBe(1);
  });

  it("markRead is idempotent", async () => {
    const me = await createEmployee();
    const n = await createNotification({ userId: me.id });
    await markRead(actorOf(me), { id: n.id });
    await expect(markRead(actorOf(me), { id: n.id })).resolves.toBeUndefined();
  });

  it("limits the bell preview", async () => {
    const me = await createEmployee();
    for (let i = 0; i < APP_CONFIG.notifications.bellPreviewLimit + 3; i += 1) {
      await createNotification({ userId: me.id });
    }
    const summary = await getUnreadSummary(actorOf(me));
    expect(summary.unreadCount).toBe(APP_CONFIG.notifications.bellPreviewLimit + 3);
    expect(summary.latest).toHaveLength(APP_CONFIG.notifications.bellPreviewLimit);
  });
});

describe("keyset pagination", () => {
  it("neither skips nor duplicates rows with equal occurred_at", async () => {
    const me = await createEmployee();
    const at = new Date(Date.now() - 60_000);
    const created: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      created.push((await createNotification({ userId: me.id, occurredAt: at })).id);
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await listNotifications(actorOf(me), {
        limit: 3,
        ...(cursor ? { cursor } : {}),
      });
      seen.push(...page.items.map((i) => i.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    expect([...seen].sort()).toEqual([...created].sort());
  });
});

describe("retention", () => {
  it("purges own rows older than the retention period on read, not others'", async () => {
    const me = await createEmployee();
    const other = await createEmployee();
    const old = new Date(Date.now() - (APP_CONFIG.notifications.retentionDays + 1) * 86_400_000);
    await createNotification({ userId: me.id, occurredAt: old });
    const fresh = await createNotification({ userId: me.id });
    await createNotification({ userId: other.id, occurredAt: old });

    expect((await listNotifications(actorOf(me))).items.map((i) => i.id)).toEqual([fresh.id]);
    const [{ count } = { count: 0 }] = await testDb
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(eq(notifications.userId, other.id));
    expect(count).toBe(1);

    await getUnreadSummary(actorOf(other));
    const left = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, other.id));
    expect(left).toHaveLength(0);
  });
});

describe("deleted event", () => {
  it("renders 'removed' with the plain events link", async () => {
    const admin = await createAdmin();
    const user = await createEmployee();
    const event = await createEvent();
    await announceEvent(actorOf(admin), { id: event.id });

    const before = await listNotifications(actorOf(user));
    expect(before.items[0]).toMatchObject({
      messageKey: "notificationItems.eventAnnounced",
      link: `${ROUTES.events}#event-${event.id}`,
    });

    await deleteEvent(actorOf(admin), { id: event.id });
    expect(await testDb.select().from(events).where(eq(events.id, event.id))).toHaveLength(0);

    const after = await listNotifications(actorOf(user));
    expect(after.items).toHaveLength(1);
    expect(after.items[0]).toMatchObject({
      type: "event_announced",
      messageKey: "notificationItems.eventRemoved",
      link: ROUTES.events,
    });
  });
});

describe("deleted page", () => {
  it("renders 'page removed' with the plan link instead of a dead page link", async () => {
    const user = await createEmployee();
    const page = await createPage();
    await createNotification({
      userId: user.id,
      type: "page_updated",
      messageKey: "notificationItems.pageUpdated",
      params: { title: "Alt" },
      link: ROUTES.page(page.id),
      pageId: page.id,
    });
    const before = await listNotifications(actorOf(user));
    expect(before.items[0]).toMatchObject({
      messageKey: "notificationItems.pageUpdated",
      link: ROUTES.page(page.id),
    });

    await testDb.delete(pages).where(eq(pages.id, page.id));
    const after = await listNotifications(actorOf(user));
    expect(after.items[0]).toMatchObject({
      messageKey: "notificationItems.pageRemoved",
      link: ROUTES.plan,
    });
  });
});
