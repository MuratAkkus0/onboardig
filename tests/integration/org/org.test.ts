import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { departments, teams } from "@/server/db/schema";
import {
  createDepartment,
  createJobRole,
  createTeam,
  deleteDepartment,
  deleteJobRole,
  deleteTeam,
  getDepartmentUsage,
  getJobRoleUsage,
  getTeamUsage,
  listDepartments,
  listJobRoles,
  listOrgOptions,
  updateDepartment,
  updateJobRole,
  updateTeam,
} from "@/server/services/org";
import * as factories from "../../factories";
import { actorOf, testDb } from "../../helpers";

describe("departments", () => {
  it("creates, renames and lists departments with their teams", async () => {
    const admin = actorOf(await factories.createAdmin());
    const created = await createDepartment(admin, { name: "  IT  " });
    expect(created.name).toBe("IT");
    await createTeam(admin, { departmentId: created.id, name: "Backend" });
    await updateDepartment(admin, { id: created.id, name: "Engineering" });

    const list = await listDepartments(admin);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Engineering" });
    expect(list[0]?.teams).toMatchObject([{ name: "Backend", userCount: 0 }]);
  });

  it("counts people per team", async () => {
    const admin = actorOf(await factories.createAdmin());
    const team = await factories.createTeam();
    const lead = await factories.createLead();
    await factories.createEmployee({ teamId: team.id, leadId: lead.id });
    const list = await listDepartments(admin);
    const teamsOfAll = list.flatMap((department) => department.teams);
    expect(teamsOfAll.find((entry) => entry.id === team.id)?.userCount).toBe(1);
  });

  it("rejects duplicate and blank names", async () => {
    const admin = actorOf(await factories.createAdmin());
    await createDepartment(admin, { name: "IT" });
    await expect(createDepartment(admin, { name: "IT" })).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reasonKey: "org.errors.nameTaken" },
    });
    await expect(createDepartment(admin, { name: "   " })).rejects.toThrow();
    const other = await createDepartment(admin, { name: "HR" });
    await expect(updateDepartment(admin, { id: other.id, name: "IT" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("reports NOT_FOUND for unknown ids", async () => {
    const admin = actorOf(await factories.createAdmin());
    const id = "00000000-0000-4000-8000-000000000000";
    await expect(updateDepartment(admin, { id, name: "X" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteDepartment(admin, { id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getDepartmentUsage(admin, { id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deletes a department whose teams are all empty together with those teams", async () => {
    const admin = actorOf(await factories.createAdmin());
    const department = await factories.createDepartment();
    const a = await factories.createTeam({ departmentId: department.id });
    const b = await factories.createTeam({ departmentId: department.id });

    const usage = await getDepartmentUsage(admin, { id: department.id });
    expect(usage.used).toBe(false);
    expect(usage.emptyTeams.map((team) => team.id).sort()).toEqual([a.id, b.id].sort());

    await deleteDepartment(admin, { id: department.id });
    expect(await testDb.select().from(departments)).toHaveLength(0);
    expect(await testDb.select().from(teams)).toHaveLength(0);
  });

  it("refuses to delete a department with people and lists them, deleting nothing", async () => {
    const admin = actorOf(await factories.createAdmin());
    const department = await factories.createDepartment();
    const used = await factories.createTeam({ departmentId: department.id });
    const empty = await factories.createTeam({ departmentId: department.id });
    const lead = await factories.createLead();
    const person = await factories.createEmployee({
      teamId: used.id,
      leadId: lead.id,
      firstName: "Ada",
      lastName: "Lovelace",
    });

    const usage = await getDepartmentUsage(admin, { id: department.id });
    expect(usage.used).toBe(true);
    expect(usage.users).toEqual([{ id: person.id, name: "Ada Lovelace" }]);
    expect(usage.emptyTeams.map((team) => team.id)).toEqual([empty.id]);

    await expect(deleteDepartment(admin, { id: department.id })).rejects.toMatchObject({
      code: "IN_USE",
      details: { users: [{ id: person.id }] },
    });
    expect(
      await testDb.select().from(teams).where(eq(teams.departmentId, department.id)),
    ).toHaveLength(2);
  });

  it("refuses to delete a department that a template references", async () => {
    const admin = actorOf(await factories.createAdmin());
    const department = await factories.createDepartment();
    const template = await factories.createTemplate({
      name: "Welcome",
      departmentId: department.id,
    });
    await expect(deleteDepartment(admin, { id: department.id })).rejects.toMatchObject({
      code: "IN_USE",
      details: { templates: [{ id: template.id, name: "Welcome" }] },
    });
  });

  it("counts a template on one of its teams as department usage", async () => {
    const admin = actorOf(await factories.createAdmin());
    const team = await factories.createTeam();
    const template = await factories.createTemplate({
      departmentId: team.departmentId,
      teamId: team.id,
    });
    const usage = await getDepartmentUsage(admin, { id: team.departmentId });
    expect(usage.used).toBe(true);
    expect(usage.templates.map((entry) => entry.id)).toEqual([template.id]);
    expect(usage.emptyTeams).toEqual([]);
  });
});

describe("teams", () => {
  it("creates and renames, unique per department only", async () => {
    const admin = actorOf(await factories.createAdmin());
    const one = await factories.createDepartment();
    const two = await factories.createDepartment();
    const team = await createTeam(admin, { departmentId: one.id, name: "Backend" });
    await createTeam(admin, { departmentId: two.id, name: "Backend" });
    await expect(
      createTeam(admin, { departmentId: one.id, name: "Backend" }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reasonKey: "org.errors.nameTaken" } });
    const renamed = await updateTeam(admin, {
      id: team.id,
      name: "Platform",
      departmentId: one.id,
    });
    expect(renamed.name).toBe("Platform");
  });

  it("rejects creating a team in an unknown department", async () => {
    const admin = actorOf(await factories.createAdmin());
    await expect(
      createTeam(admin, { departmentId: "00000000-0000-4000-8000-000000000000", name: "X" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("moves a team to another department (people follow) when no template references it", async () => {
    const admin = actorOf(await factories.createAdmin());
    const target = await factories.createDepartment();
    const team = await factories.createTeam();
    await factories.createEmployee({ teamId: team.id });
    await updateTeam(admin, { id: team.id, name: team.name, departmentId: target.id });
    const [row] = await testDb.select().from(teams).where(eq(teams.id, team.id));
    expect(row?.departmentId).toBe(target.id);
  });

  it("refuses to move a team while a template references it", async () => {
    const admin = actorOf(await factories.createAdmin());
    const target = await factories.createDepartment();
    const team = await factories.createTeam();
    const template = await factories.createTemplate({
      name: "Backend onboarding",
      departmentId: team.departmentId,
      teamId: team.id,
    });
    await expect(
      updateTeam(admin, { id: team.id, name: team.name, departmentId: target.id }),
    ).rejects.toMatchObject({
      code: "IN_USE",
      details: {
        reasonKey: "org.errors.teamHasTemplates",
        templates: [{ id: template.id, name: "Backend onboarding" }],
      },
    });
    const [row] = await testDb.select().from(teams).where(eq(teams.id, team.id));
    expect(row?.departmentId).toBe(team.departmentId);
    // A rename without a move is still fine.
    await expect(
      updateTeam(admin, { id: team.id, name: "Renamed", departmentId: team.departmentId }),
    ).resolves.toMatchObject({ name: "Renamed" });
  });

  it("lists usage and blocks deletion while used, deletes when unused", async () => {
    const admin = actorOf(await factories.createAdmin());
    const team = await factories.createTeam();
    const lead = await factories.createLead();
    const person = await factories.createEmployee({ teamId: team.id, leadId: lead.id });
    const template = await factories.createTemplate({
      departmentId: team.departmentId,
      teamId: team.id,
    });

    const usage = await getTeamUsage(admin, { id: team.id });
    expect(usage.users.map((entry) => entry.id)).toEqual([person.id]);
    expect(usage.templates.map((entry) => entry.id)).toEqual([template.id]);
    await expect(deleteTeam(admin, { id: team.id })).rejects.toMatchObject({ code: "IN_USE" });

    const free = await factories.createTeam();
    await deleteTeam(admin, { id: free.id });
    expect(await testDb.select().from(teams).where(eq(teams.id, free.id))).toHaveLength(0);
  });
});

describe("job roles", () => {
  it("creates, renames, lists with counts and rejects duplicates", async () => {
    const admin = actorOf(await factories.createAdmin());
    const role = await createJobRole(admin, { name: "Designer", departmentId: null });
    await expect(
      createJobRole(admin, { name: "Designer", departmentId: null }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reasonKey: "org.errors.nameTaken" },
    });
    await updateJobRole(admin, { id: role.id, name: "UX Designer", departmentId: null });
    const lead = await factories.createLead();
    await factories.createEmployee({ jobRoleId: role.id, leadId: lead.id });
    const list = await listJobRoles(admin);
    expect(list.find((entry) => entry.id === role.id)).toMatchObject({
      name: "UX Designer",
      userCount: 1,
    });
  });

  it("blocks deletion while people or templates use it, deletes otherwise", async () => {
    const admin = actorOf(await factories.createAdmin());
    const withPerson = await factories.createJobRole();
    const person = await factories.createEmployee({ jobRoleId: withPerson.id });
    const withTemplate = await factories.createJobRole();
    const template = await factories.createTemplate({ jobRoleId: withTemplate.id });
    const unused = await factories.createJobRole();

    expect((await getJobRoleUsage(admin, { id: withPerson.id })).users[0]?.id).toBe(person.id);
    expect((await getJobRoleUsage(admin, { id: withTemplate.id })).templates[0]?.id).toBe(
      template.id,
    );
    await expect(deleteJobRole(admin, { id: withPerson.id })).rejects.toMatchObject({
      code: "IN_USE",
    });
    await expect(deleteJobRole(admin, { id: withTemplate.id })).rejects.toMatchObject({
      code: "IN_USE",
    });
    await deleteJobRole(admin, { id: unused.id });
    await expect(getJobRoleUsage(admin, { id: unused.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("org authorization", () => {
  it("answers FORBIDDEN to non-admins on every admin service", async () => {
    const department = await factories.createDepartment();
    const team = await factories.createTeam({ departmentId: department.id });
    const role = await factories.createJobRole();
    const id = department.id;
    for (const user of [await factories.createLead(), await factories.createEmployee()]) {
      const actor = actorOf(user);
      const calls: Promise<unknown>[] = [
        listDepartments(actor),
        createDepartment(actor, { name: "X" }),
        updateDepartment(actor, { id, name: "X" }),
        getDepartmentUsage(actor, { id }),
        deleteDepartment(actor, { id }),
        createTeam(actor, { departmentId: id, name: "X" }),
        updateTeam(actor, { id: team.id, name: "X", departmentId: id }),
        getTeamUsage(actor, { id: team.id }),
        deleteTeam(actor, { id: team.id }),
        listJobRoles(actor),
        createJobRole(actor, { name: "X", departmentId: null }),
        updateJobRole(actor, { id: role.id, name: "X", departmentId: null }),
        getJobRoleUsage(actor, { id: role.id }),
        deleteJobRole(actor, { id: role.id }),
      ];
      for (const call of calls) {
        await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    expect(
      await testDb.select().from(departments).where(eq(departments.id, department.id)),
    ).toHaveLength(1);
  });

  it("serves listOrgOptions to admins and team leads but not employees", async () => {
    const team = await factories.createTeam();
    const role = await factories.createJobRole();
    for (const user of [await factories.createAdmin(), await factories.createLead()]) {
      const options = await listOrgOptions(actorOf(user));
      expect(options.teams.map((entry) => entry.id)).toContain(team.id);
      expect(options.jobRoles.map((entry) => entry.id)).toContain(role.id);
      expect(options.departments.map((entry) => entry.id)).toContain(team.departmentId);
    }
    await expect(listOrgOptions(actorOf(await factories.createEmployee()))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
