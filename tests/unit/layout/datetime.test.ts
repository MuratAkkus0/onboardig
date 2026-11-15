import { describe, expect, it } from "vitest";
import { parseBerlinLocal, toBerlinLocalInput } from "@/lib/datetime";

describe("Europe/Berlin datetime-local conversion", () => {
  it("applies CET in winter and CEST in summer", () => {
    expect(parseBerlinLocal("2026-01-15T10:00")?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(parseBerlinLocal("2026-07-15T10:00")?.toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("round-trips through the input format", () => {
    const value = "2026-03-29T14:30";
    const date = parseBerlinLocal(value);
    expect(date).not.toBeNull();
    expect(toBerlinLocalInput(date as Date)).toBe(value);
  });

  it("rejects malformed and impossible values", () => {
    expect(parseBerlinLocal("2026-01-15")).toBeNull();
    expect(parseBerlinLocal("nonsense")).toBeNull();
    expect(parseBerlinLocal("2026-02-31T10:00")).toBeNull();
  });
});
