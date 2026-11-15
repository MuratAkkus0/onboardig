import { describe, expect, it } from "vitest";
import { listNotificationsSchema, markReadSchema } from "@/lib/validation/notifications";

const ID = "0b1f6a3e-3c1d-4f7e-9d3b-6f0f6d6f2a11";

describe("listNotificationsSchema", () => {
  it("parses a cursor into timestamp text and id", () => {
    const parsed = listNotificationsSchema.parse({ cursor: `2026-11-15 22:12:01.123456+00|${ID}` });
    expect(parsed.cursor).toEqual(["2026-11-15 22:12:01.123456+00", ID]);
  });

  it("rejects malformed cursors and out-of-range limits", () => {
    expect(listNotificationsSchema.safeParse({ cursor: "garbage" }).success).toBe(false);
    expect(listNotificationsSchema.safeParse({ cursor: `x|${ID}` }).success).toBe(false);
    expect(listNotificationsSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(listNotificationsSchema.safeParse({ limit: 10_000 }).success).toBe(false);
    expect(listNotificationsSchema.safeParse({}).success).toBe(true);
  });
});

describe("markReadSchema", () => {
  it("requires a uuid", () => {
    expect(markReadSchema.safeParse({ id: ID }).success).toBe(true);
    expect(markReadSchema.safeParse({ id: "1" }).success).toBe(false);
  });
});
