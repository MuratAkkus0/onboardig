import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { APP_CONFIG } from "@/config/app";
import { env } from "@/config/env";
import { db } from "@/server/db/client";
import { accounts, sessions, users, verifications } from "@/server/db/schema";
import { sendResetPassword } from "./reset-mail";

const { rateLimit: limits } = APP_CONFIG.auth;

function createAuth() {
  return betterAuth({
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    advanced: {
      database: { generateId: "uuid" },
      // Rate limits key on the client IP. The reverse proxy must overwrite (not append to)
      // X-Forwarded-For and the app port must stay unreachable around it (docs/runbook.md §2).
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    disabledPaths: [...APP_CONFIG.auth.disabledPaths],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: APP_CONFIG.auth.passwordMinLength,
      maxPasswordLength: APP_CONFIG.auth.passwordMaxLength,
      resetPasswordTokenExpiresIn: APP_CONFIG.auth.resetPasswordTokenTtlSeconds,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword,
    },
    session: {
      expiresIn: APP_CONFIG.auth.sessionExpiresInSeconds,
      updateAge: APP_CONFIG.auth.sessionUpdateAgeSeconds,
      // cookieCache stays disabled: deactivation must end sessions immediately.
    },
    user: {
      additionalFields: {
        firstName: { type: "string", required: true, input: false },
        lastName: { type: "string", required: true, input: false },
        locale: { type: "string", required: false, input: false, defaultValue: "de" },
        theme: { type: "string", required: false, input: false, defaultValue: "system" },
        onboardingStatus: {
          type: "string",
          required: false,
          input: false,
          defaultValue: "active",
        },
      },
    },
    rateLimit: {
      enabled: env.NODE_ENV !== "test",
      storage: "memory",
      window: limits.windowSeconds,
      max: limits.max,
      customRules: {
        "/sign-in/email": { window: limits.windowSeconds, max: limits.signInMax },
        "/request-password-reset": { window: limits.windowSeconds, max: limits.passwordResetMax },
        "/reset-password": { window: limits.windowSeconds, max: limits.passwordResetMax },
        "/change-password": { window: limits.windowSeconds, max: limits.signInMax },
        "/verify-password": { window: limits.windowSeconds, max: limits.signInMax },
      },
    },
    // The admin plugin is kept only for its ban check at sign-in; all its endpoints are disabled.
    plugins: [admin({ defaultRole: "employee", adminRoles: ["admin"] }), nextCookies()],
  });
}

type AuthInstance = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __onboardingAuth?: AuthInstance };

/** Created lazily so the environment is read on first use (tests and `next build` set it late). */
export function getAuth(): AuthInstance {
  globalForAuth.__onboardingAuth ??= createAuth();
  return globalForAuth.__onboardingAuth;
}

export const auth: AuthInstance = new Proxy({} as AuthInstance, {
  get: (_target, property) => Reflect.get(getAuth(), property, getAuth()),
});
