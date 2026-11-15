import { describe, expect, it } from "vitest";
import { eventInputSchema } from "@/lib/validation/events";

const base = {
  titleDe: "Willkommenstag",
  descriptionDe: "Kennenlernen",
  startsAt: new Date("2026-12-01T09:00:00Z"),
  endsAt: new Date("2026-12-01T11:00:00Z"),
};

function issues(input: unknown) {
  const result = eventInputSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

describe("eventInputSchema", () => {
  it("accepts a German-only event and normalises blanks to null", () => {
    const parsed = eventInputSchema.parse({
      ...base,
      titleEn: "  ",
      descriptionEn: "",
      location: " ",
    });
    expect(parsed).toMatchObject({ titleEn: null, descriptionEn: null, location: null });
  });

  it("accepts ISO strings for the times", () => {
    const parsed = eventInputSchema.parse({ ...base, startsAt: "2026-12-01T09:00:00Z" });
    expect(parsed.startsAt).toBeInstanceOf(Date);
  });

  it("requires English title and description together (both-or-none)", () => {
    expect(issues({ ...base, titleEn: "Welcome day" })).toEqual([
      { path: "descriptionEn", message: "validation.required" },
    ]);
    expect(issues({ ...base, descriptionEn: "Getting to know each other" })).toEqual([
      { path: "titleEn", message: "validation.required" },
    ]);
    expect(issues({ ...base, titleEn: "Welcome day", descriptionEn: "Hello" })).toEqual([]);
  });

  it("rejects an end before the start but allows equal times", () => {
    expect(issues({ ...base, endsAt: new Date("2026-12-01T08:00:00Z") })).toEqual([
      { path: "endsAt", message: "events.errors.endBeforeStart" },
    ]);
    expect(issues({ ...base, endsAt: base.startsAt })).toEqual([]);
  });

  it("rejects missing German fields and invalid dates", () => {
    expect(issues({ ...base, titleDe: " " }).map((i) => i.path)).toEqual(["titleDe"]);
    expect(issues({ ...base, descriptionDe: "" }).map((i) => i.path)).toEqual(["descriptionDe"]);
    expect(issues({ ...base, startsAt: "not a date" }).map((i) => i.path)).toContain("startsAt");
  });
});
