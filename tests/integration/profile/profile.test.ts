import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { updateMyPreferences } from "@/server/services/profile";
import { createAdmin, createEmployee, createLead } from "../../factories";
import { actorOf } from "../../helpers";

describe("updateMyPreferences", () => {
  it("lets every role change its own locale and theme", async () => {
    for (const user of [await createAdmin(), await createLead(), await createEmployee()]) {
      const result = await updateMyPreferences(actorOf(user), { locale: "en", theme: "dark" });
      expect(result).toEqual({ locale: "en", theme: "dark" });
      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      expect(row).toMatchObject({ locale: "en", theme: "dark" });
    }
  });

  it("changes one preference without touching the other", async () => {
    const user = await createEmployee({ locale: "de", theme: "light" });
    expect(await updateMyPreferences(actorOf(user), { theme: "system" })).toEqual({
      locale: "de",
      theme: "system",
    });
  });

  it("never changes another user", async () => {
    const actor = await createEmployee();
    const other = await createEmployee({ locale: "de", theme: "light" });
    await updateMyPreferences(actorOf(actor), { locale: "en" });
    const [row] = await db.select().from(users).where(eq(users.id, other.id));
    expect(row).toMatchObject({ locale: "de", theme: "light" });
  });

  it("rejects empty and invalid input", async () => {
    const user = await createEmployee();
    await expect(updateMyPreferences(actorOf(user), {})).rejects.toThrow();
    await expect(updateMyPreferences(actorOf(user), { theme: "neon" as never })).rejects.toThrow();
    await expect(updateMyPreferences(actorOf(user), { locale: "fr" as never })).rejects.toThrow();
  });
});
