import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/auth";
import { notifications, pageCompletions, pages, users } from "@/server/db/schema";
import { listEvents } from "@/server/services/events";
import { getPlanForUser } from "@/server/services/plans";
import { listUsers } from "@/server/services/users";
import { SeedRefusedError } from "../../../scripts/demo-data/guard";
import { DEMO_PEOPLE } from "../../../scripts/demo-data/people";
import { runDemoSeed, type SeedResult } from "../../../scripts/demo-data/run";
import { actorOf, testDb } from "../../helpers";
import { createAdmin } from "../../factories";

const PASSWORD = "demo-password-for-tests";

describe("seed:demo", () => {
  let result: SeedResult;

  beforeEach(async () => {
    result = await runDemoSeed({ reset: false, password: PASSWORD });
  });

  it("creates all roles and lets every demo account sign in", async () => {
    expect(result.password).toBe(PASSWORD);
    const rows = await testDb.select().from(users);
    expect(rows.filter((u) => u.role === "admin")).toHaveLength(1);
    expect(rows.filter((u) => u.role === "team_lead")).toHaveLength(2);
    expect(rows.filter((u) => u.role === "employee")).toHaveLength(5);

    for (const entry of result.credentials) {
      const row = rows.find((u) => u.email === entry.email);
      if (row?.banned) continue;
      const signedIn = await auth.api.signInEmail({
        body: { email: entry.email, password: PASSWORD },
      });
      expect(signedIn.user.email).toBe(entry.email);
    }
  });

  it("produces employees in every onboarding state with partial progress", async () => {
    const rows = await testDb.select().from(users);
    const byEmail = (key: string) => {
      const person = DEMO_PEOPLE.find((p) => p.key === key);
      const row = rows.find((u) => u.email === person?.email);
      if (!row) throw new Error(`missing ${key}`);
      return row;
    };
    expect(byEmail("tim").onboardingStatus).toBe("completed");
    expect(byEmail("clara").onboardingStatus).toBe("archived");
    expect(byEmail("lena").onboardingStatus).toBe("active");

    const [admin] = rows.filter((u) => u.role === "admin");
    if (!admin) throw new Error("no admin");
    const lena = await getPlanForUser(actorOf(admin), { userId: byEmail("lena").id });
    expect(lena.progress.completed).toBe(6);
    expect(lena.progress.total).toBeGreaterThan(6);
    const mia = await getPlanForUser(actorOf(admin), { userId: byEmail("mia").id });
    expect(mia.progress.total).toBe(0);

    const [completions] = await testDb.select({ value: count() }).from(pageCompletions);
    expect(completions?.value).toBeGreaterThan(0);
  });

  it("publishes pages with German and English content, keeps a draft and an archived page", async () => {
    const rows = await testDb.select().from(pages);
    expect(rows.filter((p) => p.status === "published").length).toBeGreaterThan(10);
    expect(rows.filter((p) => p.status === "draft")).toHaveLength(1);
    expect(rows.filter((p) => p.status === "archived")).toHaveLength(1);
    expect(rows.filter((p) => p.status === "published").every((p) => p.titleEn !== null)).toBe(
      true,
    );
  });

  it("creates upcoming and past events and notifications of several types", async () => {
    const [admin] = await testDb.select().from(users).where(eq(users.role, "admin"));
    if (!admin) throw new Error("no admin");
    const { upcoming, past } = await listEvents(actorOf(admin));
    expect(upcoming.length).toBeGreaterThanOrEqual(2);
    expect(past.length).toBeGreaterThanOrEqual(1);

    const types = new Set((await testDb.select().from(notifications)).map((n) => n.type));
    expect(types).toEqual(
      new Set([
        "step_added",
        "page_updated",
        "event_announced",
        "employee_assigned",
        "onboarding_completed",
      ]),
    );
  });

  it("refuses to run again while users exist", async () => {
    await expect(runDemoSeed({ reset: false })).rejects.toBeInstanceOf(SeedRefusedError);
    const [admin] = await testDb.select().from(users).where(eq(users.role, "admin"));
    if (!admin) throw new Error("no admin");
    expect(await listUsers(actorOf(admin))).toHaveLength(8);
  });

  it("refuses --reset when NODE_ENV is production and leaves the data untouched", async () => {
    await expect(runDemoSeed({ reset: true, nodeEnv: "production" })).rejects.toBeInstanceOf(
      SeedRefusedError,
    );
    const [row] = await testDb.select({ value: count() }).from(users);
    expect(row?.value).toBe(8);
  });

  it("--reset on a non-production database wipes foreign data and reseeds", async () => {
    await createAdmin({ email: "other@example.com" });
    const again = await runDemoSeed({ reset: true, nodeEnv: "development", password: PASSWORD });
    expect(again.credentials).toHaveLength(8);
    const rows = await testDb.select().from(users);
    expect(rows).toHaveLength(8);
    expect(rows.some((u) => u.email === "other@example.com")).toBe(false);
  });
});
