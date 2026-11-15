import "server-only";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { accounts, users } from "@/server/db/schema";
import { AppError, rethrowDbError } from "@/server/errors";
import type { Locale } from "@/server/auth/types";

export interface CreateInitialAdminInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  locale: Locale;
}

/**
 * Internal, scripts only (no actor, no auth check): creates an admin user with a credential
 * account. Used by `seed:admin` and `seed:demo`.
 * @throws AppError("EMAIL_TAKEN") when the email is already registered.
 */
export async function createInitialAdmin(
  input: CreateInitialAdminInput,
): Promise<{ userId: string }> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const passwordHash = await hashPassword(input.password);

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing) throw new AppError("EMAIL_TAKEN");

      const [user] = await tx
        .insert(users)
        .values({
          name: `${firstName} ${lastName}`,
          email,
          emailVerified: true,
          role: "admin",
          firstName,
          lastName,
          locale: input.locale,
        })
        .returning({ id: users.id });
      if (!user) throw new AppError("INTERNAL");

      await tx.insert(accounts).values({
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      });
      return { userId: user.id };
    });
  } catch (e) {
    return rethrowDbError(e, { unique: "EMAIL_TAKEN" });
  }
}
