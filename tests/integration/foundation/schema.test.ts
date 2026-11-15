import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { notifications, pageEditLocks, pages, userPlanSteps, users } from "@/server/db/schema";
import { pgErrorCode } from "@/server/errors";
import {
  assignPlanSteps,
  createAdmin,
  createEmployee,
  createEvent,
  createLock,
  createNotification,
  createPage,
  createTemplate,
  createUser,
} from "../../factories";
import { doc } from "../../helpers/tiptap";
import { testDb } from "../../helpers/db";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

async function sqlState(promise: PromiseLike<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    return pgErrorCode(e);
  }
  return undefined;
}

describe("schema constraints", () => {
  it("rejects a second plan step for the same user and page", async () => {
    const employee = await createEmployee();
    const page = await createPage({ status: "published" });
    await assignPlanSteps(employee.id, [{ pageId: page.id, phase: "first_day" }]);

    const state = await sqlState(
      testDb
        .insert(userPlanSteps)
        .values({ userId: employee.id, pageId: page.id, phase: "first_week", sortOrder: 5 }),
    );
    expect(state).toBe(UNIQUE_VIOLATION);
  });

  it("rejects a duplicate page in one template", async () => {
    const page = await createPage();
    const state = await sqlState(
      createTemplate({
        steps: [
          { pageId: page.id, phase: "first_day" },
          { pageId: page.id, phase: "first_week" },
        ],
      }),
    );
    expect(state).toBe(UNIQUE_VIOLATION);
  });

  it("keeps user emails unique", async () => {
    await createUser({ email: "same@example.test" });
    const state = await sqlState(createUser({ email: "same@example.test" }));
    expect(state).toBe(UNIQUE_VIOLATION);
  });

  it("does not let a user be their own lead", async () => {
    const admin = await createAdmin();
    const state = await sqlState(
      testDb.update(users).set({ leadId: admin.id }).where(eq(users.id, admin.id)),
    );
    expect(state).toBe(CHECK_VIOLATION);
  });

  it("allows one edit lock per page (primary key)", async () => {
    const admin = await createAdmin();
    const other = await createAdmin();
    const page = await createPage();
    await createLock({ pageId: page.id, userId: admin.id });

    expect(await sqlState(createLock({ pageId: page.id, userId: other.id }))).toBe(
      UNIQUE_VIOLATION,
    );
    expect(await testDb.select().from(pageEditLocks)).toHaveLength(1);
  });

  it("fills the generated tsvector columns from title and text", async () => {
    const page = await createPage({
      titleDe: "Urlaubsregelung",
      textDe: "Wie beantrage ich Urlaub",
      titleEn: "Vacation policy",
      contentEn: doc("How to request vacation"),
      textEn: "How to request vacation",
    });
    const [de] = await testDb
      .select({ hit: sql<boolean>`${pages.searchDe} @@ websearch_to_tsquery('german', 'Urlaub')` })
      .from(pages)
      .where(eq(pages.id, page.id));
    const [en] = await testDb
      .select({
        hit: sql<boolean>`${pages.searchEn} @@ websearch_to_tsquery('english', 'vacations')`,
      })
      .from(pages)
      .where(eq(pages.id, page.id));
    expect(de?.hit).toBe(true);
    expect(en?.hit).toBe(true);
  });

  it("requires English title, content and text together on pages", async () => {
    expect(await sqlState(createPage({ titleEn: "Only a title" }))).toBe(CHECK_VIOLATION);
    expect(await sqlState(createPage({ contentEn: doc("Only content") }))).toBe(CHECK_VIOLATION);
  });

  it("requires English title and description together on events", async () => {
    expect(await sqlState(createEvent({ titleEn: "Only a title" }))).toBe(CHECK_VIOLATION);
  });

  it("rejects events that end before they start", async () => {
    const startsAt = new Date("2026-06-01T10:00:00Z");
    const state = await sqlState(
      createEvent({ startsAt, endsAt: new Date("2026-06-01T09:00:00Z") }),
    );
    expect(state).toBe(CHECK_VIOLATION);
  });

  it("deduplicates only unread notifications that carry a dedupe key", async () => {
    const user = await createEmployee();
    const base = { userId: user.id, dedupeKey: "plan_steps_added" };
    const first = await createNotification(base);

    expect(await sqlState(createNotification(base))).toBe(UNIQUE_VIOLATION);

    await testDb
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, first.id));
    await createNotification(base);

    // Without a dedupe key duplicates are fine.
    await createNotification({ userId: user.id });
    await createNotification({ userId: user.id });
    expect(await testDb.select().from(notifications)).toHaveLength(4);
  });

  it("deletes notifications about a user together with that user", async () => {
    const lead = await createAdmin();
    const subject = await createEmployee();
    await createNotification({ userId: lead.id, subjectUserId: subject.id });

    await testDb.delete(users).where(eq(users.id, subject.id));
    expect(await testDb.select().from(notifications)).toHaveLength(0);
  });
});
