import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/auth";
import { invitations, notifications, pageEditLocks, sessions, users } from "@/server/db/schema";
import { getInvitationState, resendInvitation } from "@/server/services/invitations";
import { clearOutbox } from "@/server/mail/outbox";
import {
  createUser,
  deactivateUser,
  deleteUserPermanently,
  getUser,
  getUserDeactivationImpact,
  listLeadCandidates,
  listUsers,
  reactivateUser,
  updateUser,
} from "@/server/services/users";
import * as factories from "../../factories";
import { actorOf, testDb } from "../../helpers";

const PASSWORD = "a-long-enough-password";

async function signIn(email: string) {
  return auth.api.signInEmail({ body: { email, password: PASSWORD } });
}

async function rowOf(id: string) {
  const [row] = await testDb.select().from(users).where(eq(users.id, id));
  return row;
}

describe("deactivateUser", () => {
  beforeEach(() => clearOutbox());

  it("archives the user, deletes sessions, refuses sign-in and cleans up locks and invitations", async () => {
    const admin = actorOf(await factories.createAdmin());
    const employee = await factories.createEmployee({ password: PASSWORD });
    await signIn(employee.email);
    expect(
      await testDb.select().from(sessions).where(eq(sessions.userId, employee.id)),
    ).toHaveLength(1);
    const page = await factories.createPage();
    await factories.createLock({ pageId: page.id, userId: employee.id });
    await testDb.insert(invitations).values({
      userId: employee.id,
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await deactivateUser(admin, { id: employee.id });

    const row = await rowOf(employee.id);
    expect(row).toMatchObject({
      onboardingStatus: "archived",
      banned: true,
      banReason: "deactivated",
    });
    expect(row?.archivedAt).toBeInstanceOf(Date);
    expect(
      await testDb.select().from(sessions).where(eq(sessions.userId, employee.id)),
    ).toHaveLength(0);
    expect(await testDb.select().from(pageEditLocks)).toHaveLength(0);
    const [invite] = await testDb
      .select()
      .from(invitations)
      .where(eq(invitations.userId, employee.id));
    expect(invite?.revokedAt).not.toBeNull();
    await expect(signIn(employee.email)).rejects.toBeDefined();
  });

  it("lists the employees that still have the user as lead, and allows deactivating the lead", async () => {
    const admin = actorOf(await factories.createAdmin());
    const lead = await factories.createLead();
    const active = await factories.createEmployee({ leadId: lead.id, firstName: "Ann" });
    await factories.createEmployee({ leadId: lead.id, onboardingStatus: "archived" });

    const impact = await getUserDeactivationImpact(admin, { id: lead.id });
    expect(impact.ledEmployees).toEqual([{ id: active.id, name: active.name }]);

    await deactivateUser(admin, { id: lead.id });
    expect((await rowOf(active.id))?.leadId).toBe(lead.id);
    // No notification is written for an archived lead afterwards.
    expect(
      await testDb.select().from(notifications).where(eq(notifications.userId, lead.id)),
    ).toHaveLength(0);
  });

  it("refuses self-deactivation and a second deactivation, and reports unknown users", async () => {
    const adminRow = await factories.createAdmin();
    await factories.createAdmin();
    await expect(deactivateUser(actorOf(adminRow), { id: adminRow.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { reasonKey: "users.errors.cannotDeactivateSelf" },
    });
    const employee = await factories.createEmployee();
    await deactivateUser(actorOf(adminRow), { id: employee.id });
    await expect(deactivateUser(actorOf(adminRow), { id: employee.id })).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    await expect(
      deactivateUser(actorOf(adminRow), { id: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("never deactivates the last active admin", async () => {
    const first = await factories.createAdmin();
    const second = await factories.createAdmin();
    await deactivateUser(actorOf(first), { id: second.id });
    // `second` is archived now; a stale actor object of theirs must not take the last admin down.
    await expect(deactivateUser(actorOf(second), { id: first.id })).rejects.toMatchObject({
      code: "LAST_ADMIN",
    });
    expect((await rowOf(first.id))?.onboardingStatus).toBe("active");
  });

  it("serializes two concurrent deactivations of the last two admins: exactly one succeeds", async () => {
    for (let round = 0; round < 5; round += 1) {
      const first = await factories.createAdmin();
      const second = await factories.createAdmin();
      const results = await Promise.allSettled([
        deactivateUser(actorOf(first), { id: second.id }),
        deactivateUser(actorOf(second), { id: first.id }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.find((r) => r.status === "rejected")).toMatchObject({
        reason: { code: "LAST_ADMIN" },
      });
      const remaining = [await rowOf(first.id), await rowOf(second.id)].filter(
        (row) => row?.onboardingStatus === "active",
      );
      expect(remaining).toHaveLength(1);
      await testDb.update(users).set({ role: "employee" }).where(eq(users.role, "admin"));
    }
  });
});

describe("reactivateUser", () => {
  it("brings an archived user back: sign-in works again", async () => {
    const admin = actorOf(await factories.createAdmin());
    const employee = await factories.createEmployee({ password: PASSWORD });
    await deactivateUser(admin, { id: employee.id });
    await reactivateUser(admin, { id: employee.id });

    expect(await rowOf(employee.id)).toMatchObject({
      onboardingStatus: "active",
      banned: false,
      banReason: null,
      archivedAt: null,
    });
    expect((await signIn(employee.email)).user.id).toBe(employee.id);
  });

  it("only works for archived users", async () => {
    const admin = actorOf(await factories.createAdmin());
    const employee = await factories.createEmployee();
    await expect(reactivateUser(admin, { id: employee.id })).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    await expect(
      reactivateUser(admin, { id: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("deleteUserPermanently", () => {
  it("only deletes archived users and requires the full name", async () => {
    const admin = actorOf(await factories.createAdmin());
    const employee = await factories.createEmployee({ firstName: "Ada", lastName: "Lovelace" });

    await expect(
      deleteUserPermanently(admin, { id: employee.id, confirmName: "Ada Lovelace" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    await deactivateUser(admin, { id: employee.id });
    await expect(
      deleteUserPermanently(admin, { id: employee.id, confirmName: "Ada" }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      details: { fieldErrors: { confirmName: ["users.errors.confirmNameMismatch"] } },
    });
    expect(await rowOf(employee.id)).toBeDefined();

    await deleteUserPermanently(admin, { id: employee.id, confirmName: "Ada Lovelace" });
    expect(await rowOf(employee.id)).toBeUndefined();
    await expect(
      deleteUserPermanently(admin, { id: employee.id, confirmName: "Ada Lovelace" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is blocked while the user still leads anyone, archived followers included", async () => {
    const admin = actorOf(await factories.createAdmin());
    const lead = await factories.createLead({ firstName: "Lea", lastName: "Lead" });
    const follower = await factories.createEmployee({
      leadId: lead.id,
      onboardingStatus: "archived",
    });
    await deactivateUser(admin, { id: lead.id });

    await expect(
      deleteUserPermanently(admin, { id: lead.id, confirmName: "Lea Lead" }),
    ).rejects.toMatchObject({
      code: "IN_USE",
      details: { reasonKey: "users.errors.leadsEmployees", ledEmployees: [{ id: follower.id }] },
    });
    expect(await rowOf(lead.id)).toBeDefined();
  });

  it("removes the user's data and every notification about them from other feeds", async () => {
    const admin = actorOf(await factories.createAdmin());
    const lead = await factories.createLead();
    const employee = await factories.createEmployee({
      leadId: lead.id,
      password: PASSWORD,
      firstName: "Ada",
      lastName: "Lovelace",
    });
    const bystander = await factories.createEmployee();
    await factories.createNotification({ userId: employee.id });
    await factories.createNotification({
      userId: lead.id,
      type: "employee_assigned",
      messageKey: "notificationItems.employeeAssigned",
      subjectUserId: employee.id,
    });
    await factories.createNotification({
      userId: admin.id,
      type: "onboarding_completed",
      messageKey: "notificationItems.onboardingCompleted",
      subjectUserId: employee.id,
    });
    await factories.createNotification({ userId: bystander.id });

    await deactivateUser(admin, { id: employee.id });
    await deleteUserPermanently(admin, { id: employee.id, confirmName: "Ada Lovelace" });

    const remaining = await testDb.select().from(notifications);
    expect(remaining.map((n) => n.userId)).toEqual([bystander.id]);
    expect(remaining.some((n) => n.subjectUserId === employee.id)).toBe(false);
  });
});

describe("invitation state in the user detail", () => {
  it("shows pending, then expired after a lapse, and resend makes it pending again", async () => {
    const admin = actorOf(await factories.createAdmin());
    const user = await factories.createUser();
    expect((await getUser(admin, { id: user.id })).invitationState).toBe("none");
    await resendInvitation(admin, { userId: user.id });
    expect(await getInvitationState(admin, { userId: user.id })).toBe("pending");
    await testDb
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.userId, user.id));
    expect((await getUser(admin, { id: user.id })).invitationState).toBe("expired");
  });
});

describe("users authorization", () => {
  it("answers FORBIDDEN to team leads and employees on every service", async () => {
    const target = await factories.createEmployee();
    const id = target.id;
    const input = {
      firstName: "A",
      lastName: "B",
      email: "a@example.test",
      role: "admin",
      locale: "de",
    } as const;
    for (const row of [await factories.createLead(), await factories.createEmployee()]) {
      const actor = actorOf(row);
      const calls: Promise<unknown>[] = [
        listUsers(actor),
        getUser(actor, { id }),
        listLeadCandidates(actor),
        createUser(actor, input),
        updateUser(actor, { ...input, id }),
        getUserDeactivationImpact(actor, { id }),
        deactivateUser(actor, { id }),
        reactivateUser(actor, { id }),
        deleteUserPermanently(actor, { id, confirmName: "x" }),
      ];
      for (const call of calls) {
        await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    expect((await rowOf(id))?.onboardingStatus).toBe("active");
  });
});
