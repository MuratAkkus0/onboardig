import { describe, expect, it } from "vitest";
import { getMyPlan, getPlanForUser } from "@/server/services/plans";
import { getAdminOverview, getTeamOverview } from "@/server/services/dashboards";
import { isAppError } from "@/server/errors";
import {
  completePage,
  createAdmin,
  createDepartment,
  createEmployee,
  createLead,
  createPage,
  createTeam,
} from "../../factories";
import { actorOf, testDb } from "../../helpers";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isAppError(error) && error.code).toBe(code);
}

async function pages(count: number, status: "published" | "draft" = "published") {
  return Promise.all(Array.from({ length: count }, () => createPage({ status })));
}

async function plan(userId: string, pageList: { id: string }[]) {
  const { assignPlanSteps } = await import("../../factories");
  await assignPlanSteps(
    userId,
    pageList.map((p) => ({ pageId: p.id, phase: "first_week" as const })),
  );
}

describe("getTeamOverview", () => {
  it("returns only the lead's own employees", async () => {
    const lead = await createLead();
    const otherLead = await createLead();
    const mine = await createEmployee({ leadId: lead.id });
    await createEmployee({ leadId: otherLead.id });
    await createEmployee({ leadId: lead.id, onboardingStatus: "archived" });

    const rows = await getTeamOverview(actorOf(lead));
    expect(rows.map((r) => r.id)).toEqual([mine.id]);
  });

  it("shows empty plans as 0 percent without activity", async () => {
    const lead = await createLead();
    await createEmployee({ leadId: lead.id });
    const [row] = await getTeamOverview(actorOf(lead));
    expect(row).toMatchObject({ percent: 0, total: 0, completed: 0, lastActivityAt: null });
  });

  it("matches the plan numbers and last activity", async () => {
    const lead = await createLead();
    const employee = await createEmployee({ leadId: lead.id });
    const [a, b, c] = await pages(3);
    const [draft] = await pages(1, "draft");
    await plan(employee.id, [a!, b!, c!, draft!]);
    await completePage(employee.id, a!.id, new Date("2026-05-01T10:00:00Z"));
    await completePage(employee.id, b!.id, new Date("2026-05-03T10:00:00Z"));

    const [row] = await getTeamOverview(actorOf(lead));
    const own = await getMyPlan(actorOf(employee));
    const detail = await getPlanForUser(actorOf(lead), { userId: employee.id });
    expect(row!.percent).toBe(67);
    expect(row!.percent).toBe(own.progress.percent);
    expect(row!.percent).toBe(detail.progress.percent);
    expect(row!.lastActivityAt).toEqual(new Date("2026-05-03T10:00:00Z"));
    expect(row!.lastActivityAt).toEqual(own.progress.lastActivityAt);
    expect(row!.status).toBe("active");
  });

  it("forbids employees", async () => {
    const employee = await createEmployee();
    await expectCode(getTeamOverview(actorOf(employee)), "FORBIDDEN");
  });
});

describe("getAdminOverview", () => {
  it("forbids non-admins", async () => {
    const lead = await createLead();
    const employee = await createEmployee();
    await expectCode(getAdminOverview(actorOf(lead)), "FORBIDDEN");
    await expectCode(getAdminOverview(actorOf(employee)), "FORBIDDEN");
  });

  it("filters by department, team and status; archived excluded by default", async () => {
    const admin = await createAdmin();
    const dept1 = await createDepartment();
    const dept2 = await createDepartment();
    const team1 = await createTeam({ departmentId: dept1.id });
    const team1b = await createTeam({ departmentId: dept1.id });
    const team2 = await createTeam({ departmentId: dept2.id });
    const e1 = await createEmployee({ teamId: team1.id });
    const e1b = await createEmployee({ teamId: team1b.id });
    const e2 = await createEmployee({ teamId: team2.id });
    const done = await createEmployee({ teamId: team2.id, onboardingStatus: "completed" });
    const gone = await createEmployee({ teamId: team2.id, onboardingStatus: "archived" });
    const actor = actorOf(admin);
    // Factory-created leads sit in the same team, so compare only the employees of this test.
    const mine = new Set([e1.id, e1b.id, e2.id, done.id, gone.id]);
    const ids = async (input = {}) =>
      (await getAdminOverview(actor, input)).map((r) => r.id).filter((id) => mine.has(id));

    expect((await ids()).sort()).toEqual([e1.id, e1b.id, e2.id, done.id].sort());

    expect((await ids({ departmentId: dept1.id })).sort()).toEqual([e1.id, e1b.id].sort());
    expect(await ids({ teamId: team2.id, status: "completed" })).toEqual([done.id]);
    expect(await ids({ departmentId: dept1.id, teamId: team2.id })).toEqual([]);
    expect(await ids({ teamId: team2.id, status: "archived" })).toEqual([gone.id]);
    expect(await ids({ status: "completed" })).toEqual([done.id]);
  });

  it("returns team, department and progress equal to the plan", async () => {
    const admin = await createAdmin();
    const dept = await createDepartment();
    const team = await createTeam({ departmentId: dept.id });
    const employee = await createEmployee({ teamId: team.id });
    const [a, b] = await pages(2);
    await plan(employee.id, [a!, b!]);
    await completePage(employee.id, a!.id, new Date("2026-06-01T08:00:00Z"));

    const rows = await getAdminOverview(actorOf(admin), { teamId: team.id });
    const row = rows.find((r) => r.id === employee.id)!;
    const own = await getMyPlan(actorOf(employee));
    expect(row.teamName).toBe(team.name);
    expect(row.departmentName).toBe(dept.name);
    expect(row.percent).toBe(50);
    expect(row.percent).toBe(own.progress.percent);
    expect(row.lastActivityAt).toEqual(own.progress.lastActivityAt);
    const [db] = await testDb.select().from(users).where(eq(users.id, employee.id));
    expect(row.startDate).toBe(db!.startDate);
  });

  it("rejects malformed filter ids", async () => {
    const admin = await createAdmin();
    await expect(getAdminOverview(actorOf(admin), { teamId: "nope" })).rejects.toBeTruthy();
  });
});
