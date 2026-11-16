import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { templateSteps, templates, userTemplateAssignments } from "@/server/db/schema";
import {
  addTemplateStep,
  archiveTemplate,
  changeTemplateStepPhase,
  createTemplate,
  deleteTemplate,
  getTemplate,
  getTemplateDeletionImpact,
  listTemplateOptions,
  listTemplates,
  moveTemplateStep,
  removeTemplateStep,
  restoreTemplate,
  updateTemplate,
} from "@/server/services/templates";
import * as factories from "../../factories";
import { testDb } from "../../helpers";
import { leadFixture } from "../content/lead-fixtures";

async function stepOf(
  templateId: string,
  pageId: string,
  phase: "first_day" | "first_week" | "first_month" = "first_day",
) {
  const [step] = await testDb
    .insert(templateSteps)
    .values({ templateId, pageId, phase })
    .returning();
  if (!step) throw new Error("step not created");
  return step;
}

async function leadTemplate(
  f: Awaited<ReturnType<typeof leadFixture>>,
  overrides: Partial<typeof templates.$inferInsert> = {},
) {
  return factories.createTemplate({
    departmentId: f.departmentA.id,
    teamId: null,
    leadManaged: true,
    ...overrides,
  });
}

describe("lead createTemplate", () => {
  it("forces the lead's department, marks the template lead-managed and allows an own team", async () => {
    const f = await leadFixture();
    const { id } = await createTemplate(f.leadA, {
      name: "Lead plan",
      departmentId: f.departmentA.id,
      teamId: f.teamA.id,
    });
    const detail = await getTemplate(f.leadA, { id });
    expect(detail).toMatchObject({
      departmentId: f.departmentA.id,
      teamId: f.teamA.id,
      leadManaged: true,
      canManage: true,
    });
  });

  it("rejects another department, 'all' and a lead without a team", async () => {
    const f = await leadFixture();
    for (const departmentId of [f.departmentB.id, "all"]) {
      await expect(createTemplate(f.leadA, { name: "X", departmentId })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    await expect(
      createTemplate(f.teamless, { name: "X", departmentId: f.departmentA.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await testDb.select().from(templates)).toHaveLength(0);
  });

  it("validates the team (must belong to the department) and the job role fit", async () => {
    const f = await leadFixture();
    await expect(
      createTemplate(f.leadA, { name: "X", departmentId: f.departmentA.id, teamId: f.teamB.id }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const foreignRole = await factories.createJobRole({ departmentId: f.departmentB.id });
    await expect(
      createTemplate(f.leadA, {
        name: "X",
        departmentId: f.departmentA.id,
        jobRoleId: foreignRole.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const companyRole = await factories.createJobRole({ departmentId: null });
    const ownRole = await factories.createJobRole({ departmentId: f.departmentA.id });
    for (const role of [companyRole, ownRole]) {
      await createTemplate(f.leadA, {
        name: `Role ${role.id}`,
        departmentId: f.departmentA.id,
        jobRoleId: role.id,
      });
    }
  });

  it("admin creations are not lead-managed", async () => {
    const f = await leadFixture();
    const { id } = await createTemplate(f.admin, { name: "Admin", departmentId: "all" });
    expect(await getTemplate(f.admin, { id })).toMatchObject({
      leadManaged: false,
      canManage: true,
    });
  });
});

describe("lead manages templates", () => {
  it("updates a lead-managed template of the own department, but not its department", async () => {
    const f = await leadFixture();
    const template = await leadTemplate(f);
    await updateTemplate(f.leadA2, {
      id: template.id,
      name: "Renamed",
      departmentId: f.departmentA.id,
      teamId: f.teamA.id,
    });
    const [row] = await testDb.select().from(templates).where(eq(templates.id, template.id));
    expect(row).toMatchObject({ name: "Renamed", teamId: f.teamA.id, leadManaged: true });
    for (const departmentId of [f.departmentB.id, "all"]) {
      await expect(
        updateTemplate(f.leadA, { id: template.id, name: "Moved", departmentId }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(
      updateTemplate(f.leadA, {
        id: template.id,
        name: "Bad team",
        departmentId: f.departmentA.id,
        teamId: f.teamB.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("archives, restores and deletes an own template; a used one is archived on delete", async () => {
    const f = await leadFixture();
    const template = await leadTemplate(f);
    await archiveTemplate(f.leadA, { id: template.id });
    expect((await getTemplate(f.leadA, { id: template.id })).status).toBe("archived");
    await restoreTemplate(f.leadA, { id: template.id });
    expect((await getTemplate(f.leadA, { id: template.id })).status).toBe("active");
    expect(await getTemplateDeletionImpact(f.leadA, { id: template.id })).toMatchObject({
      used: false,
    });
    await expect(deleteTemplate(f.leadA, { id: template.id })).resolves.toEqual({
      result: "deleted",
    });
    const used = await leadTemplate(f, { name: "Used" });
    await testDb
      .insert(userTemplateAssignments)
      .values({ userId: f.employee.id, templateId: used.id, assignedBy: f.admin.id });
    await expect(deleteTemplate(f.leadA, { id: used.id })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(deleteTemplate(f.leadA, { id: used.id, confirmName: "Used" })).resolves.toEqual({
      result: "archived",
    });
  });

  it("manages steps of an own lead-managed template", async () => {
    const f = await leadFixture();
    const template = await leadTemplate(f);
    const first = await addTemplateStep(f.leadA, {
      templateId: template.id,
      pageId: f.a.published.id,
      phase: "first_day",
    });
    const second = await addTemplateStep(f.leadA, {
      templateId: template.id,
      pageId: f.b.published.id,
      phase: "first_day",
    });
    await moveTemplateStep(f.leadA, { stepId: second.id, direction: "up" });
    await changeTemplateStepPhase(f.leadA, { stepId: first.id, phase: "first_week" });
    const detail = await getTemplate(f.leadA, { id: template.id });
    expect(detail.phases.find((p) => p.phase === "first_day")?.steps.map((s) => s.id)).toEqual([
      second.id,
    ]);
    await removeTemplateStep(f.leadA, { stepId: second.id });
    expect((await getTemplate(f.leadA, { id: template.id })).stepCount).toBe(1);
  });

  it("answers FORBIDDEN for visible templates that are not manageable and NOT_FOUND for others", async () => {
    const f = await leadFixture();
    const adminOwned = await factories.createTemplate({ departmentId: f.departmentA.id });
    const companyWide = await factories.createTemplate({ departmentId: null });
    const foreign = await factories.createTemplate({
      departmentId: f.departmentB.id,
      leadManaged: true,
    });
    const page = await factories.createPage({ status: "published" });
    const steps = await Promise.all(
      [adminOwned, companyWide, foreign].map((t) => stepOf(t.id, page.id)),
    );
    const calls = (id: string, stepId: string) => [
      () => updateTemplate(f.leadA, { id, name: "X", departmentId: f.departmentA.id }),
      () => archiveTemplate(f.leadA, { id }),
      () => restoreTemplate(f.leadA, { id }),
      () => getTemplateDeletionImpact(f.leadA, { id }),
      () => deleteTemplate(f.leadA, { id }),
      () => addTemplateStep(f.leadA, { templateId: id, pageId: page.id, phase: "first_week" }),
      () => removeTemplateStep(f.leadA, { stepId }),
      () => moveTemplateStep(f.leadA, { stepId, direction: "down" }),
      () => changeTemplateStepPhase(f.leadA, { stepId, phase: "first_week" }),
    ];
    const expectations = [
      [adminOwned, "FORBIDDEN"],
      [companyWide, "FORBIDDEN"],
      [foreign, "NOT_FOUND"],
    ] as const;
    for (const [index, [template, code]] of expectations.entries()) {
      const step = steps[index];
      if (!step) throw new Error("missing step");
      for (const call of calls(template.id, step.id)) {
        await expect(call()).rejects.toMatchObject({ code });
      }
    }
    expect(await testDb.select().from(templateSteps)).toHaveLength(3);
    expect(await testDb.select().from(templates)).toHaveLength(3);
  });

  it("a lead without a team or an employee manages nothing, a lead-managed template is not manageable for another department", async () => {
    const f = await leadFixture();
    const template = await leadTemplate(f);
    await expect(archiveTemplate(f.leadB, { id: template.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(archiveTemplate(f.teamless, { id: template.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(archiveTemplate(f.employee, { id: template.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const companyWide = await factories.createTemplate({ departmentId: null });
    await expect(archiveTemplate(f.teamless, { id: companyWide.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("admin may manage lead-managed templates and keeps lead_managed", async () => {
    const f = await leadFixture();
    const template = await leadTemplate(f);
    await updateTemplate(f.admin, {
      id: template.id,
      name: "By admin",
      departmentId: f.departmentB.id,
    });
    const [row] = await testDb.select().from(templates).where(eq(templates.id, template.id));
    expect(row).toMatchObject({
      name: "By admin",
      departmentId: f.departmentB.id,
      leadManaged: true,
    });
    await archiveTemplate(f.admin, { id: template.id });
    await deleteTemplate(f.admin, { id: template.id });
  });
});

describe("lead step page rules", () => {
  it("accepts published pages of any module and own-department drafts, never archived or foreign drafts", async () => {
    const f = await leadFixture();
    const template = await leadTemplate(f);
    const add = (pageId: string) =>
      addTemplateStep(f.leadA, { templateId: template.id, pageId, phase: "first_day" });
    await add(f.b.published.id);
    await add(f.all.published.id);
    await add(f.a.draft.id);
    await expect(add(f.a.archived.id)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(add(f.b.draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(add(f.b.archived.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(add(f.all.draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getTemplate(f.leadA, { id: template.id })).stepCount).toBe(3);
  });
});

describe("lead template reading", () => {
  it("lists company-wide and own-department templates with canManage, hides other departments", async () => {
    const f = await leadFixture();
    const own = await leadTemplate(f, { name: "Own" });
    const adminOwn = await factories.createTemplate({
      name: "Admin dept",
      departmentId: f.departmentA.id,
    });
    const wide = await factories.createTemplate({ name: "Wide", departmentId: null });
    await factories.createTemplate({ name: "Foreign", departmentId: f.departmentB.id });
    const list = await listTemplates(f.leadA);
    expect(list.map((t) => [t.id, t.canManage, t.leadManaged])).toEqual([
      [adminOwn.id, false, false],
      [own.id, true, true],
      [wide.id, false, false],
    ]);
    expect(list.every((t) => t.name !== "Foreign")).toBe(true);
    const teamless = await listTemplates(f.teamless);
    expect(teamless.map((t) => t.id)).toEqual([wide.id]);
    const all = await listTemplates(f.admin);
    expect(all).toHaveLength(4);
    expect(all.every((t) => t.canManage)).toBe(true);
    expect(await listTemplates(f.leadA, { status: "archived" })).toEqual([]);
  });

  it("getTemplate gives NOT_FOUND outside the view set and read-only access inside it", async () => {
    const f = await leadFixture();
    const foreign = await factories.createTemplate({ departmentId: f.departmentB.id });
    await expect(getTemplate(f.leadA, { id: foreign.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const adminOwn = await factories.createTemplate({ departmentId: f.departmentA.id });
    expect(await getTemplate(f.leadA, { id: adminOwn.id })).toMatchObject({ canManage: false });
    expect(await getTemplate(f.admin, { id: foreign.id })).toMatchObject({ canManage: true });
  });

  it("hides titles of steps whose page the lead cannot view and keeps the status", async () => {
    const f = await leadFixture();
    const wide = await factories.createTemplate({ departmentId: null });
    await stepOf(wide.id, f.a.draft.id);
    await stepOf(wide.id, f.b.draft.id, "first_week");
    await stepOf(wide.id, f.b.published.id, "first_month");
    const detail = await getTemplate(f.leadA, { id: wide.id });
    const byPhase = Object.fromEntries(detail.phases.map((p) => [p.phase, p.steps[0]]));
    expect(byPhase.first_day).toMatchObject({ title: "Mod A draft", pageStatus: "draft" });
    expect(byPhase.first_week).toMatchObject({
      title: null,
      moduleTitle: null,
      pageStatus: "draft",
    });
    expect(byPhase.first_month).toMatchObject({ title: "Mod B published" });
    const adminView = await getTemplate(f.admin, { id: wide.id });
    expect(adminView.phases.find((p) => p.phase === "first_week")?.steps[0]?.title).toBe(
      "Mod B draft",
    );
  });
});

describe("listTemplateOptions", () => {
  it("limits a lead to the own department, its teams and fitting roles", async () => {
    const f = await leadFixture();
    const own = await factories.createJobRole({ departmentId: f.departmentA.id });
    const wide = await factories.createJobRole({ departmentId: null });
    const foreign = await factories.createJobRole({ departmentId: f.departmentB.id });
    const options = await listTemplateOptions(f.leadA);
    expect(options.departments.map((d) => d.id)).toEqual([f.departmentA.id]);
    expect(options.teams.map((t) => t.id)).toEqual([f.teamA.id]);
    const ids = options.jobRoles.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([own.id, wide.id]));
    expect(ids).not.toContain(foreign.id);
    const adminOptions = await listTemplateOptions(f.admin);
    expect(adminOptions.departments).toHaveLength(2);
    expect(adminOptions.jobRoles.map((r) => r.id)).toContain(foreign.id);
    expect(await listTemplateOptions(f.teamless)).toEqual({
      departments: [],
      teams: [],
      jobRoles: [],
    });
    await expect(listTemplateOptions(f.employee)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
