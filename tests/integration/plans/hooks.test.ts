import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { notifications, users } from "@/server/db/schema";
import type { User } from "@/server/db/types";
import { acquireLock } from "@/server/services/locks";
import { changePageStatus, savePageContent } from "@/server/services/pages";
import { setStepCompletion } from "@/server/services/plans";
import { completePage, createAdmin, createEmployee, createPage } from "../../factories";
import { actorOf, doc, testDb } from "../../helpers";
import { notificationsOf, orgFixture, planWith, statusOf } from "./fixtures";

async function editPage(editor: User, pageId: string, titleDe = "Neu") {
  const admin = actorOf(editor);
  await acquireLock(admin, { pageId });
  await savePageContent(admin, {
    id: pageId,
    titleDe,
    titleEn: "",
    contentDe: doc(titleDe),
    contentEn: null,
  });
}

describe("page_updated (published content saved)", () => {
  it("goes to active and completed plan holders, not to the editor or archived users", async () => {
    const admin = await createAdmin();
    const page = await createPage({ status: "published" });
    const active = await createEmployee();
    const completed = await createEmployee({ onboardingStatus: "completed" });
    const archived = await createEmployee({ onboardingStatus: "archived" });
    const editorWithPlan = await createEmployee({ role: "admin" });
    const noPlan = await createEmployee();
    for (const user of [active, completed, archived, editorWithPlan]) {
      await planWith(user.id, [page.id]);
    }

    await editPage(editorWithPlan, page.id);

    expect(await notificationsOf(active.id, "page_updated")).toHaveLength(1);
    expect(await notificationsOf(completed.id, "page_updated")).toHaveLength(1);
    expect(await notificationsOf(archived.id, "page_updated")).toHaveLength(0);
    expect(await notificationsOf(editorWithPlan.id, "page_updated")).toHaveLength(0);
    expect(await notificationsOf(noPlan.id, "page_updated")).toHaveLength(0);
    expect(await notificationsOf(admin.id, "page_updated")).toHaveLength(0);
  });

  it("dedupes while unread and notifies again after it was read", async () => {
    const admin = await createAdmin();
    const page = await createPage({ status: "published" });
    const employee = await createEmployee();
    await planWith(employee.id, [page.id]);

    await editPage(admin, page.id, "Eins");
    await editPage(admin, page.id, "Zwei");
    const unread = await notificationsOf(employee.id, "page_updated");
    expect(unread).toHaveLength(1);
    expect(unread[0]).toMatchObject({
      messageKey: "notificationItems.pageUpdated",
      pageId: page.id,
      params: { titleDe: "Zwei", titleEn: null },
    });

    await testDb
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.userId, employee.id));
    await editPage(admin, page.id, "Drei");
    expect(await notificationsOf(employee.id, "page_updated")).toHaveLength(2);
  });

  it("does not notify for draft pages", async () => {
    const admin = await createAdmin();
    const page = await createPage({ status: "draft" });
    const employee = await createEmployee();
    await planWith(employee.id, [page.id]);
    await editPage(admin, page.id);
    expect(await notificationsOf(employee.id, "page_updated")).toHaveLength(0);
  });
});

describe("page status changes recompute plans", () => {
  it("publishing a draft lowers progress, notifies holders and flips completed to active", async () => {
    const { admin, adminActor, employee } = await orgFixture();
    const [done, draft] = await Promise.all([
      createPage({ status: "published" }),
      createPage({ status: "draft" }),
    ]);
    await planWith(employee.id, [done.id, draft.id]);
    await completePage(employee.id, done.id);
    await setStepCompletion(actorOf(employee), { pageId: done.id, completed: true });
    expect((await statusOf(employee.id))?.onboardingStatus).toBe("completed");

    await changePageStatus(adminActor, { id: draft.id, action: "publish" });

    expect((await statusOf(employee.id))?.onboardingStatus).toBe("active");
    expect(await notificationsOf(employee.id, "page_updated")).toHaveLength(1);
    expect(await notificationsOf(admin.id, "page_updated")).toHaveLength(0);
  });

  it("unpublishing or archiving the last open page completes the onboarding", async () => {
    const { lead, adminActor, employee } = await orgFixture();
    const [done, open, open2] = await Promise.all([
      createPage({ status: "published" }),
      createPage({ status: "published" }),
      createPage({ status: "published" }),
    ]);
    await planWith(employee.id, [done.id, open.id, open2.id]);
    await completePage(employee.id, done.id);

    await changePageStatus(adminActor, { id: open.id, action: "unpublish" });
    expect((await statusOf(employee.id))?.onboardingStatus).toBe("active");
    await changePageStatus(adminActor, { id: open2.id, action: "archive" });

    expect((await statusOf(employee.id))?.onboardingStatus).toBe("completed");
    expect(await notificationsOf(lead.id, "onboarding_completed")).toHaveLength(1);
  });

  it("restoring an archived page reopens a completed plan without page_updated", async () => {
    const { adminActor, employee } = await orgFixture();
    const [done, archived] = await Promise.all([
      createPage({ status: "published" }),
      createPage({ status: "archived" }),
    ]);
    await planWith(employee.id, [done.id, archived.id]);
    await completePage(employee.id, done.id);
    await testDb
      .update(users)
      .set({ onboardingStatus: "completed" })
      .where(eq(users.id, employee.id));

    await changePageStatus(adminActor, { id: archived.id, action: "restore" });

    expect((await statusOf(employee.id))?.onboardingStatus).toBe("active");
    expect(await notificationsOf(employee.id, "page_updated")).toHaveLength(0);
  });
});
