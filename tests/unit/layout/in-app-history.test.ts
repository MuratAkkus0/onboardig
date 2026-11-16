import { beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  vi.resetModules();
  return import("@/lib/in-app-history");
}

describe("in-app history", () => {
  let history: Awaited<ReturnType<typeof load>>;
  beforeEach(async () => {
    history = await load();
  });

  it("has no history on the first page, also when the effect runs twice", () => {
    history.recordPathname("/pages/1");
    history.recordPathname("/pages/1");
    expect(history.hasInAppHistory()).toBe(false);
  });

  it("has history once the user moved to another page", () => {
    history.recordPathname("/plan");
    history.recordPathname("/pages/1");
    expect(history.hasInAppHistory()).toBe(true);
  });
});
