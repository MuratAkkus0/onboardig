import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";
import { env } from "@/config/env";
import "@/lib/validation/common"; // registers the zod error map
import type { Actor } from "@/server/auth/types";
import { AppError } from "@/server/errors";

const getActor = vi.hoisted(() => vi.fn());
vi.mock("@/server/auth/actor", () => ({ getActor }));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { withActor } = await import("@/server/http/route");

const actor: Actor = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "employee",
  email: "e@example.test",
  firstName: "E",
  lastName: "E",
  locale: "de",
  theme: "system",
};

function request(method: string, origin?: string): NextRequest {
  return new Request("http://localhost/api/x", {
    method,
    headers: origin ? { origin } : {},
  }) as unknown as NextRequest;
}

const ctx = { params: Promise.resolve({ id: "abc" }) };

describe("withActor", () => {
  beforeEach(() => {
    getActor.mockReset();
    getActor.mockResolvedValue(actor);
  });

  it("answers 401 without a session", async () => {
    getActor.mockResolvedValue(null);
    const response = await withActor<{ id: string }>(async () => new Response("ok"))(
      request("GET"),
      ctx,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "UNAUTHENTICATED",
      messageKey: "errors.UNAUTHENTICATED",
    });
  });

  it("passes the actor and the resolved params to the handler", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    await withActor<{ id: string }>(handler)(request("GET"), ctx);
    expect(handler).toHaveBeenCalledWith(expect.anything(), { actor, params: { id: "abc" } });
  });

  it("rejects unsafe methods from a foreign or missing origin", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withActor<{ id: string }>(handler);
    expect((await wrapped(request("POST", "https://evil.example"), ctx)).status).toBe(403);
    expect((await wrapped(request("POST"), ctx)).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect((await wrapped(request("POST", new URL(env.APP_URL).origin), ctx)).status).toBe(200);
  });

  it("maps AppError and ZodError to HTTP statuses", async () => {
    const locked = withActor<{ id: string }>(async () => {
      throw new AppError("LOCK_HELD", { holderName: "Ada" });
    });
    const lockedResponse = await locked(request("GET"), ctx);
    expect(lockedResponse.status).toBe(423);
    expect(await lockedResponse.json()).toMatchObject({ details: { holderName: "Ada" } });

    const invalid = withActor<{ id: string }>(async () => {
      z.object({ name: z.string() }).parse({});
      throw new ZodError([]);
    });
    const invalidResponse = await invalid(request("GET"), ctx);
    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({
      code: "VALIDATION",
      details: { fieldErrors: { name: ["validation.required"] } },
    });
  });

  it("maps uncaught postgres errors and unknown failures", async () => {
    const unique = withActor<{ id: string }>(async () => {
      throw Object.assign(new Error("dup"), { code: "23505" });
    });
    expect((await unique(request("GET"), ctx)).status).toBe(409);

    const boom = withActor<{ id: string }>(async () => {
      throw new Error("boom");
    });
    expect((await boom(request("GET"), ctx)).status).toBe(500);
  });
});
