import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { jobRoles } from "@/server/db/schema";
import {
  createJobRole,
  deleteDepartment,
  getDepartmentUsage,
  listJobRoles,
  listOrgOptions,
  updateJobRole,
  updateTeam,
} from "@/server/services/org";
import { createTemplate, updateTemplate } from "@/server/services/templates";
import { createUser, updateUser } from "@/server/services/users";
import type { UpdateUserInput } from "@/lib/validation/users";
import * as factories from "../../factories";
import { actorOf, testDb } from "../../helpers";

async function admin() {
  return actorOf(await factories.createAdmin());
}

const NOT_FITTING = { fieldErrors: { jobRoleId: ["org.errors.jobRoleNotInDepartment"] } };

describe("job roles bound to a department", () => {
  it("creates and updates roles with and without a department", async () => {
    const actor = await admin();
    const department = await factories.createDepartment({ name: "IT" });
    const bound = await createJobRole(actor, { name: "Dev", departmentId: department.id });
    const wide = await createJobRole(actor, { name: "Intern", departmentId: null });

    const list = await listJobRoles(actor);
    expect(list.find((r) => r.id === bound.id)).toMatchObject({
      departmentId: department.id,
      departmentName: "IT",
    });
    expect(list.find((r) => r.id === wide.id)).toMatchObject({
      departmentId: null,
      departmentName: null,
    });

    await updateJobRole(actor, { id: bound.id, name: "Developer", departmentId: department.id });
    await updateJobRole(actor, { id: bound.id, name: "Developer", departmentId: null });
    const [row] = await testDb.select().from(jobRoles).where(eq(jobRoles.id, bound.id));
    expect(row).toMatchObject({ name: "Developer", departmentId: null });
  });

  it("lists company-wide roles first, then by department name and role name", async () => {
    const actor = await admin();
    const b = await factories.createDepartment({ name: "B-Dept" });
    const a = await factories.createDepartment({ name: "A-Dept" });
    await createJobRole(actor, { name: "Z", departmentId: b.id });
    await createJobRole(actor, { name: "Y", departmentId: a.id });
    await createJobRole(actor, { name: "X", departmentId: a.id });
    await createJobRole(actor, { name: "W", departmentId: null });
    const list = await listJobRoles(actor);
    expect(list.map((r) => r.name)).toEqual(["W", "X", "Y", "Z"]);
  });

  it("answers NOT_FOUND for an unknown department", async () => {
    const actor = await admin();
    await expect(
      createJobRole(actor, { name: "X", departmentId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows the same name in two departments but not twice in one or twice company-wide", async () => {
    const actor = await admin();
    const a = await factories.createDepartment();
    const b = await factories.createDepartment();
    await createJobRole(actor, { name: "Lead", departmentId: a.id });
    await createJobRole(actor, { name: "Lead", departmentId: b.id });
    await createJobRole(actor, { name: "Lead", departmentId: null });
    for (const departmentId of [a.id, null]) {
      await expect(createJobRole(actor, { name: "Lead", departmentId })).rejects.toMatchObject({
        code: "CONFLICT",
        details: { reasonKey: "org.errors.nameTaken" },
      });
    }
    const other = await createJobRole(actor, { name: "Other", departmentId: a.id });
    await expect(
      updateJobRole(actor, { id: other.id, name: "Lead", departmentId: a.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("returns departmentId on listOrgOptions job roles", async () => {
    const department = await factories.createDepartment();
    const bound = await factories.createJobRole({ departmentId: department.id });
    const wide = await factories.createJobRole();
    const options = await listOrgOptions(actorOf(await factories.createLead()));
    expect(options.jobRoles.find((r) => r.id === bound.id)?.departmentId).toBe(department.id);
    expect(options.jobRoles.find((r) => r.id === wide.id)?.departmentId).toBeNull();
  });
});

describe("changing the department of a role", () => {
  it("is rejected with IN_USE listing mismatching templates and users", async () => {
    const actor = await admin();
    const it = await factories.createDepartment();
    const hr = await factories.createDepartment();
    const role = await factories.createJobRole();
    const itTeam = await factories.createTeam({ departmentId: it.id });
    const hrTeam = await factories.createTeam({ departmentId: hr.id });
    const lead = await factories.createLead();
    const stays = await factories.createEmployee({
      teamId: itTeam.id,
      jobRoleId: role.id,
      leadId: lead.id,
    });
    const leaves = await factories.createEmployee({
      teamId: hrTeam.id,
      jobRoleId: role.id,
      leadId: lead.id,
    });
    const teamless = await factories.createUser({ jobRoleId: role.id });
    const fitting = await factories.createTemplate({ departmentId: it.id, jobRoleId: role.id });
    const foreign = await factories.createTemplate({ departmentId: hr.id, jobRoleId: role.id });
    const wide = await factories.createTemplate({ departmentId: null, jobRoleId: role.id });

    const error = await updateJobRole(actor, {
      id: role.id,
      name: "R",
      departmentId: it.id,
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "IN_USE" });
    const details = (error as { details: { users: { id: string }[]; templates: { id: string }[] } })
      .details;
    expect(details.users.map((u) => u.id).sort()).toEqual([leaves.id, teamless.id].sort());
    expect(details.templates.map((t) => t.id).sort()).toEqual([foreign.id, wide.id].sort());
    expect(details.users.map((u) => u.id)).not.toContain(stays.id);
    expect(details.templates.map((t) => t.id)).not.toContain(fitting.id);

    const [row] = await testDb.select().from(jobRoles).where(eq(jobRoles.id, role.id));
    expect(row?.departmentId).toBeNull();
  });

  it("succeeds when every user and template fits, and to null even when in use", async () => {
    const actor = await admin();
    const department = await factories.createDepartment();
    const team = await factories.createTeam({ departmentId: department.id });
    const role = await factories.createJobRole();
    await factories.createEmployee({ teamId: team.id, jobRoleId: role.id });
    await factories.createTemplate({ departmentId: department.id, jobRoleId: role.id });

    await updateJobRole(actor, { id: role.id, name: "R", departmentId: department.id });
    // Bound to the department now; other departments' usage is irrelevant when going company-wide.
    await updateJobRole(actor, { id: role.id, name: "R", departmentId: null });
    const [row] = await testDb.select().from(jobRoles).where(eq(jobRoles.id, role.id));
    expect(row?.departmentId).toBeNull();
  });
});

describe("departments and teams with bound roles", () => {
  it("counts job roles of a department as usage and blocks deletion", async () => {
    const actor = await admin();
    const department = await factories.createDepartment();
    const role = await factories.createJobRole({ departmentId: department.id });

    const usage = await getDepartmentUsage(actor, { id: department.id });
    expect(usage.used).toBe(true);
    expect(usage.jobRoles).toEqual([{ id: role.id, name: role.name }]);
    await expect(deleteDepartment(actor, { id: department.id })).rejects.toMatchObject({
      code: "IN_USE",
      details: { jobRoles: [{ id: role.id, name: role.name }] },
    });

    await testDb.delete(jobRoles).where(eq(jobRoles.id, role.id));
    await deleteDepartment(actor, { id: department.id });
  });

  it("refuses to move a team whose users hold roles bound to the old department", async () => {
    const actor = await admin();
    const from = await factories.createDepartment();
    const to = await factories.createDepartment();
    const team = await factories.createTeam({ departmentId: from.id });
    const role = await factories.createJobRole({ departmentId: from.id });
    const member = await factories.createEmployee({ teamId: team.id, jobRoleId: role.id });

    await expect(
      updateTeam(actor, { id: team.id, name: team.name, departmentId: to.id }),
    ).rejects.toMatchObject({
      code: "IN_USE",
      details: {
        reasonKey: "org.errors.teamHasRoleBoundUsers",
        users: [{ id: member.id }],
      },
    });
  });

  it("moves a team whose users only hold company-wide roles", async () => {
    const actor = await admin();
    const to = await factories.createDepartment();
    const team = await factories.createTeam();
    await factories.createEmployee({ teamId: team.id });
    await updateTeam(actor, { id: team.id, name: team.name, departmentId: to.id });
  });
});

describe("templates and job roles", () => {
  it("rejects a foreign-department role and a department role on an 'all' template", async () => {
    const actor = await admin();
    const it = await factories.createDepartment();
    const hr = await factories.createDepartment();
    const hrRole = await factories.createJobRole({ departmentId: hr.id });

    await expect(
      createTemplate(actor, { name: "T", departmentId: it.id, jobRoleId: hrRole.id }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: NOT_FITTING });
    await expect(
      createTemplate(actor, { name: "T", departmentId: "all", jobRoleId: hrRole.id }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: NOT_FITTING });

    const existing = await factories.createTemplate({ departmentId: it.id });
    await expect(
      updateTemplate(actor, {
        id: existing.id,
        name: "T",
        departmentId: it.id,
        jobRoleId: hrRole.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: NOT_FITTING });
    await expect(
      updateTemplate(actor, {
        id: existing.id,
        name: "T",
        departmentId: "all",
        jobRoleId: hrRole.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: NOT_FITTING });
  });

  it("accepts own-department and company-wide roles", async () => {
    const actor = await admin();
    const department = await factories.createDepartment();
    const own = await factories.createJobRole({ departmentId: department.id });
    const wide = await factories.createJobRole();

    await createTemplate(actor, { name: "A", departmentId: department.id, jobRoleId: own.id });
    await createTemplate(actor, { name: "B", departmentId: department.id, jobRoleId: wide.id });
    await createTemplate(actor, { name: "C", departmentId: "all", jobRoleId: wide.id });
    const existing = await factories.createTemplate({ departmentId: department.id });
    await updateTemplate(actor, {
      id: existing.id,
      name: "D",
      departmentId: department.id,
      jobRoleId: own.id,
    });
  });

  it("keeps answering NOT_FOUND for an unknown role", async () => {
    await expect(
      createTemplate(await admin(), {
        name: "T",
        departmentId: "all",
        jobRoleId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("users and job roles", () => {
  async function setup() {
    const it = await factories.createDepartment();
    const hr = await factories.createDepartment();
    const itTeam = await factories.createTeam({ departmentId: it.id });
    const hrTeam = await factories.createTeam({ departmentId: hr.id });
    const itRole = await factories.createJobRole({ departmentId: it.id });
    const wide = await factories.createJobRole();
    const lead = await factories.createLead();
    return { itTeam, hrTeam, itRole, wide, lead };
  }

  const base = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.test",
    role: "employee",
    startDate: "2026-12-01",
    locale: "en",
  } as const;

  it("rejects creating a user with a role that does not fit the team's department", async () => {
    const { hrTeam, itTeam, itRole, wide, lead } = await setup();
    const actor = await admin();
    await expect(
      createUser(actor, { ...base, teamId: hrTeam.id, jobRoleId: itRole.id, leadId: lead.id }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: NOT_FITTING });
    await expect(
      createUser(actor, {
        ...base,
        role: "admin",
        teamId: null,
        jobRoleId: itRole.id,
        leadId: null,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: NOT_FITTING });

    await createUser(actor, { ...base, teamId: itTeam.id, jobRoleId: itRole.id, leadId: lead.id });
    await createUser(actor, {
      ...base,
      email: "b@example.test",
      teamId: hrTeam.id,
      jobRoleId: wide.id,
      leadId: lead.id,
    });
  });

  it("rejects updating a user into a team or role that does not fit", async () => {
    const { hrTeam, itTeam, itRole, wide, lead } = await setup();
    const actor = await admin();
    const user = await factories.createEmployee({
      teamId: itTeam.id,
      jobRoleId: itRole.id,
      leadId: lead.id,
    });
    const input = (overrides: Partial<UpdateUserInput>): UpdateUserInput => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: "employee",
      teamId: itTeam.id,
      jobRoleId: itRole.id,
      leadId: lead.id,
      startDate: "2026-03-01",
      locale: "en",
      ...overrides,
    });

    await expect(updateUser(actor, input({ teamId: hrTeam.id }))).rejects.toMatchObject({
      code: "VALIDATION",
      details: NOT_FITTING,
    });
    await expect(
      updateUser(actor, input({ role: "admin", teamId: null, leadId: null })),
    ).rejects.toMatchObject({ code: "VALIDATION", details: NOT_FITTING });
    await updateUser(actor, input({ teamId: hrTeam.id, jobRoleId: wide.id }));
    await expect(
      updateUser(actor, input({ teamId: hrTeam.id, jobRoleId: itRole.id })),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      details: NOT_FITTING,
    });
  });
});
