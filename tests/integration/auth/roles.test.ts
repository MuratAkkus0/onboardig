import { describe, expect, it } from "vitest";
import { listNotifications, markAllRead } from "@/server/services/notifications";
import { resendInvitation } from "@/server/services/invitations";
import { createAdmin, createEmployee, createLead, createUser } from "../../factories";
import { actorOf } from "../../helpers";

describe("role checks in services", () => {
  it("lets only admins use admin-only service paths", async () => {
    const target = await createUser();
    const admin = await createAdmin();
    const lead = await createLead();
    const employee = await createEmployee();

    await expect(resendInvitation(actorOf(lead), { userId: target.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(resendInvitation(actorOf(employee), { userId: target.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(resendInvitation(actorOf(admin), { userId: target.id })).resolves.toMatchObject({
      sent: true,
    });
  });

  it("lets every role use its own notifications", async () => {
    for (const user of [await createAdmin(), await createLead(), await createEmployee()]) {
      const page = await listNotifications(actorOf(user));
      expect(page.items).toEqual([]);
      await expect(markAllRead(actorOf(user))).resolves.toBeUndefined();
    }
  });
});
