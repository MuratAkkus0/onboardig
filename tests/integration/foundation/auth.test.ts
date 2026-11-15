import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "@/config/app";
import { env } from "@/config/env";
import { auth } from "@/server/auth/auth";
import { sessions } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { createInitialAdmin } from "@/server/services/bootstrap";
import { createUser } from "../../factories";
import { testDb } from "../../helpers/db";

const PASSWORD = "correct horse battery staple";

// Endpoints of auth.api that stay reachable. Anything else must be listed in disabledPaths, so a
// Better Auth upgrade that adds an endpoint fails this test until someone decides.
const ENABLED_PATHS = new Set([
  "/sign-in/email",
  "/get-session",
  "/sign-out",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/change-password",
  "/verify-password",
  "/update-session",
  "/list-accounts",
  "/account-info",
  "/callback/:id", // no social providers are configured, so this is inert
  "/ok",
  "/error",
]);

function authRequest(path: string, init: { method: string; cookie?: string; body?: unknown }) {
  return auth.handler(
    new Request(`${env.APP_URL}/api/auth${path}`, {
      method: init.method,
      headers: {
        "content-type": "application/json",
        origin: env.APP_URL,
        ...(init.cookie ? { cookie: init.cookie } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

async function signInCookie(email: string): Promise<string> {
  const response = await authRequest("/sign-in/email", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

describe("auth core", () => {
  it("lets a seeded admin sign in", async () => {
    const { userId } = await createInitialAdmin({
      email: "Admin@Example.test",
      password: PASSWORD,
      firstName: "Ada",
      lastName: "Admin",
      locale: "de",
    });
    const result = await auth.api.signInEmail({
      body: { email: "admin@example.test", password: PASSWORD },
    });
    expect(result.user.id).toBe(userId);
  });

  it("refuses a second admin with the same email", async () => {
    const input = {
      email: "admin@example.test",
      password: PASSWORD,
      firstName: "Ada",
      lastName: "Admin",
      locale: "de",
    } as const;
    await createInitialAdmin(input);
    await expect(createInitialAdmin(input)).rejects.toMatchObject({
      code: "EMAIL_TAKEN",
    } satisfies Partial<AppError>);
  });

  it("does not let a banned user sign in", async () => {
    await createUser({
      email: "banned@example.test",
      password: PASSWORD,
      banned: true,
      banReason: "deactivated",
    });
    await expect(
      auth.api.signInEmail({ body: { email: "banned@example.test", password: PASSWORD } }),
    ).rejects.toThrow();
  });

  it("ends a session when its row is deleted", async () => {
    const user = await createUser({ email: "member@example.test", password: PASSWORD });
    const cookie = await signInCookie("member@example.test");
    const headers = new Headers({ cookie });
    expect(await auth.api.getSession({ headers })).not.toBeNull();

    await testDb.delete(sessions).where(eq(sessions.userId, user.id));
    expect(await auth.api.getSession({ headers })).toBeNull();
  });

  it("answers 404 for disabled endpoints, even for an admin session", async () => {
    await createUser({ email: "root@example.test", password: PASSWORD, role: "admin" });
    const cookie = await signInCookie("root@example.test");

    for (const path of ["/admin/set-role", "/admin/impersonate-user", "/update-user"]) {
      const response = await authRequest(path, { method: "POST", cookie, body: {} });
      expect(response.status, path).toBe(404);
    }
  });

  it("only exposes enabled or explicitly disabled endpoints", () => {
    const disabled = new Set<string>(APP_CONFIG.auth.disabledPaths);
    const paths = Object.values(auth.api)
      .map((endpoint) => (endpoint as { path?: string }).path)
      .filter((path): path is string => typeof path === "string");

    expect(paths.length).toBeGreaterThan(0);
    const unclassified = paths.filter((path) => !ENABLED_PATHS.has(path) && !disabled.has(path));
    expect(unclassified).toEqual([]);

    const enabledAndDisabled = [...ENABLED_PATHS].filter((path) => disabled.has(path));
    expect(enabledAndDisabled).toEqual([]);
  });
});
