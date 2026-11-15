import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { templateSteps, templates, userTemplateAssignments } from "@/server/db/schema";
import {
  addTemplateStep,
  archiveTemplate,
  changeTemplateStepPhase,
  createTemplate,
  deleteTemplate,
  getTemplate,
  getTemplateDeletionImpact,
  listTemplates,
  moveTemplateStep,
  removeTemplateStep,
  restoreTemplate,
  updateTemplate,
} from "@/server/services/templates";
import * as factories from "../../factories";
import { actorOf, testDb } from "../../helpers";

async function admin() {
  return actorOf(await factories.createAdmin());
}

async function stepIds(
  templateId: string,
  phase: "before_start" | "first_day" | "first_week" | "first_month",
) {
  const detail = await getTemplate(await admin(), { id: templateId });
  return detail.phases.find((entry) => entry.phase === phase)?.steps.map((step) => step.id) ?? [];
}

describe("template CRUD", () => {
  it("creates a company-wide template with department 'all' stored as null", async () => {
    const actor = await admin();
    const { id } = await createTemplate(actor, { name: " Alle ", departmentId: "all" });
    const detail = await getTemplate(actor, { id });
    expect(detail).toMatchObject({
      name: "Alle",
      departmentId: null,
      departmentName: null,
      teamId: null,
      jobRoleId: null,
      status: "active",
    });
    expect(detail.phases.map((entry) => entry.phase)).toEqual([
      "before_start",
      "first_day",
      "first_week",
      "first_month",
    ]);
  });

  it("rejects a missing department with a validation error (runAction maps it to VALIDATION)", async () => {
    const actor = await admin();
    const existing = await factories.createTemplate();
    // @ts-expect-error departmentId is required on purpose (K§5)
    await expect(createTemplate(actor, { name: "X" })).rejects.toBeInstanceOf(ZodError);
    await expect(
      // @ts-expect-error departmentId is required on purpose (K§5)
      updateTemplate(actor, { id: existing.id, name: "X" }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await testDb.select().from(templates)).toHaveLength(1);
  });

  it("creates with department, team and job role and joins their names", async () => {
    const actor = await admin();
    const department = await factories.createDepartment();
    const team = await factories.createTeam({ departmentId: department.id });
    const role = await factories.createJobRole();
    const { id } = await createTemplate(actor, {
      name: "IT",
      description: "Desc",
      departmentId: department.id,
      teamId: team.id,
      jobRoleId: role.id,
    });
    const [item] = await listTemplates(actor);
    expect(item).toMatchObject({
      id,
      departmentName: department.name,
      teamName: team.name,
      jobRoleName: role.name,
      description: "Desc",
      stepCount: 0,
      assignmentCount: 0,
    });
  });

  it("rejects a team of another department or combined with 'all'", async () => {
    const actor = await admin();
    const department = await factories.createDepartment();
    const otherTeam = await factories.createTeam();
    await expect(
      createTemplate(actor, { name: "X", departmentId: department.id, teamId: otherTeam.id }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      details: { reasonKey: "templates.errors.teamNotInDepartment" },
    });
    await expect(
      createTemplate(actor, { name: "X", departmentId: "all", teamId: otherTeam.id }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      createTemplate(actor, { name: "X", departmentId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updates scope and enforces the same team rule", async () => {
    const actor = await admin();
    const team = await factories.createTeam();
    const template = await factories.createTemplate();
    await updateTemplate(actor, {
      id: template.id,
      name: "Renamed",
      departmentId: team.departmentId,
      teamId: team.id,
    });
    expect(await getTemplate(actor, { id: template.id })).toMatchObject({
      name: "Renamed",
      departmentId: team.departmentId,
      teamId: team.id,
    });
    await updateTemplate(actor, { id: template.id, name: "Renamed", departmentId: "all" }).catch(
      () => undefined,
    );
    const other = await factories.createDepartment();
    await expect(
      updateTemplate(actor, {
        id: template.id,
        name: "Renamed",
        departmentId: other.id,
        teamId: team.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      updateTemplate(actor, { id: crypto.randomUUID(), name: "X", departmentId: "all" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("filters the list by status and orders by name", async () => {
    const actor = await admin();
    await factories.createTemplate({ name: "B" });
    await factories.createTemplate({ name: "A" });
    await factories.createTemplate({ name: "C", status: "archived" });
    expect((await listTemplates(actor)).map((item) => item.name)).toEqual(["A", "B", "C"]);
    expect((await listTemplates(actor, { status: "active" })).map((item) => item.name)).toEqual([
      "A",
      "B",
    ]);
    expect((await listTemplates(actor, { status: "archived" })).map((item) => item.name)).toEqual([
      "C",
    ]);
  });

  it("getTemplate answers NOT_FOUND for unknown ids", async () => {
    await expect(getTemplate(await admin(), { id: crypto.randomUUID() })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("template steps", () => {
  it("adds steps at the end of their phase and reports page flags in the viewer's language", async () => {
    const actor = actorOf(await factories.createAdmin({ locale: "en" }));
    const template = await factories.createTemplate();
    const first = await factories.createPage({ titleDe: "Eins", status: "published" });
    const second = await factories.createPage({ titleDe: "Zwei", status: "draft" });
    await addTemplateStep(actor, { templateId: template.id, pageId: first.id, phase: "first_day" });
    await addTemplateStep(actor, {
      templateId: template.id,
      pageId: second.id,
      phase: "first_day",
    });
    const detail = await getTemplate(actor, { id: template.id });
    const day = detail.phases.find((entry) => entry.phase === "first_day");
    expect(day?.steps.map((step) => [step.title, step.pageStatus])).toEqual([
      ["Eins", "published"],
      ["Zwei", "draft"],
    ]);
    expect(detail.stepCount).toBe(2);
  });

  it("rejects a duplicate page in a template, but allows it in another template", async () => {
    const actor = await admin();
    const page = await factories.createPage();
    const one = await factories.createTemplate();
    const two = await factories.createTemplate();
    await addTemplateStep(actor, { templateId: one.id, pageId: page.id, phase: "first_day" });
    await expect(
      addTemplateStep(actor, { templateId: one.id, pageId: page.id, phase: "first_week" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reasonKey: "templates.errors.duplicatePage" },
    });
    await addTemplateStep(actor, { templateId: two.id, pageId: page.id, phase: "first_day" });
  });

  it("rejects archived pages, missing pages and missing templates", async () => {
    const actor = await admin();
    const template = await factories.createTemplate();
    const archived = await factories.createPage({ status: "archived" });
    await expect(
      addTemplateStep(actor, { templateId: template.id, pageId: archived.id, phase: "first_day" }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      details: { reasonKey: "templates.errors.pageArchived" },
    });
    await expect(
      addTemplateStep(actor, {
        templateId: template.id,
        pageId: crypto.randomUUID(),
        phase: "first_day",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const page = await factories.createPage();
    await expect(
      addTemplateStep(actor, {
        templateId: crypto.randomUUID(),
        pageId: page.id,
        phase: "first_day",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await testDb.select().from(templateSteps)).toHaveLength(0);
  });

  it("concurrent adds to one phase get distinct sort orders", async () => {
    const actor = await admin();
    const template = await factories.createTemplate();
    const pages = await Promise.all([1, 2, 3, 4].map(() => factories.createPage()));
    await Promise.all(
      pages.map((page) =>
        addTemplateStep(actor, { templateId: template.id, pageId: page.id, phase: "first_week" }),
      ),
    );
    const rows = await testDb
      .select()
      .from(templateSteps)
      .where(eq(templateSteps.templateId, template.id));
    expect(new Set(rows.map((row) => row.sortOrder)).size).toBe(4);
  });

  it("removes a step", async () => {
    const actor = await admin();
    const page = await factories.createPage();
    const template = await factories.createTemplate({
      steps: [{ pageId: page.id, phase: "first_day" }],
    });
    const [stepId] = await stepIds(template.id, "first_day");
    await removeTemplateStep(actor, { stepId: stepId! });
    expect(await stepIds(template.id, "first_day")).toEqual([]);
    await expect(removeTemplateStep(actor, { stepId: stepId! })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("moves a step up and down inside its phase and ignores the edges", async () => {
    const actor = await admin();
    const pages = await Promise.all([1, 2, 3].map(() => factories.createPage()));
    const template = await factories.createTemplate({
      steps: pages.map((page) => ({ pageId: page.id, phase: "first_day" as const })),
    });
    const [a, b, c] = (await stepIds(template.id, "first_day")) as [string, string, string];
    await moveTemplateStep(actor, { stepId: c, direction: "up" });
    expect(await stepIds(template.id, "first_day")).toEqual([a, c, b]);
    await moveTemplateStep(actor, { stepId: a, direction: "down" });
    expect(await stepIds(template.id, "first_day")).toEqual([c, a, b]);
    await moveTemplateStep(actor, { stepId: c, direction: "up" });
    await moveTemplateStep(actor, { stepId: b, direction: "down" });
    expect(await stepIds(template.id, "first_day")).toEqual([c, a, b]);
  });

  it("repairs equal sort orders when moving", async () => {
    const actor = await admin();
    const pages = await Promise.all([1, 2].map(() => factories.createPage()));
    const template = await factories.createTemplate({
      steps: pages.map((page) => ({ pageId: page.id, phase: "first_day" as const })),
    });
    await testDb
      .update(templateSteps)
      .set({ sortOrder: 5 })
      .where(eq(templateSteps.templateId, template.id));
    const [first, second] = await stepIds(template.id, "first_day");
    await moveTemplateStep(actor, { stepId: second!, direction: "up" });
    expect(await stepIds(template.id, "first_day")).toEqual([second, first]);
  });

  it("changes the phase and appends the step to the target phase", async () => {
    const actor = await admin();
    const pages = await Promise.all([1, 2].map(() => factories.createPage()));
    const template = await factories.createTemplate({
      steps: [
        { pageId: pages[0]!.id, phase: "first_day" },
        { pageId: pages[1]!.id, phase: "first_week" },
      ],
    });
    const [dayStep] = await stepIds(template.id, "first_day");
    await changeTemplateStepPhase(actor, { stepId: dayStep!, phase: "first_week" });
    const week = await stepIds(template.id, "first_week");
    expect(week).toHaveLength(2);
    expect(week[1]).toBe(dayStep);
    expect(await stepIds(template.id, "first_day")).toEqual([]);
    await changeTemplateStepPhase(actor, { stepId: dayStep!, phase: "first_week" });
    expect(await stepIds(template.id, "first_week")).toEqual(week);
  });

  it("keeps a page in a template when it was archived later and flags it", async () => {
    const actor = await admin();
    const page = await factories.createPage({ status: "archived" });
    const template = await factories.createTemplate({
      steps: [{ pageId: page.id, phase: "first_day" }],
    });
    const detail = await getTemplate(actor, { id: template.id });
    expect(detail.phases[1]?.steps[0]?.pageStatus).toBe("archived");
  });
});

describe("archive, restore and delete", () => {
  it("archives and restores; archived templates drop out of the active list", async () => {
    const actor = await admin();
    const template = await factories.createTemplate();
    await archiveTemplate(actor, { id: template.id });
    expect(await listTemplates(actor, { status: "active" })).toEqual([]);
    expect((await getTemplate(actor, { id: template.id })).status).toBe("archived");
    await restoreTemplate(actor, { id: template.id });
    expect(await listTemplates(actor, { status: "active" })).toHaveLength(1);
  });

  it("deletes an unused template together with its steps", async () => {
    const actor = await admin();
    const page = await factories.createPage();
    const template = await factories.createTemplate({
      steps: [{ pageId: page.id, phase: "first_day" }],
    });
    expect(await getTemplateDeletionImpact(actor, { id: template.id })).toMatchObject({
      used: false,
      assignmentCount: 0,
    });
    expect(await deleteTemplate(actor, { id: template.id })).toEqual({ result: "deleted" });
    expect(await testDb.select().from(templates)).toHaveLength(0);
    expect(await testDb.select().from(templateSteps)).toHaveLength(0);
  });

  it("archives a used template after the name is confirmed and keeps assignments", async () => {
    const actor = await admin();
    const template = await factories.createTemplate({ name: "Used" });
    const employee = await factories.createEmployee();
    const done = await factories.createEmployee({ onboardingStatus: "archived" });
    await testDb.insert(userTemplateAssignments).values([
      { userId: employee.id, templateId: template.id },
      { userId: done.id, templateId: template.id },
    ]);
    expect(await getTemplateDeletionImpact(actor, { id: template.id })).toMatchObject({
      name: "Used",
      used: true,
      assignmentCount: 2,
      activePlanCount: 1,
    });
    await expect(deleteTemplate(actor, { id: template.id })).rejects.toMatchObject({
      code: "VALIDATION",
      details: { reasonKey: "templates.errors.confirmNameMismatch" },
    });
    await expect(
      deleteTemplate(actor, { id: template.id, confirmName: "wrong" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await testDb.select().from(templates))[0]?.status).toBe("active");
    expect(await deleteTemplate(actor, { id: template.id, confirmName: " Used " })).toEqual({
      result: "archived",
    });
    expect((await testDb.select().from(templates))[0]?.status).toBe("archived");
    expect(await testDb.select().from(userTemplateAssignments)).toHaveLength(2);
  });

  it("answers NOT_FOUND for unknown templates", async () => {
    const actor = await admin();
    const id = crypto.randomUUID();
    await expect(deleteTemplate(actor, { id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(archiveTemplate(actor, { id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getTemplateDeletionImpact(actor, { id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("authorization", () => {
  it("only admins may use any template function", async () => {
    const template = await factories.createTemplate();
    const page = await factories.createPage();
    const [step] = await testDb
      .insert(templateSteps)
      .values({ templateId: template.id, pageId: page.id, phase: "first_day" })
      .returning();
    if (!step) throw new Error("step not created");
    const lead = actorOf(await factories.createLead());
    const employee = actorOf(await factories.createEmployee());
    for (const actor of [lead, employee]) {
      const calls = [
        () => listTemplates(actor),
        () => getTemplate(actor, { id: template.id }),
        () => createTemplate(actor, { name: "X", departmentId: "all" }),
        () => updateTemplate(actor, { id: template.id, name: "X", departmentId: "all" }),
        () => archiveTemplate(actor, { id: template.id }),
        () => restoreTemplate(actor, { id: template.id }),
        () => getTemplateDeletionImpact(actor, { id: template.id }),
        () => deleteTemplate(actor, { id: template.id }),
        () =>
          addTemplateStep(actor, { templateId: template.id, pageId: page.id, phase: "first_day" }),
        () => removeTemplateStep(actor, { stepId: step.id }),
        () => moveTemplateStep(actor, { stepId: step.id, direction: "up" }),
        () => changeTemplateStepPhase(actor, { stepId: step.id, phase: "first_week" }),
      ];
      for (const call of calls) {
        await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    expect(await testDb.select().from(templateSteps)).toHaveLength(1);
  });
});
