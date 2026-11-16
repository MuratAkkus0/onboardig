import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { F2B_CONFIG, ROUTES } from "@/config/app";

const getSessionCookie = vi.hoisted(() => vi.fn());
vi.mock("better-auth/cookies", () => ({ getSessionCookie }));

const { proxy } = await import("@/proxy");

function run(path: string) {
  return proxy(new NextRequest(new URL(path, "http://localhost")));
}

function redirectTarget(response: Response): URL | null {
  const location = response.headers.get("location");
  return location ? new URL(location) : null;
}

describe("proxy", () => {
  beforeEach(() => {
    getSessionCookie.mockReset();
    getSessionCookie.mockReturnValue(null);
  });

  it.each([
    ROUTES.home,
    ROUTES.login,
    ROUTES.setPassword,
    ROUTES.forgotPassword,
    ROUTES.resetPassword,
  ])("lets %s through without a session cookie", (path) => {
    expect(redirectTarget(run(path))).toBeNull();
  });

  it.each([ROUTES.plan, ROUTES.admin, "/team/abc", "/plan/"])(
    "sends %s to the login page without a session cookie",
    (path) => {
      const target = redirectTarget(run(`${path}?x=1`));
      expect(target?.pathname).toBe(ROUTES.login);
      expect(target?.searchParams.get(F2B_CONFIG.queryParams.next)).toBe(`${path}?x=1`);
    },
  );

  it("lets protected paths through when a session cookie exists", () => {
    getSessionCookie.mockReturnValue("token");
    expect(redirectTarget(run(ROUTES.plan))).toBeNull();
  });
});
