import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { V_FB_CONFIG } from "@/config/app";
import { feedbackReports, modules, notifications, users } from "@/server/db/schema";
import {
  countOpenReports,
  createReport,
  deleteReport,
  listReports,
  updateReport,
} from "@/server/services/feedback";
import {
  createAdmin,
  createDepartment,
  createEmployee,
  createFeedbackReport,
  createLead,
  createModule,
  createPage,
  createTeam,
} from "../../factories";
import { actorOf, testDb } from "../../helpers";

const input = { type: "app_bug", subject: "Subject", message: "Message" } as const;

async function leadOfDepartment() {
  const department = await createDepartment();
  const team = await createTeam({ departmentId: department.id });
  const lead = await createLead({ teamId: team.id });
  return { department, lead };
}

/** A published page in a mod of `departmentId`, plus an employee that has it in their plan. */
async function reportOnPage(departmentId: string | null, overrides = {}) {
  const mod = await createModule({ departmentId });
  const page = await createPage({ moduleId: mod.id, status: "published" });
  return createFeedbackReport({ type: "content_issue", pageId: page.id, ...overrides });
}

describe("createReport", () => {
  it("is open to every role and stores the reporter", async () => {
    const employee = await createEmployee();
    const lead = await createLead();
    const admin = await createAdmin();
    for (const user of [employee, lead, admin]) {
      const report = await createReport(actorOf(user), input);
      expect(report).toMatchObject({
        status: "open",
        type: "app_bug",
        pageId: null,
        path: null,
        response: null,
        resolvedAt: null,
        reporter: { id: user.id },
      });
    }
  });

  it("enforces validation limits", async () => {
    const admin = actorOf(await createAdmin());
    await expect(createReport(admin, { ...input, subject: "" })).rejects.toThrow();
    await expect(
      createReport(admin, { ...input, subject: "x".repeat(V_FB_CONFIG.subjectMaxLength + 1) }),
    ).rejects.toThrow();
    await expect(
      createReport(admin, { ...input, message: "x".repeat(V_FB_CONFIG.messageMaxLength + 1) }),
    ).rejects.toThrow();
    const ok = await createReport(admin, {
      ...input,
      subject: "x".repeat(V_FB_CONFIG.subjectMaxLength),
      message: "x".repeat(V_FB_CONFIG.messageMaxLength),
    });
    expect(ok.subject).toHaveLength(V_FB_CONFIG.subjectMaxLength);
  });

  it("rejects unsafe paths", async () => {
    const admin = actorOf(await createAdmin());
    for (const path of ["https://evil.example/x", "//evil.example", "/a\\b"]) {
      await expect(createReport(admin, { ...input, path })).rejects.toThrow();
    }
    await expect(
      createReport(admin, { ...input, path: `/${"a".repeat(V_FB_CONFIG.pathMaxLength)}` }),
    ).rejects.toThrow();
    expect(await testDb.select().from(feedbackReports)).toHaveLength(0);
  });

  it("derives the page from /pages/<uuid> when the reporter can view it", async () => {
    const admin = await createAdmin();
    const page = await createPage({ status: "published" });
    for (const path of [`/pages/${page.id}`, `/pages/${page.id}?from=plan`, `/pages/${page.id}/`]) {
      const report = await createReport(actorOf(admin), { ...input, path });
      expect(report.pageId).toBe(page.id);
      expect(report.path).toBe(path);
    }
  });

  it("ignores pages the reporter cannot view, unknown ids and non-page paths", async () => {
    const employee = await createEmployee();
    const hidden = await createPage({ status: "published" }); // not in the employee's plan
    const draft = await createPage({ status: "draft" });
    const admin = await createAdmin();
    const paths = [
      `/pages/${hidden.id}`,
      "/pages/6f1c0c2e-5d4b-4a53-9a57-0d5b8f9b6a11",
      "/pages/not-a-uuid",
      "/plan",
    ];
    for (const path of paths) {
      expect((await createReport(actorOf(employee), { ...input, path })).pageId).toBeNull();
    }
    // The admin sees drafts, a lead of another department does not.
    expect(
      (await createReport(actorOf(admin), { ...input, path: `/pages/${draft.id}` })).pageId,
    ).toBe(draft.id);
    const { lead } = await leadOfDepartment();
    expect(
      (await createReport(actorOf(lead), { ...input, path: `/pages/${draft.id}` })).pageId,
    ).toBeNull();
  });

  it("rejects the sixth report within an hour, counted per reporter", async () => {
    const employee = actorOf(await createEmployee());
    const other = actorOf(await createEmployee());
    for (let i = 0; i < V_FB_CONFIG.maxReportsPerHour; i += 1) {
      await createReport(employee, input);
    }
    await expect(createReport(employee, input)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(createReport(other, input)).resolves.toBeDefined();
  });

  it("only counts reports from the rolling hour", async () => {
    const user = await createEmployee();
    for (let i = 0; i < V_FB_CONFIG.maxReportsPerHour; i += 1) {
      await createFeedbackReport({
        reporterId: user.id,
        createdAt: new Date(Date.now() - 61 * 60_000),
      });
    }
    await expect(createReport(actorOf(user), input)).resolves.toBeDefined();
  });

  it("holds the limit under concurrent submissions", async () => {
    const employee = actorOf(await createEmployee());
    const results = await Promise.allSettled(
      Array.from({ length: V_FB_CONFIG.maxReportsPerHour + 3 }, () =>
        createReport(employee, input),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(
      V_FB_CONFIG.maxReportsPerHour,
    );
  });
});

describe("scope", () => {
  it("admin sees all reports, newest first, with filters", async () => {
    const admin = actorOf(await createAdmin());
    const older = await createFeedbackReport({
      type: "app_bug",
      createdAt: new Date(Date.now() - 60_000),
    });
    const content = await reportOnPage(null);
    const done = await createFeedbackReport({ status: "done", resolvedAt: new Date() });
    const all = await listReports(admin);
    expect(all.map((r) => r.id)).toEqual(expect.arrayContaining([older.id, content.id, done.id]));
    expect(all).toHaveLength(3);
    expect(all.findIndex((r) => r.id === content.id)).toBeLessThan(
      all.findIndex((r) => r.id === older.id),
    );
    expect((await listReports(admin, { status: "done" })).map((r) => r.id)).toEqual([done.id]);
    expect((await listReports(admin, { type: "app_bug" })).map((r) => r.id)).toEqual([older.id]);
  });

  it("a lead sees only content reports on pages of their own department", async () => {
    const { department, lead } = await leadOfDepartment();
    const otherDepartment = await createDepartment();
    const own = await reportOnPage(department.id);
    await reportOnPage(otherDepartment.id);
    await reportOnPage(null);
    await createFeedbackReport({ type: "app_bug" });
    await createFeedbackReport({ type: "other" });
    // Same department but not a content issue (type changed by the reporter's choice) stays hidden.
    await reportOnPage(department.id, { type: "app_bug" });
    const list = await listReports(actorOf(lead));
    expect(list.map((r) => r.id)).toEqual([own.id]);
  });

  it("re-routes when the mod changes department", async () => {
    const { department, lead } = await leadOfDepartment();
    const other = await createDepartment();
    const mod = await createModule({ departmentId: other.id });
    const page = await createPage({ moduleId: mod.id, status: "published" });
    const report = await createFeedbackReport({ type: "content_issue", pageId: page.id });
    expect(await listReports(actorOf(lead))).toHaveLength(0);
    await testDb.update(modules).set({ departmentId: department.id }).where(eq(modules.id, mod.id));
    expect((await listReports(actorOf(lead))).map((r) => r.id)).toEqual([report.id]);
  });

  it("a lead without a team sees nothing", async () => {
    const lead = await createLead();
    await testDb.update(users).set({ teamId: null }).where(eq(users.id, lead.id));
    await reportOnPage(null);
    expect(await listReports(actorOf(lead))).toEqual([]);
    expect(await countOpenReports(actorOf(lead))).toBe(0);
  });

  it("employees are forbidden everywhere except creating", async () => {
    const employee = actorOf(await createEmployee());
    const report = await createFeedbackReport();
    await expect(listReports(employee)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(countOpenReports(employee)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      updateReport(employee, { id: report.id, status: "done", response: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteReport(employee, { id: report.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("a lead cannot update or delete out-of-scope reports", async () => {
    const { department, lead } = await leadOfDepartment();
    const foreign = await reportOnPage(null);
    const appBug = await createFeedbackReport({ type: "app_bug" });
    for (const report of [foreign, appBug]) {
      await expect(
        updateReport(actorOf(lead), { id: report.id, status: "done", response: null }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(deleteReport(actorOf(lead), { id: report.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    const own = await reportOnPage(department.id);
    await expect(deleteReport(actorOf(lead), { id: own.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const updated = await updateReport(actorOf(lead), {
      id: own.id,
      status: "in_progress",
      response: null,
    });
    expect(updated.status).toBe("in_progress");
  });
});

describe("updateReport", () => {
  it("sets and clears resolved_at and handled_by along the transitions", async () => {
    const admin = await createAdmin({ firstName: "Ada", lastName: "Admin" });
    const report = await createFeedbackReport({ reporterId: (await createEmployee()).id });

    const progress = await updateReport(actorOf(admin), {
      id: report.id,
      status: "in_progress",
      response: "Looking into it",
    });
    expect(progress).toMatchObject({
      status: "in_progress",
      response: "Looking into it",
      resolvedAt: null,
      handledByName: "Ada Admin",
    });

    const done = await updateReport(actorOf(admin), {
      id: report.id,
      status: "done",
      response: "Fixed",
    });
    expect(done.resolvedAt).toBeInstanceOf(Date);

    const reopened = await updateReport(actorOf(admin), {
      id: report.id,
      status: "open",
      response: null,
    });
    expect(reopened).toMatchObject({ status: "open", resolvedAt: null, response: null });
    const [row] = await testDb
      .select()
      .from(feedbackReports)
      .where(eq(feedbackReports.id, report.id));
    expect(row?.handledBy).toBe(admin.id);
  });

  it("keeps resolved_at when saving a done report again, without a second notification", async () => {
    const admin = actorOf(await createAdmin());
    const reporter = await createEmployee();
    const report = await createFeedbackReport({ reporterId: reporter.id });
    const first = await updateReport(admin, { id: report.id, status: "done", response: "ok" });
    const second = await updateReport(admin, { id: report.id, status: "done", response: "ok2" });
    expect(second.resolvedAt).toEqual(first.resolvedAt);
    const rows = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, reporter.id));
    expect(rows).toHaveLength(1);
  });

  it("notifies the reporter with subject and response on every transition into done", async () => {
    const admin = actorOf(await createAdmin());
    const reporter = await createEmployee();
    const report = await createFeedbackReport({ reporterId: reporter.id, subject: "Broken link" });
    await updateReport(admin, { id: report.id, status: "done", response: "Fixed it" });
    const [first] = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, reporter.id));
    expect(first).toMatchObject({
      type: "feedback_resolved",
      messageKey: "notificationItems.feedbackResolvedWithResponse",
      params: { subject: "Broken link", response: "Fixed it" },
    });
    // Once read, a re-opened and re-resolved report notifies again.
    await testDb.update(notifications).set({ readAt: new Date() });
    await updateReport(admin, { id: report.id, status: "open", response: null });
    await updateReport(admin, { id: report.id, status: "done", response: null });
    const rows = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, reporter.id));
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.messageKey === "notificationItems.feedbackResolved")).toBe(true);
  });

  it("links the notification to the reported path when there is one", async () => {
    const admin = actorOf(await createAdmin());
    const reporter = await createEmployee();
    const report = await createFeedbackReport({
      reporterId: reporter.id,
      path: "/pages/11111111-1111-4111-8111-111111111111",
    });
    const other = await createFeedbackReport({ reporterId: reporter.id });
    await updateReport(admin, { id: report.id, status: "done", response: null });
    await updateReport(admin, { id: other.id, status: "done", response: null });
    const rows = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, reporter.id));
    expect(rows.map((r) => r.link ?? "").sort()).toEqual([
      "",
      "/pages/11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("does not notify for deleted or archived reporters, nor for non-done changes", async () => {
    const admin = actorOf(await createAdmin());
    const archived = await createEmployee({ onboardingStatus: "archived" });
    const gone = await createEmployee();
    const active = await createEmployee();
    const archivedReport = await createFeedbackReport({ reporterId: archived.id });
    const goneReport = await createFeedbackReport({ reporterId: gone.id });
    const activeReport = await createFeedbackReport({ reporterId: active.id });
    await testDb.delete(users).where(eq(users.id, gone.id));

    await updateReport(admin, { id: archivedReport.id, status: "done", response: null });
    await updateReport(admin, { id: goneReport.id, status: "done", response: null });
    await updateReport(admin, { id: activeReport.id, status: "in_progress", response: null });
    expect(await testDb.select().from(notifications)).toHaveLength(0);
  });

  it("rolls the status change back when the notification cannot be created", async () => {
    const admin = actorOf(await createAdmin());
    const report = await createFeedbackReport({ reporterId: (await createEmployee()).id });
    await testDb.execute(
      sql`alter table notifications add constraint fb_block check (false) not valid`,
    );
    try {
      await expect(
        updateReport(admin, { id: report.id, status: "done", response: null }),
      ).rejects.toBeDefined();
    } finally {
      await testDb.execute(sql`alter table notifications drop constraint fb_block`);
    }
    const [row] = await testDb
      .select()
      .from(feedbackReports)
      .where(eq(feedbackReports.id, report.id));
    expect(row?.status).toBe("open");
  });

  it("returns NOT_FOUND for unknown ids and validates input", async () => {
    const admin = actorOf(await createAdmin());
    await expect(
      updateReport(admin, {
        id: "6f1c0c2e-5d4b-4a53-9a57-0d5b8f9b6a11",
        status: "done",
        response: null,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const report = await createFeedbackReport();
    await expect(
      updateReport(admin, {
        id: report.id,
        status: "done",
        response: "x".repeat(V_FB_CONFIG.responseMaxLength + 1),
      }),
    ).rejects.toThrow();
  });
});

describe("retention, deletion, reporter removal", () => {
  it("listReports purges done reports resolved before the retention period only", async () => {
    const admin = actorOf(await createAdmin());
    const day = 24 * 60 * 60 * 1000;
    const old = await createFeedbackReport({
      status: "done",
      resolvedAt: new Date(Date.now() - (V_FB_CONFIG.retentionDays + 1) * day),
    });
    const recent = await createFeedbackReport({
      status: "done",
      resolvedAt: new Date(Date.now() - (V_FB_CONFIG.retentionDays - 1) * day),
    });
    const oldOpen = await createFeedbackReport({
      createdAt: new Date(Date.now() - 400 * day),
    });
    const ids = (await listReports(admin)).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([recent.id, oldOpen.id]));
    expect(ids).not.toContain(old.id);
    expect(await testDb.select().from(feedbackReports)).toHaveLength(2);
  });

  it("admin can delete; unknown id is NOT_FOUND", async () => {
    const admin = actorOf(await createAdmin());
    const report = await createFeedbackReport();
    await deleteReport(admin, { id: report.id });
    expect(await testDb.select().from(feedbackReports)).toHaveLength(0);
    await expect(deleteReport(admin, { id: report.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("deleting the reporter keeps the report without a reporter", async () => {
    const admin = actorOf(await createAdmin());
    const reporter = await createEmployee();
    const report = await createFeedbackReport({ reporterId: reporter.id });
    await testDb.delete(users).where(eq(users.id, reporter.id));
    const [dto] = await listReports(admin);
    expect(dto).toMatchObject({ id: report.id, reporter: null });
  });
});

describe("countOpenReports", () => {
  it("counts open reports per role scope", async () => {
    const { department, lead } = await leadOfDepartment();
    const admin = await createAdmin();
    await reportOnPage(department.id);
    await reportOnPage(department.id, { status: "done", resolvedAt: new Date() });
    await reportOnPage(null);
    await createFeedbackReport({ type: "app_bug" });
    await createFeedbackReport({ status: "in_progress" });
    expect(await countOpenReports(actorOf(admin))).toBe(3);
    expect(await countOpenReports(actorOf(lead))).toBe(1);
  });
});
