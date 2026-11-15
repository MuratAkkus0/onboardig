import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { APP_CONFIG, ROUTES } from "@/config/app";
import { env } from "@/config/env";
import { auth } from "@/server/auth/auth";
import { invitations, sessions } from "@/server/db/schema";
import {
  acceptInvitation,
  getInvitationState,
  issueInvitationInTx,
  resendInvitation,
  sendInvitationEmail,
  verifyInvitationToken,
} from "@/server/services/invitations";
import { clearOutbox, getOutbox } from "@/server/mail/outbox";
import { createAdmin, createEmployee, createLead, createUser } from "../../factories";
import { actorOf, testDb } from "../../helpers";

const PASSWORD = "a-long-enough-password";
const HOUR_MS = 60 * 60 * 1000;

async function invite(userId: string, createdBy: string | null = null) {
  return testDb.transaction((tx) => issueInvitationInTx(tx, { userId, createdBy }));
}

describe("invitations", () => {
  beforeEach(() => clearOutbox());

  it("issues a token valid for the configured TTL and stores only its hash", async () => {
    const user = await createUser({ firstName: "Ada" });
    const before = Date.now();
    const { token, expiresAt } = await invite(user.id);

    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      APP_CONFIG.auth.inviteTokenTtlHours * HOUR_MS - 1000,
    );
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(
      APP_CONFIG.auth.inviteTokenTtlHours * HOUR_MS + 5000,
    );
    const [row] = await testDb.select().from(invitations);
    expect(row?.tokenHash).not.toBe(token);
    expect(await verifyInvitationToken(token)).toEqual({
      valid: true,
      email: user.email,
      firstName: "Ada",
    });
  });

  it("accepts once: the password works for sign-in, the second accept fails", async () => {
    const user = await createUser();
    const { token } = await invite(user.id);

    expect(await acceptInvitation({ token, password: PASSWORD })).toEqual({ email: user.email });
    const signedIn = await auth.api.signInEmail({
      body: { email: user.email, password: PASSWORD },
    });
    expect(signedIn.user.id).toBe(user.id);

    await expect(acceptInvitation({ token, password: PASSWORD })).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
    expect(await verifyInvitationToken(token)).toEqual({ valid: false, reason: "used" });
  });

  it("rejects an expired token with INVITE_EXPIRED", async () => {
    const user = await createUser();
    const { token } = await invite(user.id);
    await testDb
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.userId, user.id));

    expect(await verifyInvitationToken(token)).toEqual({ valid: false, reason: "expired" });
    await expect(acceptInvitation({ token, password: PASSWORD })).rejects.toMatchObject({
      code: "INVITE_EXPIRED",
    });
  });

  it("rejects unknown tokens and too-short passwords", async () => {
    const user = await createUser();
    const { token } = await invite(user.id);
    await expect(acceptInvitation({ token: "unknown", password: PASSWORD })).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
    await expect(acceptInvitation({ token, password: "short" })).rejects.toThrow();
    expect((await verifyInvitationToken(token)).valid).toBe(true);
  });

  it("ends existing sessions of the user on accept", async () => {
    const user = await createUser();
    const { token } = await invite(user.id);
    await testDb.insert(sessions).values({
      userId: user.id,
      token: "old-session",
      expiresAt: new Date(Date.now() + HOUR_MS),
    });
    await acceptInvitation({ token, password: PASSWORD });
    expect(await testDb.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(
      0,
    );
  });

  it("issuing a new invitation revokes the old token", async () => {
    const user = await createUser();
    const first = await invite(user.id);
    const second = await invite(user.id);
    expect(await verifyInvitationToken(first.token)).toEqual({ valid: false, reason: "invalid" });
    expect((await verifyInvitationToken(second.token)).valid).toBe(true);
  });

  it("sends the invite mail with the set-password link in the user's locale", async () => {
    const user = await createUser({ locale: "en", firstName: "Ada" });
    const { token } = await invite(user.id);
    expect(await sendInvitationEmail({ userId: user.id, token })).toEqual({ sent: true });

    const [mail] = getOutbox();
    expect(mail?.to).toBe(user.email);
    expect(mail?.subject).toBe(`Welcome to ${APP_CONFIG.appName}`);
    const link = `${env.APP_URL}${ROUTES.setPassword}?token=${token}`;
    expect(mail?.html).toContain(link);
    expect(mail?.text).toContain(link);
    expect(mail?.html).toContain(`${APP_CONFIG.auth.inviteTokenTtlHours} hours`);
  });

  it("renders the German mail for German users", async () => {
    const user = await createUser({ locale: "de" });
    const { token } = await invite(user.id);
    await sendInvitationEmail({ userId: user.id, token });
    expect(getOutbox()[0]?.subject).toBe(`Willkommen im ${APP_CONFIG.appName}`);
  });

  describe("resendInvitation", () => {
    it("revokes the old token and mails a new one", async () => {
      const admin = await createAdmin();
      const user = await createUser();
      const old = await invite(user.id, admin.id);

      const result = await resendInvitation(actorOf(admin), { userId: user.id });
      expect(result.sent).toBe(true);
      expect(await verifyInvitationToken(old.token)).toEqual({ valid: false, reason: "invalid" });

      const newToken = new URL(
        /href="([^"]+)"/.exec(getOutbox()[0]?.html ?? "")?.[1]?.replaceAll("&amp;", "&") ?? "",
      ).searchParams.get("token");
      expect(newToken).toBeTruthy();
      expect((await verifyInvitationToken(newToken ?? "")).valid).toBe(true);
    });

    it("refuses users that already have a password, archived users and unknown ids", async () => {
      const admin = await createAdmin();
      const withPassword = await createUser({ password: PASSWORD });
      const archived = await createUser({ onboardingStatus: "archived" });
      await expect(
        resendInvitation(actorOf(admin), { userId: withPassword.id }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(resendInvitation(actorOf(admin), { userId: archived.id })).rejects.toMatchObject(
        { code: "CONFLICT" },
      );
      await expect(
        resendInvitation(actorOf(admin), { userId: "11111111-1111-4111-8111-111111111111" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("is admin-only", async () => {
      const user = await createUser();
      const lead = await createLead();
      const employee = await createEmployee();
      for (const actor of [lead, employee]) {
        await expect(resendInvitation(actorOf(actor), { userId: user.id })).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        await expect(getInvitationState(actorOf(actor), { userId: user.id })).rejects.toMatchObject(
          { code: "FORBIDDEN" },
        );
      }
      expect(getOutbox()).toHaveLength(0);
    });
  });

  describe("getInvitationState", () => {
    it("tracks none, pending, expired and accepted", async () => {
      const admin = await createAdmin();
      const user = await createUser();
      const state = () => getInvitationState(actorOf(admin), { userId: user.id });

      expect(await state()).toBe("none");
      const { token } = await invite(user.id);
      expect(await state()).toBe("pending");
      await testDb
        .update(invitations)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(invitations.userId, user.id));
      expect(await state()).toBe("expired");

      await resendInvitation(actorOf(admin), { userId: user.id });
      expect(await state()).toBe("pending");
      expect(await verifyInvitationToken(token)).toEqual({ valid: false, reason: "invalid" });

      const accepted = await invite(user.id);
      await acceptInvitation({ token: accepted.token, password: PASSWORD });
      expect(await state()).toBe("accepted");
    });

    it("is accepted whenever a credential password exists, whatever the invite rows say", async () => {
      const admin = await createAdmin();
      const user = await createUser({ password: PASSWORD });
      await invite(user.id);
      await testDb
        .update(invitations)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(invitations.userId, user.id));
      expect(await getInvitationState(actorOf(admin), { userId: user.id })).toBe("accepted");
    });
  });
});
