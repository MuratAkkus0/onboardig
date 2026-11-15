import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { events, notifications, users } from "@/server/db/schema";
import {
  announceEvent,
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from "@/server/services/events";
import { listNotifications, markAllRead } from "@/server/services/notifications";
import {
  createAdmin,
  createEmployee,
  createEvent as makeEvent,
  createLead,
  createUser,
} from "../../factories";
import { actorOf, minutesAgo, minutesFromNow, testDb } from "../../helpers";

const input = {
  titleDe: "Sommerfest",
  descriptionDe: "Grillen im Hof",
  startsAt: minutesFromNow(60),
  endsAt: minutesFromNow(180),
};

async function unreadFor(userId: string) {
  return testDb.select().from(notifications).where(eq(notifications.userId, userId));
}

describe("authorization", () => {
  it("lets only admins create, update, delete and announce", async () => {
    const event = await makeEvent();
    for (const user of [await createEmployee(), await createLead()]) {
      const actor = actorOf(user);
      await expect(createEvent(actor, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(updateEvent(actor, { ...input, id: event.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(deleteEvent(actor, { id: event.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(announceEvent(actor, { id: event.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    expect(await testDb.select().from(events)).toHaveLength(1);
  });

  it("lets every role list and read events", async () => {
    const event = await makeEvent();
    for (const user of [await createEmployee(), await createLead(), await createAdmin()]) {
      expect((await listEvents(actorOf(user))).upcoming).toHaveLength(1);
      expect((await getEvent(actorOf(user), { id: event.id })).id).toBe(event.id);
    }
  });
});

describe("CRUD", () => {
  it("creates, updates and deletes; unknown ids are NOT_FOUND", async () => {
    const admin = actorOf(await createAdmin());
    const created = await createEvent(admin, { ...input, location: "Hof" });
    expect(created).toMatchObject({ titleDe: "Sommerfest", location: "Hof", titleEn: null });

    const updated = await updateEvent(admin, { ...input, id: created.id, titleDe: "Herbstfest" });
    expect(updated.titleDe).toBe("Herbstfest");

    await deleteEvent(admin, { id: created.id });
    await expect(getEvent(admin, { id: created.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteEvent(admin, { id: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(updateEvent(admin, { ...input, id: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("enforces English both-or-none in zod and in the database", async () => {
    const admin = actorOf(await createAdmin());
    await expect(createEvent(admin, { ...input, titleEn: "Summer party" })).rejects.toThrow();
    await expect(createEvent(admin, { ...input, descriptionEn: "BBQ" })).rejects.toThrow();
    await expect(createEvent(admin, { ...input, endsAt: minutesAgo(10) })).rejects.toThrow();
    await expect(
      testDb.insert(events).values({ ...input, titleEn: "Only title" }),
    ).rejects.toThrow();
  });
});

describe("listEvents", () => {
  it("splits upcoming (ends_at >= now) and past, ordered", async () => {
    const user = actorOf(await createEmployee());
    const soon = await makeEvent({ startsAt: minutesFromNow(30), endsAt: minutesFromNow(90) });
    const later = await makeEvent({ startsAt: minutesFromNow(600), endsAt: minutesFromNow(660) });
    const running = await makeEvent({ startsAt: minutesAgo(30), endsAt: minutesFromNow(30) });
    const ended = await makeEvent({ startsAt: minutesAgo(200), endsAt: minutesAgo(100) });
    const older = await makeEvent({ startsAt: minutesAgo(900), endsAt: minutesAgo(800) });

    const { upcoming, past } = await listEvents(user);
    expect(upcoming.map((e) => e.id)).toEqual([running.id, soon.id, later.id]);
    expect(past.map((e) => e.id)).toEqual([ended.id, older.id]);
  });

  it("resolves title and description by viewer locale with German fallback", async () => {
    const bilingual = await makeEvent({
      titleDe: "Fest",
      descriptionDe: "Beschreibung",
      titleEn: "Party",
      descriptionEn: "Description",
    });
    const germanOnly = await makeEvent({ titleDe: "Nur deutsch", startsAt: minutesFromNow(5000) });
    const en = actorOf(await createEmployee({ locale: "en" }));
    const de = actorOf(await createEmployee({ locale: "de" }));

    const enList = (await listEvents(en)).upcoming;
    expect(enList.find((e) => e.id === bilingual.id)).toMatchObject({
      title: "Party",
      description: "Description",
      isFallback: false,
    });
    expect(enList.find((e) => e.id === germanOnly.id)).toMatchObject({
      title: "Nur deutsch",
      isFallback: true,
    });
    const deList = (await listEvents(de)).upcoming;
    expect(deList.find((e) => e.id === bilingual.id)).toMatchObject({
      title: "Fest",
      isFallback: false,
    });
    expect(deList.find((e) => e.id === germanOnly.id)?.isFallback).toBe(false);
  });
});

describe("announceEvent", () => {
  it("reaches every non-archived user including the actor and sets last_announced_at", async () => {
    const adminUser = await createAdmin();
    const employee = await createEmployee();
    const lead = await createLead();
    const archived = await createUser({ onboardingStatus: "archived" });
    const event = await makeEvent({ titleDe: "Fest", titleEn: "Party", descriptionEn: "Fun" });

    const result = await announceEvent(actorOf(adminUser), { id: event.id });
    // createEmployee also creates that employee's lead, so count the non-archived users directly.
    const active = (await testDb.select({ id: users.id }).from(users)).length - 1;
    expect(result.recipients).toBe(active);
    expect(await testDb.select().from(notifications)).toHaveLength(active);
    for (const user of [adminUser, employee, lead]) {
      expect(await unreadFor(user.id)).toHaveLength(1);
    }
    expect(await unreadFor(archived.id)).toHaveLength(0);

    const [row] = await testDb.select().from(events).where(eq(events.id, event.id));
    expect(row?.lastAnnouncedAt).toBeInstanceOf(Date);

    const item = (await listNotifications(actorOf(employee))).items[0];
    expect(item).toMatchObject({
      type: "event_announced",
      messageKey: "notificationItems.eventAnnounced",
    });
    expect(item?.params).toMatchObject({ titleDe: "Fest", titleEn: "Party" });
  });

  it("dedupes while unread and creates a new row after read", async () => {
    const admin = await createAdmin();
    const employee = await createEmployee();
    const event = await makeEvent();

    await announceEvent(actorOf(admin), { id: event.id });
    const [first] = await unreadFor(employee.id);
    await announceEvent(actorOf(admin), { id: event.id });
    const afterRepeat = await unreadFor(employee.id);
    expect(afterRepeat).toHaveLength(1);
    expect(afterRepeat[0]?.occurredAt.getTime()).toBeGreaterThanOrEqual(
      first!.occurredAt.getTime(),
    );

    await markAllRead(actorOf(employee));
    await announceEvent(actorOf(admin), { id: event.id });
    expect(await unreadFor(employee.id)).toHaveLength(2);
  });

  it("refreshes the params of an unread announcement after the event was edited", async () => {
    const admin = actorOf(await createAdmin());
    const employee = await createEmployee();
    const event = await makeEvent({ titleDe: "Alt" });
    await announceEvent(admin, { id: event.id });
    await updateEvent(admin, {
      id: event.id,
      titleDe: "Neu",
      descriptionDe: "x",
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    });
    await announceEvent(admin, { id: event.id });
    const rows = await unreadFor(employee.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.params).toMatchObject({ titleDe: "Neu" });
  });

  it("answers NOT_FOUND for an unknown event", async () => {
    const admin = actorOf(await createAdmin());
    await expect(
      announceEvent(admin, { id: "0b1f6a3e-3c1d-4f7e-9d3b-6f0f6d6f2a11" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
