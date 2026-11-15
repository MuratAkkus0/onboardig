import { describe, expect, it } from "vitest";
import { summarizeOverview } from "@/components/dashboard/summary";
import { adminOverviewSchema } from "@/lib/validation/dashboards";

describe("summarizeOverview", () => {
  it("counts per status and averages progress", () => {
    const summary = summarizeOverview([
      { status: "active", percent: 50 },
      { status: "active", percent: 25 },
      { status: "completed", percent: 100 },
    ]);
    expect(summary).toEqual({
      total: 3,
      byStatus: { active: 2, completed: 1, archived: 0 },
      averagePercent: 58,
    });
  });

  it("handles an empty list", () => {
    expect(summarizeOverview([])).toEqual({
      total: 0,
      byStatus: { active: 0, completed: 0, archived: 0 },
      averagePercent: 0,
    });
  });
});

describe("adminOverviewSchema", () => {
  it("accepts empty input and valid filters", () => {
    expect(adminOverviewSchema.safeParse({}).success).toBe(true);
    expect(
      adminOverviewSchema.safeParse({
        departmentId: crypto.randomUUID(),
        teamId: crypto.randomUUID(),
        status: "active",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed ids and unknown status", () => {
    expect(adminOverviewSchema.safeParse({ teamId: "x" }).success).toBe(false);
    expect(adminOverviewSchema.safeParse({ status: "nope" }).success).toBe(false);
  });
});
