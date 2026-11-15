import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { pages, templateSteps, userTemplateAssignments } from "@/server/db/schema";
import { isAppError } from "@/server/errors";
import {
  addPlanStep,
  assignTemplates,
  getMyPlan,
  getPlanForUser,
  listAddablePages,
  listAssignableTemplates,
  removePlanStep,
} from "@/server/services/plans";
import {
  completePage,
  createDepartment,
  createEmployee,
  createJobRole,
  createLead,
  createPage,
  createTeam,
  createTemplate,
} from "../../factories";
import { actorOf, testDb } from "../../helpers";
import {
  notificationsOf,
  orgFixture,
  planOf,
  planWith,
  publishedPages,
  statusOf,
} from "./fixtures";

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isAppError(error) && error.code).toBe(code);
  return error;
}

describe("assignTemplates (snapshot)", () => {
  it("copies the template steps into the plan and records the assignment", async () => {
    const { adminActor, employee } = await orgFixture();
    const [a, b, c] = await publishedPages(3);
    const template = await createTemplate({
      steps: [
        { pageId: a!.id, phase: "first_week" },
        { pageId: b!.id, phase: "before_start" },
        { pageId: c!.id, phase: "first_week" },
      ],
    });

    const result = await assignTemplates(adminActor, {
      userId: employee.id,
      templateIds: [template.id],
    });

    expect(result).toEqual({ addedSteps: 3 });
    const plan = await getMyPlan(actorOf(employee));
    expect(plan.phases.map((p) => p.phase)).toEqual(["before_start", "first_week"]);
    expect(plan.phases[1]!.steps.map((s) => s.pageId)).toEqual([a!.id, c!.id]);
    const steps = await planOf(employee.id);
    expect(steps.every((s) => s.sourceTemplateId === template.id)).toBe(true);
    expect(steps.every((s) => s.addedBy === adminActor.id)).toBe(true);
    const assignments = await testDb.select().from(userTemplateAssignments);
    expect(assignments).toHaveLength(1);
  });

  it("does not change plans when the template is edited later", async () => {
    const { adminActor, employee } = await orgFixture();
    const [a, b] = await publishedPages(2);
    const template = await createTemplate({ steps: [{ pageId: a!.id, phase: "first_day" }] });
    await assignTemplates(adminActor, { userId: employee.id, templateIds: [template.id] });

    await testDb
      .insert(templateSteps)
      .values({ templateId: template.id, pageId: b!.id, phase: "first_day", sortOrder: 5 });
    await testDb.delete(templateSteps).where(eq(templateSteps.pageId, a!.id));

    const steps = await planOf(employee.id);
    expect(steps.map((s) => s.pageId)).toEqual([a!.id]);
  });

  it("dedupes a page that is in several templates (first template in specificity order wins)", async () => {
    const { adminActor, employee } = await orgFixture();
    const [shared, onlyB] = await publishedPages(2);
    const department = await createDepartment();
    const companyWide = await createTemplate({
      name: "B company",
      steps: [{ pageId: shared!.id, phase: "first_day" }],
    });
    const departmental = await createTemplate({
      name: "A department",
      departmentId: department.id,
      steps: [
        { pageId: shared!.id, phase: "first_month" },
        { pageId: onlyB!.id, phase: "first_month" },
      ],
    });

    const result = await assignTemplates(adminActor, {
      userId: employee.id,
      templateIds: [departmental.id, companyWide.id, companyWide.id],
    });

    expect(result.addedSteps).toBe(2);
    const steps = await planOf(employee.id);
    const sharedStep = steps.find((s) => s.pageId === shared!.id);
    expect(sharedStep?.phase).toBe("first_day");
    expect(sharedStep?.sourceTemplateId).toBe(companyWide.id);
    expect(steps.find((s) => s.pageId === onlyB!.id)?.sourceTemplateId).toBe(departmental.id);
  });

  it("skips archived pages", async () => {
    const { adminActor, employee } = await orgFixture();
    const live = await createPage({ status: "published" });
    const archived = await createPage({ status: "archived" });
    const template = await createTemplate({
      steps: [
        { pageId: archived.id, phase: "first_day" },
        { pageId: live.id, phase: "first_day" },
      ],
    });
    const result = await assignTemplates(adminActor, {
      userId: employee.id,
      templateIds: [template.id],
    });
    expect(result.addedSteps).toBe(1);
    expect((await planOf(employee.id)).map((s) => s.pageId)).toEqual([live.id]);
  });

  it("rejects an archived or unknown template and assigns nothing", async () => {
    const { adminActor, employee } = await orgFixture();
    const [page] = await publishedPages(1);
    const active = await createTemplate({ steps: [{ pageId: page!.id, phase: "first_day" }] });
    const archived = await createTemplate({ status: "archived" });

    const error = await expectCode(
      assignTemplates(adminActor, { userId: employee.id, templateIds: [active.id, archived.id] }),
      "VALIDATION",
    );
    expect(isAppError(error) && error.details?.reasonKey).toBe("plan.errors.templateNotAssignable");
    await expectCode(
      assignTemplates(adminActor, {
        userId: employee.id,
        templateIds: ["00000000-0000-4000-8000-000000000000"],
      }),
      "VALIDATION",
    );
    expect(await planOf(employee.id)).toHaveLength(0);
    expect(await testDb.select().from(userTemplateAssignments)).toHaveLength(0);
  });

  it("notifies step_added only when a published page was added", async () => {
    const { adminActor, employee } = await orgFixture();
    const draft = await createPage({ status: "draft" });
    const published = await createPage({ status: "published" });
    const draftOnly = await createTemplate({ steps: [{ pageId: draft.id, phase: "first_day" }] });
    const mixed = await createTemplate({ steps: [{ pageId: published.id, phase: "first_day" }] });

    await assignTemplates(adminActor, { userId: employee.id, templateIds: [draftOnly.id] });
    expect(await notificationsOf(employee.id, "step_added")).toHaveLength(0);

    await assignTemplates(adminActor, { userId: employee.id, templateIds: [mixed.id] });
    expect(await notificationsOf(employee.id, "step_added")).toHaveLength(1);
  });

  it("re-assigning inserts only the missing steps and refreshes the assignment", async () => {
    const { adminActor, employee } = await orgFixture();
    const [a, b] = await publishedPages(2);
    const template = await createTemplate({ steps: [{ pageId: a!.id, phase: "first_day" }] });
    await assignTemplates(adminActor, { userId: employee.id, templateIds: [template.id] });
    await testDb
      .insert(templateSteps)
      .values({ templateId: template.id, pageId: b!.id, phase: "first_day", sortOrder: 1 });

    const again = await assignTemplates(adminActor, {
      userId: employee.id,
      templateIds: [template.id],
    });

    expect(again.addedSteps).toBe(1);
    const steps = await planOf(employee.id);
    expect(steps.map((s) => s.sortOrder).sort()).toEqual([0, 1]);
    expect(await testDb.select().from(userTemplateAssignments)).toHaveLength(1);
  });
});

describe("listAssignableTemplates", () => {
  it("suggests templates matching department, team and job role", async () => {
    const department = await createDepartment();
    const team = await createTeam({ departmentId: department.id });
    const otherTeam = await createTeam({ departmentId: department.id });
    const otherDepartment = await createDepartment();
    const role = await createJobRole();
    const otherRole = await createJobRole();
    const admin = await createEmployee({ teamId: team.id, jobRoleId: role.id });
    const { adminActor } = await orgFixture();

    const all = await createTemplate({ name: "All" });
    const dept = await createTemplate({ name: "Dept", departmentId: department.id });
    const matchTeam = await createTemplate({
      name: "Team",
      departmentId: department.id,
      teamId: team.id,
    });
    const matchRole = await createTemplate({
      name: "Role",
      departmentId: department.id,
      jobRoleId: role.id,
    });
    const wrongTeam = await createTemplate({
      name: "Other team",
      departmentId: department.id,
      teamId: otherTeam.id,
    });
    const wrongDept = await createTemplate({
      name: "Other dept",
      departmentId: otherDepartment.id,
    });
    const wrongRole = await createTemplate({ name: "Other role", jobRoleId: otherRole.id });
    await createTemplate({ name: "Archived", status: "archived" });

    const list = await listAssignableTemplates(adminActor, { userId: admin.id });

    const suggested = new Map(list.map((t) => [t.id, t.suggested]));
    expect(list).toHaveLength(7);
    expect([all, dept, matchTeam, matchRole].map((t) => suggested.get(t.id))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect([wrongTeam, wrongDept, wrongRole].map((t) => suggested.get(t.id))).toEqual([
      false,
      false,
      false,
    ]);
    expect(list.find((t) => t.id === matchTeam.id)?.scope.team).toBeTruthy();
  });
});

describe("plan management authorization", () => {
  it("team lead on a foreign employee gets NOT_FOUND everywhere", async () => {
    const { leadActor } = await orgFixture();
    const foreign = await createEmployee();
    const [page] = await publishedPages(1);
    const template = await createTemplate({ steps: [{ pageId: page!.id, phase: "first_day" }] });
    await planWith(foreign.id, [page!.id]);
    const userId = foreign.id;

    await expectCode(getPlanForUser(leadActor, { userId }), "NOT_FOUND");
    await expectCode(listAssignableTemplates(leadActor, { userId }), "NOT_FOUND");
    await expectCode(listAddablePages(leadActor, { userId }), "NOT_FOUND");
    await expectCode(
      assignTemplates(leadActor, { userId, templateIds: [template.id] }),
      "NOT_FOUND",
    );
    await expectCode(
      addPlanStep(leadActor, { userId, pageId: page!.id, phase: "first_day" }),
      "NOT_FOUND",
    );
    await expectCode(removePlanStep(leadActor, { userId, pageId: page!.id }), "NOT_FOUND");
    expect(await planOf(foreign.id)).toHaveLength(1);
  });

  it("addPlanStep waits for a concurrent status change of the page and then sees it", async () => {
    const { adminActor, employee } = await orgFixture();
    const [page] = await publishedPages(1);
    let settled = false;
    let adding: Promise<unknown> = Promise.resolve();
    await testDb.transaction(async (tx) => {
      await tx.update(pages).set({ status: "draft" }).where(eq(pages.id, page!.id));
      adding = addPlanStep(adminActor, {
        userId: employee.id,
        pageId: page!.id,
        phase: "first_day",
      }).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(settled).toBe(false);
    });
    await expectCode(adding, "VALIDATION");
    expect(await planOf(employee.id)).toHaveLength(0);
  });

  it("a lead may manage their own employee", async () => {
    const { leadActor, employee } = await orgFixture();
    const [page] = await publishedPages(1);
    await addPlanStep(leadActor, { userId: employee.id, pageId: page!.id, phase: "first_day" });
    expect(await planOf(employee.id)).toHaveLength(1);
    const view = await getPlanForUser(leadActor, { userId: employee.id });
    expect(view.canManage).toBe(true);
  });

  it("employees are FORBIDDEN, unknown users NOT_FOUND, archived targets INVALID_TRANSITION", async () => {
    const { adminActor, employeeActor, employee } = await orgFixture();
    const [page] = await publishedPages(1);
    const userId = employee.id;
    await expectCode(listAddablePages(employeeActor, { userId }), "FORBIDDEN");
    await expectCode(getPlanForUser(employeeActor, { userId }), "FORBIDDEN");
    await expectCode(
      addPlanStep(employeeActor, { userId, pageId: page!.id, phase: "first_day" }),
      "FORBIDDEN",
    );
    await expectCode(
      listAddablePages(adminActor, { userId: "00000000-0000-4000-8000-000000000000" }),
      "NOT_FOUND",
    );
    const archived = await createEmployee({ onboardingStatus: "archived" });
    await expectCode(
      addPlanStep(adminActor, { userId: archived.id, pageId: page!.id, phase: "first_day" }),
      "INVALID_TRANSITION",
    );
  });

  it("a lead whose lead is someone else cannot be managed by a peer lead", async () => {
    const { leadActor, admin } = await orgFixture();
    const otherLead = await createLead({ leadId: admin.id });
    const [page] = await publishedPages(1);
    await expectCode(
      addPlanStep(leadActor, { userId: otherLead.id, pageId: page!.id, phase: "first_day" }),
      "NOT_FOUND",
    );
  });
});

describe("addPlanStep / removePlanStep", () => {
  it("rejects draft, archived and unknown pages with VALIDATION", async () => {
    const { adminActor, employee } = await orgFixture();
    const draft = await createPage({ status: "draft" });
    const archived = await createPage({ status: "archived" });
    for (const pageId of [draft.id, archived.id, "00000000-0000-4000-8000-000000000000"]) {
      const error = await expectCode(
        addPlanStep(adminActor, { userId: employee.id, pageId, phase: "first_day" }),
        "VALIDATION",
      );
      expect(isAppError(error) && error.details?.reasonKey).toBe("plan.errors.pageNotPublished");
    }
  });

  it("appends to the phase, notifies, and rejects a duplicate with CONFLICT", async () => {
    const { adminActor, employee } = await orgFixture();
    const [a, b] = await publishedPages(2);
    await addPlanStep(adminActor, { userId: employee.id, pageId: a!.id, phase: "first_day" });
    await addPlanStep(adminActor, { userId: employee.id, pageId: b!.id, phase: "first_day" });
    const steps = await planOf(employee.id);
    expect(steps.map((s) => s.sortOrder).sort()).toEqual([0, 1]);
    expect(steps.every((s) => s.sourceTemplateId === null)).toBe(true);
    expect(await notificationsOf(employee.id, "step_added")).toHaveLength(1);
    await expectCode(
      addPlanStep(adminActor, { userId: employee.id, pageId: a!.id, phase: "first_week" }),
      "CONFLICT",
    );
  });

  it("keeps the completion when a step is removed and shows it again when re-added", async () => {
    const { adminActor, employee } = await orgFixture();
    const [a, b] = await publishedPages(2);
    await planWith(employee.id, [a!.id, b!.id]);
    await completePage(employee.id, a!.id);

    await removePlanStep(adminActor, { userId: employee.id, pageId: a!.id });
    expect(await planOf(employee.id)).toHaveLength(1);
    await addPlanStep(adminActor, { userId: employee.id, pageId: a!.id, phase: "first_day" });

    const plan = await getMyPlan(actorOf(employee));
    const step = plan.phases.flatMap((p) => p.steps).find((s) => s.pageId === a!.id);
    expect(step?.completedAt).toBeInstanceOf(Date);
    expect(plan.progress.percent).toBe(50);
  });

  it("removing an unknown step is NOT_FOUND", async () => {
    const { adminActor, employee } = await orgFixture();
    const [page] = await publishedPages(1);
    await expectCode(
      removePlanStep(adminActor, { userId: employee.id, pageId: page!.id }),
      "NOT_FOUND",
    );
  });

  it("removing the last open step completes the onboarding", async () => {
    const { adminActor, employee } = await orgFixture();
    const [a, b] = await publishedPages(2);
    await planWith(employee.id, [a!.id, b!.id]);
    await completePage(employee.id, a!.id);
    await removePlanStep(adminActor, { userId: employee.id, pageId: b!.id });
    expect((await statusOf(employee.id))?.onboardingStatus).toBe("completed");
  });
});

describe("getMyPlan and getPlanForUser", () => {
  it("shows an empty plan as no phases, and ignores draft and archived steps", async () => {
    const { employee, employeeActor } = await orgFixture();
    expect((await getMyPlan(employeeActor)).phases).toEqual([]);
    const draft = await createPage({ status: "draft" });
    const archived = await createPage({ status: "archived" });
    const [live] = await publishedPages(1);
    await planWith(employee.id, [draft.id, archived.id, live!.id]);

    const plan = await getMyPlan(employeeActor);
    expect(plan.phases.flatMap((p) => p.steps.map((s) => s.pageId))).toEqual([live!.id]);
    expect(plan.progress).toMatchObject({ total: 1, completed: 0, percent: 0 });
  });

  it("flags updated pages and falls back to German for English viewers", async () => {
    const { employee } = await orgFixture();
    const [page] = await publishedPages(1);
    await planWith(employee.id, [page!.id]);
    await completePage(employee.id, page!.id, new Date(Date.now() - 60_000));
    const english = { ...actorOf(employee), locale: "en" as const };

    const plan = await getMyPlan(english);
    const step = plan.phases[0]!.steps[0]!;
    expect(step.updatedSinceCompletion).toBe(true);
    expect(step.isFallback).toBe(true);
    expect(step.title).toBe(page!.titleDe);
  });

  it("shows leads draft steps as a status flag without title, admins with title", async () => {
    const { adminActor, leadActor, employee } = await orgFixture();
    const draft = await createPage({ status: "draft", titleDe: "Geheim" });
    const [live] = await publishedPages(1);
    await planWith(employee.id, [draft.id, live!.id]);

    const forLead = await getPlanForUser(leadActor, { userId: employee.id });
    const leadDraft = forLead.modules.flatMap((m) => m.steps).find((s) => s.pageId === draft.id);
    expect(leadDraft).toMatchObject({ title: null, pageStatus: "draft", isActive: false });
    const forAdmin = await getPlanForUser(adminActor, { userId: employee.id });
    const adminDraft = forAdmin.modules.flatMap((m) => m.steps).find((s) => s.pageId === draft.id);
    expect(adminDraft).toMatchObject({ title: "Geheim", pageStatus: "draft", isActive: false });
    expect(forAdmin.progress.total).toBe(1);
  });

  it("groups by module with done/open counts and lists assigned templates", async () => {
    const { adminActor, employee } = await orgFixture();
    const [a, b] = await publishedPages(2);
    const template = await createTemplate({
      steps: [
        { pageId: a!.id, phase: "first_day" },
        { pageId: b!.id, phase: "first_week" },
      ],
    });
    await assignTemplates(adminActor, { userId: employee.id, templateIds: [template.id] });
    await completePage(employee.id, a!.id);

    const view = await getPlanForUser(adminActor, { userId: employee.id });
    expect(view.modules).toHaveLength(2);
    expect(view.modules.map((m) => [m.completed, m.total]).sort()).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(view.assignedTemplates.map((t) => t.templateId)).toEqual([template.id]);
    expect(view.phases.map((p) => p.phase)).toEqual(["first_day", "first_week"]);
    expect(view.progress.lastActivityAt).toBeInstanceOf(Date);
  });
});
