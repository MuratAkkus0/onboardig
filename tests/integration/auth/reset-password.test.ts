import { eq, like } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { APP_CONFIG } from "@/config/app";
import { auth } from "@/server/auth/auth";
import { invitations, verifications } from "@/server/db/schema";
import { clearOutbox, getOutbox } from "@/server/mail/outbox";
import { createAdmin, createUser } from "../../factories";
import { actorOf, testDb } from "../../helpers";
import { getInvitationState, issueInvitationInTx } from "@/server/services/invitations";

const PASSWORD = "a-long-enough-password";

function requestReset(email: string) {
  return auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
}

describe("password reset mail", () => {
  beforeEach(() => clearOutbox());

  it("sends a localized mail to a user with a password and the token expires in one hour", async () => {
    const user = await createUser({ password: PASSWORD, locale: "en", firstName: "Ada" });
    const before = Date.now();
    await requestReset(user.email);

    const [mail] = getOutbox();
    expect(mail?.to).toBe(user.email);
    expect(mail?.subject).toBe(`Reset your password for ${APP_CONFIG.appName}`);
    expect(mail?.html).toContain("/reset-password/");
    expect(mail?.html).toContain("60 minutes");

    const [row] = await testDb
      .select()
      .from(verifications)
      .where(like(verifications.identifier, "reset-password:%"));
    const ttlMs = (row?.expiresAt.getTime() ?? 0) - before;
    expect(ttlMs).toBeGreaterThan((APP_CONFIG.auth.resetPasswordTokenTtlSeconds - 5) * 1000);
    expect(ttlMs).toBeLessThanOrEqual((APP_CONFIG.auth.resetPasswordTokenTtlSeconds + 5) * 1000);
  });

  it("uses the German template for German users", async () => {
    const user = await createUser({ password: PASSWORD, locale: "de" });
    await requestReset(user.email);
    expect(getOutbox()[0]?.subject).toBe(`Passwort zurücksetzen im ${APP_CONFIG.appName}`);
  });

  it("completes the reset with the emailed token", async () => {
    const user = await createUser({ password: PASSWORD });
    await requestReset(user.email);
    const token = /\/reset-password\/([A-Za-z0-9]+)/.exec(getOutbox()[0]?.text ?? "")?.[1];
    expect(token).toBeTruthy();

    await auth.api.resetPassword({
      body: { newPassword: "another-long-password", token: token ?? "" },
    });
    const signedIn = await auth.api.signInEmail({
      body: { email: user.email, password: "another-long-password" },
    });
    expect(signedIn.user.id).toBe(user.id);
  });

  it("sends nothing to a banned user", async () => {
    const user = await createUser({ password: PASSWORD, banned: true });
    await requestReset(user.email);
    expect(getOutbox()).toHaveLength(0);
  });

  it("sends nothing to an archived user", async () => {
    const user = await createUser({ password: PASSWORD, onboardingStatus: "archived" });
    await requestReset(user.email);
    expect(getOutbox()).toHaveLength(0);
  });

  it("sends nothing to unknown emails", async () => {
    await requestReset("nobody@example.test");
    expect(getOutbox()).toHaveLength(0);
  });

  it("sends nothing to a user without a password (pending or expired invitation)", async () => {
    const admin = await createAdmin();
    const pending = await createUser();
    await testDb.transaction((tx) =>
      issueInvitationInTx(tx, { userId: pending.id, createdBy: null }),
    );
    const expired = await createUser();
    await testDb.transaction((tx) =>
      issueInvitationInTx(tx, { userId: expired.id, createdBy: null }),
    );
    await testDb
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.userId, expired.id));

    await requestReset(pending.email);
    await requestReset(expired.email);
    expect(getOutbox()).toHaveLength(0);
    expect(await getInvitationState(actorOf(admin), { userId: pending.id })).toBe("pending");
    expect(await getInvitationState(actorOf(admin), { userId: expired.id })).toBe("expired");
  });
});
