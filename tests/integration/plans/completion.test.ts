import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { notifications, pageCompletions, pages, users } from "@/server/db/schema";
import { isAppError } from "@/server/errors";
import {
  dismissStepUpdate,
  getMyPlan,
  getMyStepState,
  getPlanForUser,
  setStepCompletion,
} from "@/server/services/plans";
import { reactivateUser } from "@/server/services/users";
import { completePage, createAdmin, createEmployee, createLead, createPage } from "../../factories";
import { actorOf, testDb } from "../../helpers";
import { notificationsOf, orgFixture, planWith, publishedPages, statusOf } from "./fixtures";

describe("setStepCompletion", () => {
  it("marks and undoes a step and reports progress", async () => {
    const { employee, employeeActor } = await orgFixture();
    const [a, b] = await publishedPages(2);
    await planWith(employee.id, [a!.id, b!.id]);

    const done = await setStepCompletion(employeeActor, { pageId: a!.id, completed: true });
    expect(done.progress).toMatchObject({ completed: 1, total: 2, percent: 50 });
    expect(done.status).toBe("active");
    expect(done.progress.lastActivityAt).toBeInstanceOf(Date);

    const undone = await setStepCompletion(employeeActor, { pageId: a!.id, completed: false });
    expect(undone.progress.percent).toBe(0);
    expect(await testDb.select().from(pageCompletions)).toHaveLength(0);
  });

  it("is idempotent and keeps the first completion time", async () => {
    const { employee, employeeActor } = await orgFixture();
    const [a, b] = await publishedPages(2);
    await planWith(employee.id, [a!.id, b!.id]);
    await setStepCompletion(employeeActor, { pageId: a!.id, completed: true });
    const [first] = await testDb.select().from(pageCompletions);
    await setStepCompletion(employeeActor, { pageId: a!.id, completed: true });
    const rows = await testDb.select().from(pageCompletions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.completedAt).toEqual(first?.completedAt);
  });

  it("only works on active steps of the actor's own plan", async () => {
    const { employee, employeeActor } = await orgFixture();
    const other = await createEmployee();
    const [mine, theirs] = await publishedPages(2);
    const draft = await createPage({ status: "draft" });
    await planWith(employee.id, [mine!.id, draft.id]);
    await planWith(other.id, [theirs!.id]);

    for (const pageId of [theirs!.id, draft.id]) {
      const error = await setStepCompletion(employeeActor, { pageId, completed: true }).catch(
        (e: unknown) => e,
      );
      expect(isAppError(error) && error.code).toBe("NOT_FOUND");
    }
    expect(await testDb.select().from(pageCompletions)).toHaveLength(0);
  });

  it("excludes draft and archived pages from progress", async () => {
    const { employee, employeeActor } = await orgFixture();
    const [a, b] = await publishedPages(2);
    await planWith(employee.id, [a!.id, b!.id]);
    await setStepCompletion(employeeActor, { pageId: a!.id, completed: true });
    expect((await getMyPlan(employeeActor)).progress.percent).toBe(50);

    await testDb.update(pages).set({ status: "archived" }).where(eq(pages.id, b!.id));
    expect((await getMyPlan(employeeActor)).progress).toMatchObject({
      completed: 1,
      total: 1,
      percent: 100,
    });
  });
});

describe("onboarding status machine", () => {
  it("completes at 100 percent, notifies lead and admins, and returns to active on undo", async () => {
    const { admin, lead, employee, employeeActor } = await orgFixture();
    const otherAdmin = await createAdmin();
    const [a, b] = await publishedPages(2);
    await planWith(employee.id, [a!.id, b!.id]);

    await setStepCompletion(employeeActor, { pageId: a!.id, completed: true });
    const finished = await setStepCompletion(employeeActor, { pageId: b!.id, completed: true });
    expect(finished.status).toBe("completed");
    const row = await statusOf(employee.id);
    expect(row?.onboardingStatus).toBe("completed");
    expect(row?.onboardingCompletedAt).toBeInstanceOf(Date);
    for (const recipient of [lead, admin, otherAdmin]) {
      expect(await notificationsOf(recipient.id, "onboarding_completed")).toHaveLength(1);
    }
    expect(await notificationsOf(employee.id, "onboarding_completed")).toHaveLength(0);

    const undone = await setStepCompletion(employeeActor, { pageId: b!.id, completed: false });
    expect(undone.status).toBe("active");
    expect((await statusOf(employee.id))?.onboardingCompletedAt).toBeNull();

    // Reaching 100 % again notifies again (deduped while the first one is unread).
    await setStepCompletion(employeeActor, { pageId: b!.id, completed: true });
    expect(await notificationsOf(lead.id, "onboarding_completed")).toHaveLength(1);
  });

  it("notifies again as a new row once the earlier notification was read", async () => {
    const { lead, employee, employeeActor } = await orgFixture();
    const [a] = await publishedPages(1);
    await planWith(employee.id, [a!.id]);
    await setStepCompletion(employeeActor, { pageId: a!.id, completed: true });
    await testDb.update(notifications).set({ readAt: new Date() });
    await setStepCompletion(employeeActor, { pageId: a!.id, completed: false });
    await setStepCompletion(employeeActor, { pageId: a!.id, completed: true });
    expect(await notificationsOf(lead.id, "onboarding_completed")).toHaveLength(2);
  });

  it("a lead who is also an admin gets exactly one notification and no error", async () => {
    const leadAdmin = await createAdmin();
    const employee = await createEmployee({ leadId: leadAdmin.id });
    const [a] = await publishedPages(1);
    await planWith(employee.id, [a!.id]);

    await setStepCompletion(actorOf(employee), { pageId: a!.id, completed: true });

    expect(await notificationsOf(leadAdmin.id, "onboarding_completed")).toHaveLength(1);
  });

  it("does not notify an admin or lead about their own onboarding", async () => {
    const admin = await createAdmin();
    const otherAdmin = await createAdmin();
    const lead = await createLead({ leadId: admin.id });
    const [a] = await publishedPages(1);
    await planWith(admin.id, [a!.id]);
    await planWith(lead.id, [a!.id]);

    await setStepCompletion(actorOf(admin), { pageId: a!.id, completed: true });
    expect(await notificationsOf(admin.id, "onboarding_completed")).toHaveLength(0);
    expect(await notificationsOf(otherAdmin.id, "onboarding_completed")).toHaveLength(1);

    await setStepCompletion(actorOf(lead), { pageId: a!.id, completed: true });
    expect(await notificationsOf(lead.id, "onboarding_completed")).toHaveLength(0);
    expect(await notificationsOf(admin.id, "onboarding_completed")).toHaveLength(1);
  });

  it("two concurrent completions of the last two open steps complete the onboarding", async () => {
    const { admin, lead, employee, employeeActor } = await orgFixture();
    const [a, b] = await publishedPages(2);
    await planWith(employee.id, [a!.id, b!.id]);

    await Promise.all([
      setStepCompletion(employeeActor, { pageId: a!.id, completed: true }),
      setStepCompletion(employeeActor, { pageId: b!.id, completed: true }),
    ]);

    expect((await statusOf(employee.id))?.onboardingStatus).toBe("completed");
    expect(await notificationsOf(lead.id, "onboarding_completed")).toHaveLength(1);
    expect(await notificationsOf(admin.id, "onboarding_completed")).toHaveLength(1);
  });

  it("an empty plan stays active", async () => {
    const { employee, employeeActor } = await orgFixture();
    expect((await getMyPlan(employeeActor)).status).toBe("active");
    expect((await statusOf(employee.id))?.onboardingStatus).toBe("active");
  });

  it("reactivating a user whose plan is 100 percent returns to completed without a notification", async () => {
    const { adminActor, lead, employee } = await orgFixture();
    const [a] = await publishedPages(1);
    await planWith(employee.id, [a!.id]);
    await completePage(employee.id, a!.id);
    await testDb
      .update(users)
      .set({ onboardingStatus: "archived", banned: true, archivedAt: new Date() })
      .where(eq(users.id, employee.id));

    await reactivateUser(adminActor, { id: employee.id });

    expect((await statusOf(employee.id))?.onboardingStatus).toBe("completed");
    expect(await notificationsOf(lead.id, "onboarding_completed")).toHaveLength(0);
  });
});

describe("getMyStepState", () => {
  it("returns the own active step state and null for other pages", async () => {
    const { employee, employeeActor } = await orgFixture();
    const [a, b] = await publishedPages(2);
    await planWith(employee.id, [a!.id]);
    expect(await getMyStepState(employeeActor, { pageId: a!.id })).toEqual({
      completedAt: null,
      updatedSinceCompletion: false,
    });
    expect(await getMyStepState(employeeActor, { pageId: b!.id })).toBeNull();
    await setStepCompletion(employeeActor, { pageId: a!.id, completed: true });
    expect((await getMyStepState(employeeActor, { pageId: a!.id }))?.completedAt).toBeInstanceOf(
      Date,
    );
  });
});

describe("dismissStepUpdate", () => {
  it("hides the badge without touching the completion, until the page changes again", async () => {
    const { adminActor, employee, employeeActor } = await orgFixture();
    const [a, b] = await publishedPages(2);
    await planWith(employee.id, [a!.id, b!.id]);
    const completedAt = new Date(Date.now() - 60_000);
    await completePage(employee.id, a!.id, completedAt);
    expect((await getMyStepState(employeeActor, { pageId: a!.id }))?.updatedSinceCompletion).toBe(
      true,
    );

    await dismissStepUpdate(employeeActor, { pageId: a!.id });

    expect(await getMyStepState(employeeActor, { pageId: a!.id })).toEqual({
      completedAt,
      updatedSinceCompletion: false,
    });
    const plan = await getMyPlan(employeeActor);
    expect(plan.progress).toMatchObject({ completed: 1, total: 2 });
    const leadView = await getPlanForUser(adminActor, { userId: employee.id });
    expect(leadView.phases.flatMap((p) => p.steps).find((s) => s.pageId === a!.id)).toMatchObject({
      updatedSinceCompletion: false,
    });

    await testDb
      .update(pages)
      .set({ contentUpdatedAt: new Date(Date.now() + 60_000) })
      .where(eq(pages.id, a!.id));
    expect((await getMyStepState(employeeActor, { pageId: a!.id }))?.updatedSinceCompletion).toBe(
      true,
    );
  });

  it("rejects open steps and pages outside the own plan", async () => {
    const { employee, employeeActor } = await orgFixture();
    const other = await createEmployee();
    const [a, b, c] = await publishedPages(3);
    await planWith(employee.id, [a!.id]);
    await planWith(other.id, [c!.id]);
    await completePage(other.id, c!.id, new Date(Date.now() - 60_000));

    for (const pageId of [a!.id, b!.id, c!.id]) {
      await expect(dismissStepUpdate(employeeActor, { pageId })).rejects.toSatisfy(
        (e) => isAppError(e) && e.code === "NOT_FOUND",
      );
    }
    const [otherCompletion] = await testDb
      .select()
      .from(pageCompletions)
      .where(eq(pageCompletions.userId, other.id));
    expect(otherCompletion?.updateSeenAt).toBeNull();
  });
});
