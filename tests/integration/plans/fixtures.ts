import { and, eq } from "drizzle-orm";
import { notifications, userPlanSteps, users } from "@/server/db/schema";
import {
  assignPlanSteps,
  createAdmin,
  createEmployee,
  createLead,
  createPage,
} from "../../factories";
import { actorOf, testDb } from "../../helpers";

/** An employee with their lead and one admin. */
export async function orgFixture() {
  const admin = await createAdmin();
  const lead = await createLead();
  const employee = await createEmployee({ leadId: lead.id, teamId: lead.teamId });
  return {
    admin,
    lead,
    employee,
    adminActor: actorOf(admin),
    leadActor: actorOf(lead),
    employeeActor: actorOf(employee),
  };
}

export async function publishedPages(count: number) {
  return Promise.all(Array.from({ length: count }, () => createPage({ status: "published" })));
}

/** Gives the employee a plan of the pages, all in `first_week`. */
export async function planWith(userId: string, pageIds: string[]) {
  await assignPlanSteps(
    userId,
    pageIds.map((pageId) => ({ pageId, phase: "first_week" as const })),
  );
}

export async function notificationsOf(
  userId: string,
  type?: (typeof notifications.$inferSelect)["type"],
) {
  return testDb
    .select()
    .from(notifications)
    .where(
      type
        ? and(eq(notifications.userId, userId), eq(notifications.type, type))
        : eq(notifications.userId, userId),
    );
}

export async function planOf(userId: string) {
  return testDb.select().from(userPlanSteps).where(eq(userPlanSteps.userId, userId));
}

export async function statusOf(userId: string) {
  const [row] = await testDb.select().from(users).where(eq(users.id, userId));
  return row;
}
