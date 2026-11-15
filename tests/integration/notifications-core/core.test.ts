import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/app";
import { events, notifications, users } from "@/server/db/schema";
import {
  createNotificationInTx,
  createNotificationsInTx,
  employeeAssignedRecipientInTx,
  listActiveAdminIdsInTx,
  listActiveUserIdsInTx,
  onboardingCompletedRecipientsInTx,
  type NotificationInput,
} from "@/server/services/notifications-core";
import {
  createAdmin,
  createEmployee,
  createEvent,
  createLead,
  createPage,
  createUser,
} from "../../factories";
import { testDb } from "../../helpers";

const run = <T>(fn: (tx: Parameters<Parameters<typeof testDb.transaction>[0]>[0]) => Promise<T>) =>
  testDb.transaction(fn);

async function rows(userId: string) {
  return testDb.select().from(notifications).where(eq(notifications.userId, userId));
}

describe("createNotificationInTx", () => {
  it("derives message key, link and dedupe key from the type", async () => {
    const user = await createUser();
    const subject = await createUser();
    const page = await createPage();
    const event = await createEvent();
    const inputs: NotificationInput[] = [
      { userId: user.id, type: "step_added" },
      {
        userId: user.id,
        type: "page_updated",
        pageId: page.id,
        params: { titleDe: "Titel", titleEn: null },
      },
      {
        userId: user.id,
        type: "event_announced",
        eventId: event.id,
        params: { titleDe: "Fest", titleEn: "Party", startsAt: "2026-12-01T10:00:00.000Z" },
      },
      {
        userId: user.id,
        type: "employee_assigned",
        subjectUserId: subject.id,
        params: { employeeName: "Ada" },
      },
      {
        userId: user.id,
        type: "onboarding_completed",
        subjectUserId: subject.id,
        params: { employeeName: "Ada" },
      },
    ];
    for (const input of inputs) await run((tx) => createNotificationInTx(tx, input));

    const byType = Object.fromEntries((await rows(user.id)).map((row) => [row.type, row]));
    expect(byType.step_added).toMatchObject({
      messageKey: "notificationItems.stepAdded",
      link: ROUTES.plan,
      dedupeKey: "plan_steps_added",
    });
    expect(byType.page_updated).toMatchObject({
      messageKey: "notificationItems.pageUpdated",
      link: ROUTES.page(page.id),
      pageId: page.id,
      dedupeKey: `page_updated:${page.id}`,
    });
    expect(byType.event_announced).toMatchObject({
      messageKey: "notificationItems.eventAnnounced",
      link: `${ROUTES.events}#event-${event.id}`,
      eventId: event.id,
      dedupeKey: `event_announced:${event.id}`,
    });
    expect(byType.employee_assigned).toMatchObject({
      messageKey: "notificationItems.employeeAssigned",
      link: ROUTES.teamMember(subject.id),
      subjectUserId: subject.id,
      dedupeKey: `employee_assigned:${subject.id}`,
    });
    expect(byType.onboarding_completed).toMatchObject({
      messageKey: "notificationItems.onboardingCompleted",
      dedupeKey: `onboarding_completed:${subject.id}`,
    });
  });

  it("refreshes an unread notification instead of creating a duplicate", async () => {
    const user = await createUser();
    const page = await createPage();
    const input = (titleDe: string): NotificationInput => ({
      userId: user.id,
      type: "page_updated",
      pageId: page.id,
      params: { titleDe, titleEn: null },
    });

    const first = await run((tx) => createNotificationInTx(tx, input("Alt")));
    expect(first.deduped).toBe(false);
    const [before] = await rows(user.id);
    await testDb.execute(sql`select pg_sleep(0.02)`);

    const second = await run((tx) => createNotificationInTx(tx, input("Neu")));
    expect(second).toEqual({ id: first.id, deduped: true });
    const after = await rows(user.id);
    expect(after).toHaveLength(1);
    expect(after[0]?.params).toEqual({ titleDe: "Neu", titleEn: null });
    expect(after[0]?.createdAt).toEqual(before?.createdAt);
    expect(after[0]?.occurredAt.getTime()).toBeGreaterThan(before?.occurredAt.getTime() ?? 0);
  });

  it("creates a new row once the previous one was read", async () => {
    const user = await createUser();
    const input: NotificationInput = { userId: user.id, type: "step_added" };
    const first = await run((tx) => createNotificationInTx(tx, input));
    await testDb
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, first.id));

    const second = await run((tx) => createNotificationInTx(tx, input));
    expect(second.deduped).toBe(false);
    expect(second.id).not.toBe(first.id);
    expect(await rows(user.id)).toHaveLength(2);
  });

  it("does not dedupe across users", async () => {
    const [a, b] = [await createUser(), await createUser()];
    await run((tx) => createNotificationInTx(tx, { userId: a.id, type: "step_added" }));
    const second = await run((tx) =>
      createNotificationInTx(tx, { userId: b.id, type: "step_added" }),
    );
    expect(second.deduped).toBe(false);
  });
});

describe("createNotificationsInTx", () => {
  it("inserts in bulk and reports created vs deduped", async () => {
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];
    await run((tx) => createNotificationInTx(tx, { userId: a.id, type: "step_added" }));

    const result = await run((tx) =>
      createNotificationsInTx(
        tx,
        [a, b, c].map((user) => ({ userId: user.id, type: "step_added" as const })),
      ),
    );
    expect(result).toEqual({ created: 2, deduped: 1 });
    expect(await rows(a.id)).toHaveLength(1);
  });

  it("collapses duplicate (userId, dedupeKey) inputs of one call without error, last one wins", async () => {
    const user = await createUser();
    const subject = await createUser();
    const result = await run((tx) =>
      createNotificationsInTx(tx, [
        {
          userId: user.id,
          type: "employee_assigned",
          subjectUserId: subject.id,
          params: { employeeName: "Erst" },
        },
        {
          userId: user.id,
          type: "employee_assigned",
          subjectUserId: subject.id,
          params: { employeeName: "Zuletzt" },
        },
      ]),
    );
    expect(result).toEqual({ created: 1, deduped: 0 });
    const stored = await rows(user.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.params).toEqual({ employeeName: "Zuletzt" });
  });

  it("handles an empty input list", async () => {
    expect(await run((tx) => createNotificationsInTx(tx, []))).toEqual({ created: 0, deduped: 0 });
  });
});

describe("recipient helpers", () => {
  it("lists only non-archived admins and users", async () => {
    const admin = await createAdmin();
    await createAdmin({ onboardingStatus: "archived" });
    const employee = await createEmployee();
    const archived = await createUser({ onboardingStatus: "archived" });

    expect(await run((tx) => listActiveAdminIdsInTx(tx))).toEqual([admin.id]);
    const active = await run((tx) => listActiveUserIdsInTx(tx));
    expect(active).toContain(employee.id);
    expect(active).not.toContain(archived.id);
  });

  it("onboardingCompletedRecipientsInTx returns lead and admins once, minus the subject", async () => {
    const admin = await createAdmin();
    const lead = await createLead();
    const subject = await createEmployee({ leadId: lead.id });

    const recipients = await run((tx) => onboardingCompletedRecipientsInTx(tx, subject.id));
    expect([...recipients].sort()).toEqual([admin.id, lead.id].sort());
  });

  it("returns an admin who is also the lead only once", async () => {
    const admin = await createAdmin();
    const subject = await createEmployee({ leadId: admin.id });
    expect(await run((tx) => onboardingCompletedRecipientsInTx(tx, subject.id))).toEqual([
      admin.id,
    ]);
  });

  it("excludes the subject and an archived lead", async () => {
    const admin = await createAdmin();
    const archivedLead = await createLead({ onboardingStatus: "archived" });
    const subject = await createEmployee({ leadId: archivedLead.id });
    expect(await run((tx) => onboardingCompletedRecipientsInTx(tx, subject.id))).toEqual([
      admin.id,
    ]);

    const selfLead = await createAdmin();
    const adminTwo = await createAdmin();
    const recipients = await run((tx) => onboardingCompletedRecipientsInTx(tx, selfLead.id));
    expect(recipients).not.toContain(selfLead.id);
    expect(recipients).toContain(adminTwo.id);
  });

  it("employeeAssignedRecipientInTx skips archived leads, missing leads and the actor", async () => {
    const lead = await createLead();
    const archivedLead = await createLead({ onboardingStatus: "archived" });
    const actor = await createAdmin();

    expect(
      await run((tx) => employeeAssignedRecipientInTx(tx, { leadId: lead.id, actorId: actor.id })),
    ).toBe(lead.id);
    expect(
      await run((tx) =>
        employeeAssignedRecipientInTx(tx, { leadId: archivedLead.id, actorId: actor.id }),
      ),
    ).toBeNull();
    expect(
      await run((tx) => employeeAssignedRecipientInTx(tx, { leadId: null, actorId: actor.id })),
    ).toBeNull();
    expect(
      await run((tx) => employeeAssignedRecipientInTx(tx, { leadId: actor.id, actorId: actor.id })),
    ).toBeNull();
  });
});

describe("cascade", () => {
  it("keeps the notification but nulls the event when the event is deleted", async () => {
    const user = await createUser();
    const event = await createEvent();
    await run((tx) =>
      createNotificationInTx(tx, {
        userId: user.id,
        type: "event_announced",
        eventId: event.id,
        params: { titleDe: "Fest", titleEn: null, startsAt: "2026-12-01T10:00:00.000Z" },
      }),
    );
    await testDb.delete(events).where(eq(events.id, event.id));
    const [row] = await rows(user.id);
    expect(row?.eventId).toBeNull();
    expect(await testDb.select().from(users).where(eq(users.id, user.id))).toHaveLength(1);
  });
});
