import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import type { Actor } from "@/server/auth/types";
import { pageEditLocks } from "@/server/db/schema";
import { acquireLock } from "@/server/services/locks";
import { createEmployee, createPage } from "../../factories";
import { actorOf, testDb } from "../../helpers";
import { adminActor } from "./fixtures";

const getActor = vi.hoisted(() => vi.fn<() => Promise<Actor | null>>());
vi.mock("@/server/auth/actor", () => ({ getActor }));

const heartbeatRoute = await import("@/app/api/locks/[pageId]/heartbeat/route");
const releaseRoute = await import("@/app/api/locks/[pageId]/release/route");

const origin = () => new URL(env.APP_URL).origin;
const post = (pageId: string, kind: "heartbeat" | "release", from: string | null = origin()) =>
  new NextRequest(`http://localhost/api/locks/${pageId}/${kind}`, {
    method: "POST",
    headers: from ? { origin: from } : {},
  });
const ctx = (pageId: string) => ({ params: Promise.resolve({ pageId }) });

beforeEach(() => getActor.mockReset());

describe("lock routes", () => {
  it("answers 401 without a session", async () => {
    getActor.mockResolvedValue(null);
    const page = await createPage();
    expect((await heartbeatRoute.POST(post(page.id, "heartbeat"), ctx(page.id))).status).toBe(401);
    expect((await releaseRoute.POST(post(page.id, "release"), ctx(page.id))).status).toBe(401);
  });

  it("answers 403 to employees and to a foreign origin", async () => {
    const page = await createPage();
    getActor.mockResolvedValue(actorOf(await createEmployee()));
    expect((await heartbeatRoute.POST(post(page.id, "heartbeat"), ctx(page.id))).status).toBe(403);
    const { actor } = await adminActor();
    getActor.mockResolvedValue(actor);
    expect(
      (await releaseRoute.POST(post(page.id, "release", "https://evil.example"), ctx(page.id)))
        .status,
    ).toBe(403);
    expect((await releaseRoute.POST(post(page.id, "release", null), ctx(page.id))).status).toBe(
      403,
    );
  });

  it("heartbeat renews the lease and reports a lock held by somebody else", async () => {
    const owner = await adminActor();
    const me = await adminActor();
    const page = await createPage();
    await acquireLock(owner.actor, { pageId: page.id });

    getActor.mockResolvedValue(me.actor);
    const taken = await heartbeatRoute.POST(post(page.id, "heartbeat"), ctx(page.id));
    expect(taken.status).toBe(200);
    expect(await taken.json()).toMatchObject({ held: false, holderName: owner.user.name });

    getActor.mockResolvedValue(owner.actor);
    const renewed = await heartbeatRoute.POST(post(page.id, "heartbeat"), ctx(page.id));
    expect(await renewed.json()).toMatchObject({ held: true });
  });

  it("release deletes only the caller's lock (beacon style, empty body)", async () => {
    const owner = await adminActor();
    const other = await adminActor();
    const page = await createPage();
    await acquireLock(owner.actor, { pageId: page.id });

    getActor.mockResolvedValue(other.actor);
    expect((await releaseRoute.POST(post(page.id, "release"), ctx(page.id))).status).toBe(204);
    expect(
      await testDb.select().from(pageEditLocks).where(eq(pageEditLocks.pageId, page.id)),
    ).toHaveLength(1);

    getActor.mockResolvedValue(owner.actor);
    expect((await releaseRoute.POST(post(page.id, "release"), ctx(page.id))).status).toBe(204);
    expect(
      await testDb.select().from(pageEditLocks).where(eq(pageEditLocks.pageId, page.id)),
    ).toHaveLength(0);
  });

  it("maps a malformed page id to 400", async () => {
    const { actor } = await adminActor();
    getActor.mockResolvedValue(actor);
    expect((await heartbeatRoute.POST(post("nope", "heartbeat"), ctx("nope"))).status).toBe(400);
  });
});
