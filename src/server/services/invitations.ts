import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, desc, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { APP_CONFIG, F2A_CONFIG, ROUTES } from "@/config/app";
import { env } from "@/config/env";
import { idSchema, passwordSchema } from "@/lib/validation/common";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor, Locale } from "@/server/auth/types";
import { db, type Tx } from "@/server/db/client";
import { accounts, invitations, sessions, users } from "@/server/db/schema";
import { AppError, rethrowDbError } from "@/server/errors";
import { logger } from "@/server/logger";
import { sendMail } from "@/server/mail/send";
import { InviteEmail } from "@/server/mail/templates/invite-email";
import { getEmailTranslator } from "@/server/mail/translator";
import { lockUserInTx } from "./row-locks";

const MS_PER_HOUR = 60 * 60 * 1000;
const CREDENTIAL_PROVIDER = "credential";

export type InvitationTokenCheck =
  | { valid: true; email: string; firstName: string }
  | { valid: false; reason: "invalid" | "expired" | "used" };

export type InvitationState = "none" | "pending" | "expired" | "accepted";

const userIdInput = z.object({ userId: idSchema });
const acceptInput = z.object({ token: z.string().min(1), password: passwordSchema });

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isDeactivated(user: { banned: boolean; onboardingStatus: string }): boolean {
  return user.banned || user.onboardingStatus === "archived";
}

async function hasCredentialPassword(executor: Pick<Tx, "select">, userId: string) {
  const [row] = await executor
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.providerId, CREDENTIAL_PROVIDER),
        isNotNull(accounts.password),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/**
 * Internal (trusted caller, no auth check): revokes the user's open invitations and issues a new
 * one. Only the SHA-256 hash of the token is stored; the plain token goes into the mail.
 */
export async function issueInvitationInTx(
  tx: Tx,
  input: { userId: string; createdBy: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const now = new Date();
  await tx
    .update(invitations)
    .set({ revokedAt: now })
    .where(
      and(
        eq(invitations.userId, input.userId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    );
  const token = randomBytes(F2A_CONFIG.invitations.tokenBytes).toString("base64url");
  const expiresAt = new Date(now.getTime() + APP_CONFIG.auth.inviteTokenTtlHours * MS_PER_HOUR);
  await tx.insert(invitations).values({
    userId: input.userId,
    tokenHash: hashToken(token),
    expiresAt,
    createdBy: input.createdBy,
  });
  return { token, expiresAt };
}

/** Internal: sends the invitation mail in the user's locale. Call after the transaction commits. */
export async function sendInvitationEmail(input: {
  userId: string;
  token: string;
}): Promise<{ sent: boolean }> {
  try {
    const [user] = await db
      .select({ email: users.email, firstName: users.firstName, locale: users.locale })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!user) return { sent: false };
    const t = await getEmailTranslator(user.locale);
    const url = `${env.APP_URL}${ROUTES.setPassword}?token=${encodeURIComponent(input.token)}`;
    await sendMail({
      to: user.email,
      subject: t("invite.subject", { appName: APP_CONFIG.appName }),
      react: InviteEmail({ t, locale: user.locale, firstName: user.firstName, url }),
    });
    return { sent: true };
  } catch (e) {
    logger.error(
      { err: e instanceof Error ? e.message : "unknown", userId: input.userId },
      "invitation mail failed",
    );
    return { sent: false };
  }
}

/** Admin: revokes open invitations and sends a fresh one (user must be active and have no password yet). */
export async function resendInvitation(
  actor: Actor,
  input: { userId: string },
): Promise<{ sent: boolean; expiresAt: Date }> {
  assertPermission(actor, "users.manage");
  const { userId } = userIdInput.parse(input);

  const issued = await db.transaction(async (tx) => {
    const locked = await lockUserInTx(tx, userId);
    if (!locked) throw new AppError("NOT_FOUND");
    if (locked.onboardingStatus === "archived") throw new AppError("CONFLICT");
    if (await hasCredentialPassword(tx, userId)) throw new AppError("CONFLICT");
    return issueInvitationInTx(tx, { userId, createdBy: actor.id });
  });

  const { sent } = await sendInvitationEmail({ userId, token: issued.token });
  logger.info({ action: "invitation.resend", entityId: userId, actorId: actor.id }, "mutation");
  return { sent, expiresAt: issued.expiresAt };
}

/** Admin: "accepted" whenever a credential password exists, whatever the invitation rows say. */
export async function getInvitationState(
  actor: Actor,
  input: { userId: string },
): Promise<InvitationState> {
  assertPermission(actor, "users.manage");
  const { userId } = userIdInput.parse(input);

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError("NOT_FOUND");
  if (await hasCredentialPassword(db, userId)) return "accepted";

  const [latest] = await db
    .select({
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
    })
    .from(invitations)
    .where(eq(invitations.userId, userId))
    .orderBy(desc(invitations.createdAt), desc(invitations.id))
    .limit(1);
  if (!latest) return "none";
  const open = latest.acceptedAt === null && latest.revokedAt === null;
  return open && latest.expiresAt.getTime() > Date.now() ? "pending" : "expired";
}

type InvitationLookup =
  | { ok: true; invitationId: string; userId: string; email: string; firstName: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

async function lookupInvitation(
  executor: Pick<Tx, "select">,
  token: string,
  lock: boolean,
): Promise<InvitationLookup> {
  const query = executor
    .select({
      id: invitations.id,
      userId: invitations.userId,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
      email: users.email,
      firstName: users.firstName,
      banned: users.banned,
      onboardingStatus: users.onboardingStatus,
    })
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.userId))
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);
  const [row] = lock ? await query.for("update", { of: invitations }) : await query;
  if (!row || row.revokedAt !== null || isDeactivated(row)) return { ok: false, reason: "invalid" };
  if (row.acceptedAt !== null) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  return {
    ok: true,
    invitationId: row.id,
    userId: row.userId,
    email: row.email,
    firstName: row.firstName,
  };
}

/** Public: tells the set-password page whether a token can be used. */
export async function verifyInvitationToken(token: string): Promise<InvitationTokenCheck> {
  const found = await lookupInvitation(db, token, false);
  return found.ok
    ? { valid: true, email: found.email, firstName: found.firstName }
    : { valid: false, reason: found.reason };
}

/**
 * Public: sets the password for an invited user. One transaction: validates the token under a row
 * lock, upserts the credential account, marks the invitation accepted, revokes other open
 * invitations and ends all sessions of the user.
 * @throws AppError INVITE_INVALID (unknown, revoked or used token) / INVITE_EXPIRED
 */
export async function acceptInvitation(input: {
  token: string;
  password: string;
}): Promise<{ email: string }> {
  const { token, password } = acceptInput.parse(input);

  // Cheap pre-check so unusable tokens never cost a password hash.
  const pre = await lookupInvitation(db, token, false);
  if (!pre.ok) throw inviteError(pre.reason);
  const passwordHash = await hashPassword(password);

  try {
    return await db.transaction(async (tx) => {
      const found = await lookupInvitation(tx, token, true);
      if (!found.ok) throw inviteError(found.reason);
      await lockUserInTx(tx, found.userId);

      const now = new Date();
      const updated = await tx
        .update(accounts)
        .set({ password: passwordHash, updatedAt: now })
        .where(and(eq(accounts.userId, found.userId), eq(accounts.providerId, CREDENTIAL_PROVIDER)))
        .returning({ id: accounts.id });
      if (updated.length === 0) {
        await tx.insert(accounts).values({
          accountId: found.userId,
          providerId: CREDENTIAL_PROVIDER,
          userId: found.userId,
          password: passwordHash,
        });
      }
      await tx
        .update(users)
        .set({ emailVerified: true, updatedAt: now })
        .where(eq(users.id, found.userId));
      await tx
        .update(invitations)
        .set({ acceptedAt: now })
        .where(eq(invitations.id, found.invitationId));
      await tx
        .update(invitations)
        .set({ revokedAt: now })
        .where(
          and(
            eq(invitations.userId, found.userId),
            ne(invitations.id, found.invitationId),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
          ),
        );
      await tx.delete(sessions).where(eq(sessions.userId, found.userId));

      logger.info({ action: "invitation.accept", entityId: found.userId }, "mutation");
      return { email: found.email };
    });
  } catch (e) {
    return rethrowDbError(e, { unique: "CONFLICT" });
  }
}

function inviteError(reason: "invalid" | "expired" | "used"): AppError {
  return new AppError(reason === "expired" ? "INVITE_EXPIRED" : "INVITE_INVALID");
}

/**
 * Internal (used by the Better Auth reset-mail callback): who may receive a password-reset mail.
 * Returns null for unknown, deactivated users and users without a credential password (pending or
 * expired invitation): their reset token stays unmailed and therefore unusable.
 */
export async function getPasswordResetRecipient(
  userId: string,
): Promise<{ email: string; firstName: string; locale: Locale } | null> {
  const [user] = await db
    .select({
      email: users.email,
      firstName: users.firstName,
      locale: users.locale,
      banned: users.banned,
      onboardingStatus: users.onboardingStatus,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || isDeactivated(user)) return null;
  if (!(await hasCredentialPassword(db, userId))) return null;
  return { email: user.email, firstName: user.firstName, locale: user.locale };
}
