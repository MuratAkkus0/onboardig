import { describe, expect, it } from "vitest";
import { computeProgress } from "@/lib/domain/progress";

describe("computeProgress", () => {
  it("is 0 percent for an empty plan", () => {
    expect(computeProgress(0, 0)).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it("rounds the completed share", () => {
    expect(computeProgress(1, 3).percent).toBe(33);
    expect(computeProgress(2, 3).percent).toBe(67);
    expect(computeProgress(1, 8).percent).toBe(13);
  });

  it("reaches 100 only when everything is done", () => {
    expect(computeProgress(3, 3).percent).toBe(100);
    expect(computeProgress(0, 5).percent).toBe(0);
  });
});
