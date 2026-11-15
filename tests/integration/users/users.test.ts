import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { invitations, notifications, users } from "@/server/db/schema";
import { acceptInvitation, verifyInvitationToken } from "@/server/services/invitations";
import { clearOutbox, getOutbox } from "@/server/mail/outbox";
import {
  createUser,
  getUser,
  listLeadCandidates,
  listUsers,
  updateUser,
} from "@/server/services/users";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validation/users";
import * as factories from "../../factories";
import { actorOf, testDb } from "../../helpers";

async function employeeInput(overrides: Partial<CreateUserInput> = {}): Promise<CreateUserInput> {
  const team = await factories.createTeam();
  const jobRole = await factories.createJobRole();
  const lead = await factories.createLead();
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.test",
    role: "employee",
    teamId: team.id,
    jobRoleId: jobRole.id,
    leadId: lead.id,
    startDate: "2026-12-01",
    locale: "en",
    ...overrides,
  };
}

async function updateInputOf(id: string, overrides: Partial<UpdateUserInput> = {}) {
  const [row] = await testDb.select().from(users).where(eq(users.id, id));
  if (!row) throw new Error("user missing");
  return {
    id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    role: row.role,
    teamId: row.teamId,
    jobRoleId: row.jobRoleId,
    leadId: row.leadId,
    startDate: row.startDate,
    locale: row.locale,
    ...overrides,
  } satisfies UpdateUserInput;
}

async function notificationsOf(userId: string) {
  return testDb.select().from(notifications).where(eq(notifications.userId, userId));
}

describe("createUser", () => {
  beforeEach(() => clearOutbox());

  it("creates the account, sends the invitation in the user's locale and notifies the lead", async () => {
    const admin = actorOf(await factories.createAdmin());
    const input = await employeeInput({ email: "  Ada@Example.TEST " });

    const { user, inviteSent } = await createUser(admin, input);

    expect(inviteSent).toBe(true);
    expect(user).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.test",
      role: "employee",
      onboardingStatus: "active",
      startDate: "2026-12-01",
    });
    const outbox = getOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe("ada@example.test");

    const feed = await notificationsOf(input.leadId as string);
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({
      type: "employee_assigned",
      subjectUserId: user.id,
      params: { employeeName: "Ada Lovelace" },
    });
    expect((await getUser(admin, { id: user.id })).invitationState).toBe("pending");
  });

  it("does not notify an admin who names themselves as lead", async () => {
    const adminRow = await factories.createAdmin();
    const input = await employeeInput({ leadId: adminRow.id });
    await createUser(actorOf(adminRow), input);
    expect(await notificationsOf(adminRow.id)).toHaveLength(0);
  });

  it("notifies a lead that is another admin", async () => {
    const actor = actorOf(await factories.createAdmin());
    const otherAdmin = await factories.createAdmin();
    await createUser(actor, await employeeInput({ leadId: otherAdmin.id }));
    expect(await notificationsOf(otherAdmin.id)).toHaveLength(1);
  });

  it("rejects a duplicate e-mail, also when only the case differs", async () => {
    const admin = actorOf(await factories.createAdmin());
    await createUser(admin, await employeeInput({ email: "ada@example.test" }));
    await expect(
      createUser(admin, await employeeInput({ email: "ADA@example.test" })),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    expect(getOutbox()).toHaveLength(1);
  });

  it("requires team, job role, lead and start date for employees", async () => {
    const admin = actorOf(await factories.createAdmin());
    const input = await employeeInput({
      teamId: "",
      jobRoleId: null,
      leadId: undefined,
      startDate: " ",
    });
    const error = await createUser(admin, input).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: "ZodError" });
    const paths = (error as { issues: { path: string[] }[] }).issues.map((i) => i.path[0]);
    expect(paths.sort()).toEqual(["jobRoleId", "leadId", "startDate", "teamId"]);
  });

  it("lets leads skip the lead and admins skip every org field", async () => {
    const admin = actorOf(await factories.createAdmin());
    const base = await employeeInput();
    const lead = await createUser(admin, {
      ...base,
      email: "lead@example.test",
      role: "team_lead",
      leadId: null,
    });
    expect(lead.user.role).toBe("team_lead");
    const newAdmin = await createUser(admin, {
      firstName: "Root",
      lastName: "Admin",
      email: "root@example.test",
      role: "admin",
      locale: "de",
    });
    expect(newAdmin.user).toMatchObject({ role: "admin", teamId: null, leadId: null });
  });

  it("rejects employees, archived users and unknown ids as lead, and unknown team or role", async () => {
    const admin = actorOf(await factories.createAdmin());
    const employee = await factories.createEmployee();
    const archivedLead = await factories.createLead({ onboardingStatus: "archived" });
    const missing = "00000000-0000-4000-8000-000000000000";
    for (const leadId of [employee.id, archivedLead.id, missing]) {
      await expect(createUser(admin, await employeeInput({ leadId }))).rejects.toMatchObject({
        code: "VALIDATION",
        details: { fieldErrors: { leadId: ["users.errors.leadInvalid"] } },
      });
    }
    await expect(createUser(admin, await employeeInput({ teamId: missing }))).rejects.toMatchObject(
      {
        code: "VALIDATION",
        details: { fieldErrors: { teamId: ["validation.invalidValue"] } },
      },
    );
    await expect(
      createUser(admin, await employeeInput({ jobRoleId: missing })),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      details: { fieldErrors: { jobRoleId: ["validation.invalidValue"] } },
    });
    expect(getOutbox()).toHaveLength(0);
  });
});

describe("updateUser", () => {
  beforeEach(() => clearOutbox());

  it("changes profile fields and keeps the display name in sync", async () => {
    const admin = actorOf(await factories.createAdmin());
    const employee = await factories.createEmployee();
    const updated = await updateUser(
      admin,
      await updateInputOf(employee.id, { firstName: "Grace", lastName: "Hopper", locale: "en" }),
    );
    expect(updated).toMatchObject({ name: "Grace Hopper", locale: "en" });
  });

  it("notifies the new lead when the lead changes, not when it stays", async () => {
    const admin = actorOf(await factories.createAdmin());
    const employee = await factories.createEmployee();
    const newLead = await factories.createLead();

    await updateUser(admin, await updateInputOf(employee.id, { leadId: newLead.id }));
    expect(await notificationsOf(newLead.id)).toHaveLength(1);
    expect(await notificationsOf(employee.leadId as string)).toHaveLength(0);

    await updateUser(admin, await updateInputOf(employee.id, { firstName: "Renamed" }));
    expect(await notificationsOf(newLead.id)).toHaveLength(1);
  });

  it("does not notify when the actor makes themselves the lead", async () => {
    const adminRow = await factories.createAdmin();
    const employee = await factories.createEmployee();
    await updateUser(actorOf(adminRow), await updateInputOf(employee.id, { leadId: adminRow.id }));
    expect(await notificationsOf(adminRow.id)).toHaveLength(0);
  });

  it("validates the lead only when it changes", async () => {
    const admin = actorOf(await factories.createAdmin());
    const employee = await factories.createEmployee();
    await testDb
      .update(users)
      .set({ onboardingStatus: "archived", banned: true })
      .where(eq(users.id, employee.leadId as string));

    // Unchanged (archived) lead stays editable ...
    await expect(
      updateUser(admin, await updateInputOf(employee.id, { firstName: "Still" })),
    ).resolves.toMatchObject({ firstName: "Still", leadId: employee.leadId });

    // ... but picking an archived lead afresh is refused.
    const other = await factories.createEmployee();
    await expect(
      updateUser(admin, await updateInputOf(other.id, { leadId: employee.leadId })),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      details: { fieldErrors: { leadId: ["users.errors.leadInvalid"] } },
    });
  });

  it("rejects the user as their own lead and any cycle in the lead chain", async () => {
    const admin = actorOf(await factories.createAdmin());
    const a = await factories.createLead();
    const b = await factories.createLead({ leadId: a.id });
    const c = await factories.createLead({ leadId: b.id });

    await expect(
      updateUser(admin, await updateInputOf(a.id, { leadId: a.id })),
    ).rejects.toMatchObject({
      details: { fieldErrors: { leadId: ["users.errors.leadSelf"] } },
    });
    await expect(
      updateUser(admin, await updateInputOf(a.id, { leadId: b.id })),
    ).rejects.toMatchObject({
      details: { fieldErrors: { leadId: ["users.errors.leadCycle"] } },
    });
    await expect(
      updateUser(admin, await updateInputOf(a.id, { leadId: c.id })),
    ).rejects.toMatchObject({
      details: { fieldErrors: { leadId: ["users.errors.leadCycle"] } },
    });
    // A non-cyclic change in the same chain is fine.
    await expect(
      updateUser(admin, await updateInputOf(c.id, { leadId: a.id })),
    ).resolves.toMatchObject({ leadId: a.id });
  });

  it("refuses to make someone an employee while they lead people", async () => {
    const admin = actorOf(await factories.createAdmin());
    const lead = await factories.createLead();
    const employee = await factories.createEmployee({ leadId: lead.id });

    await expect(
      updateUser(
        admin,
        await updateInputOf(lead.id, { role: "employee", leadId: employee.leadId }),
      ),
    ).rejects.toMatchObject({
      code: "IN_USE",
      details: {
        reasonKey: "users.errors.leadsEmployees",
        ledEmployees: [{ id: employee.id }],
      },
    });
    const [row] = await testDb.select().from(users).where(eq(users.id, lead.id));
    expect(row?.role).toBe("team_lead");
  });

  it("allows admin to team lead even while leading people, and employee to team lead", async () => {
    const admin = actorOf(await factories.createAdmin());
    const leadingAdmin = await factories.createAdmin();
    const team = await factories.createTeam();
    const jobRole = await factories.createJobRole();
    await factories.createEmployee({ leadId: leadingAdmin.id });
    const result = await updateUser(
      admin,
      await updateInputOf(leadingAdmin.id, {
        role: "team_lead",
        teamId: team.id,
        jobRoleId: jobRole.id,
        startDate: "2026-02-01",
      }),
    );
    expect(result.role).toBe("team_lead");

    const employee = await factories.createEmployee();
    await expect(
      updateUser(admin, await updateInputOf(employee.id, { role: "team_lead", leadId: null })),
    ).resolves.toMatchObject({ role: "team_lead" });
  });

  it("protects the last active admin from demotion", async () => {
    const adminRow = await factories.createAdmin();
    const team = await factories.createTeam();
    const jobRole = await factories.createJobRole();
    const demotion = {
      role: "team_lead",
      teamId: team.id,
      jobRoleId: jobRole.id,
      startDate: "2026-02-01",
    } as const;

    await expect(
      updateUser(actorOf(adminRow), await updateInputOf(adminRow.id, demotion)),
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });

    // A second admin makes the demotion legal; an archived admin does not count.
    await factories.createAdmin({ onboardingStatus: "archived", banned: true });
    await expect(
      updateUser(actorOf(adminRow), await updateInputOf(adminRow.id, demotion)),
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    await factories.createAdmin();
    await expect(
      updateUser(actorOf(adminRow), await updateInputOf(adminRow.id, demotion)),
    ).resolves.toMatchObject({ role: "team_lead" });
  });

  it("serializes two concurrent demotions of the last two admins: exactly one succeeds", async () => {
    const first = await factories.createAdmin();
    const second = await factories.createAdmin();
    const team = await factories.createTeam();
    const jobRole = await factories.createJobRole();
    const demotion = {
      role: "team_lead",
      teamId: team.id,
      jobRoleId: jobRole.id,
      startDate: "2026-02-01",
    } as const;
    const results = await Promise.allSettled([
      updateUser(actorOf(first), await updateInputOf(second.id, demotion)),
      updateUser(actorOf(second), await updateInputOf(first.id, demotion)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: "LAST_ADMIN" } });
  });

  it("allows an e-mail change before acceptance and re-invites the new address", async () => {
    const admin = actorOf(await factories.createAdmin());
    const { user } = await createUser(admin, await employeeInput());
    const [firstInvite] = await testDb
      .select()
      .from(invitations)
      .where(eq(invitations.userId, user.id));
    expect(firstInvite).toBeDefined();
    clearOutbox();

    const updated = await updateUser(
      admin,
      await updateInputOf(user.id, { email: "NEW@example.test" }),
    );
    expect(updated.email).toBe("new@example.test");
    expect(getOutbox().map((mail) => mail.to)).toEqual(["new@example.test"]);
    const open = await testDb
      .select()
      .from(invitations)
      .where(and(eq(invitations.userId, user.id)));
    expect(open.filter((row) => row.revokedAt === null)).toHaveLength(1);
  });

  it("locks the e-mail after the invitation was accepted", async () => {
    const admin = actorOf(await factories.createAdmin());
    const employee = await factories.createEmployee({ password: "a-long-enough-password" });
    await expect(
      updateUser(admin, await updateInputOf(employee.id, { email: "other@example.test" })),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reasonKey: "users.errors.emailLocked" },
    });
    // The same address (no change) is fine.
    await expect(updateUser(admin, await updateInputOf(employee.id))).resolves.toBeDefined();
  });

  it("accepts a token from the creation mail and then reports the invitation as accepted", async () => {
    const admin = actorOf(await factories.createAdmin());
    const { user } = await createUser(admin, await employeeInput());
    const token = /token=([^"&\s]+)/.exec(getOutbox()[0]?.text ?? "")?.[1];
    expect(token).toBeDefined();
    const decoded = decodeURIComponent(token as string);
    expect((await verifyInvitationToken(decoded)).valid).toBe(true);
    await acceptInvitation({ token: decoded, password: "a-long-enough-password" });
    expect((await getUser(admin, { id: user.id })).invitationState).toBe("accepted");
  });

  it("rejects a duplicate e-mail and edits to archived users", async () => {
    const admin = actorOf(await factories.createAdmin());
    const one = await factories.createEmployee();
    const two = await factories.createEmployee();
    await expect(
      updateUser(admin, await updateInputOf(two.id, { email: one.email })),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });

    const archived = await factories.createEmployee({ onboardingStatus: "archived" });
    await expect(updateUser(admin, await updateInputOf(archived.id))).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reasonKey: "users.errors.userArchived" },
    });
  });
});

describe("queries", () => {
  it("lists and filters users", async () => {
    const admin = actorOf(await factories.createAdmin());
    const teamA = await factories.createTeam();
    const teamB = await factories.createTeam();
    const lead = await factories.createLead();
    const ada = await factories.createEmployee({
      teamId: teamA.id,
      leadId: lead.id,
      firstName: "Ada",
      lastName: "Zed",
      email: "ada.zed@example.test",
    });
    const bob = await factories.createEmployee({
      teamId: teamB.id,
      leadId: lead.id,
      firstName: "Bob",
      lastName: "100%_sure",
      email: "bob@example.test",
      onboardingStatus: "archived",
    });

    const ids = async (input: Parameters<typeof listUsers>[1]) =>
      (await listUsers(admin, input)).map((u) => u.id);
    expect(await ids({ teamId: teamA.id })).toEqual([ada.id]);
    expect(await ids({ departmentId: teamB.departmentId })).toEqual([bob.id]);
    expect(await ids({ status: "archived", teamId: teamB.id })).toEqual([bob.id]);
    expect(await ids({ role: "team_lead" })).toContain(lead.id);
    expect(await ids({ q: "ADA.ZED" })).toEqual([ada.id]);
    // LIKE wildcards in the search term are literal.
    expect(await ids({ q: "100%_" })).toEqual([bob.id]);
    expect(await ids({ q: "%" })).toEqual([bob.id]);
    const [row] = await listUsers(admin, { teamId: teamA.id });
    expect(row).toMatchObject({
      teamName: teamA.name,
      departmentId: teamA.departmentId,
      leadName: lead.name,
    });
  });

  it("lists only non-archived leads and admins as lead candidates", async () => {
    const admin = await factories.createAdmin();
    const lead = await factories.createLead();
    const archivedLead = await factories.createLead({ onboardingStatus: "archived" });
    const employee = await factories.createEmployee();
    const candidates = await listLeadCandidates(actorOf(admin));
    expect(candidates.map((c) => c.id).sort()).toEqual(
      [admin.id, lead.id, employee.leadId as string].sort(),
    );
    expect(candidates.map((c) => c.id)).not.toContain(archivedLead.id);
  });

  it("reports NOT_FOUND for an unknown user", async () => {
    const admin = actorOf(await factories.createAdmin());
    const id = "00000000-0000-4000-8000-000000000000";
    await expect(getUser(admin, { id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateUser(admin, {
        id,
        firstName: "No",
        lastName: "Body",
        email: "nobody@example.test",
        role: "admin",
        locale: "de",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
