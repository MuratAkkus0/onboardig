import { describe, expect, it } from "vitest";
import { resolveNotificationParams } from "@/lib/domain/notification-params";

describe("resolveNotificationParams", () => {
  it("picks the English title for English viewers and falls back to German", () => {
    const withEn = { titleDe: "Seite", titleEn: "Page", other: 1 };
    expect(resolveNotificationParams(withEn, "en")).toEqual({ title: "Page", other: 1 });
    expect(resolveNotificationParams(withEn, "de")).toEqual({ title: "Seite", other: 1 });
    expect(resolveNotificationParams({ titleDe: "Seite", titleEn: null }, "en")).toEqual({
      title: "Seite",
    });
  });

  it("leaves params without titles untouched", () => {
    const params = { employeeName: "Ada" };
    expect(resolveNotificationParams(params, "en")).toBe(params);
  });
});
