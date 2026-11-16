import { describe, expect, it } from "vitest";
import { V_FB_CONFIG } from "@/config/app";
import {
  createReportSchema,
  listReportsSchema,
  updateReportSchema,
} from "@/lib/validation/feedback";

const valid = { type: "app_bug", subject: "Broken", message: "It does not work" } as const;
const id = "6f1c0c2e-5d4b-4a53-9a57-0d5b8f9b6a11";

describe("createReportSchema", () => {
  it("trims text and defaults the path to null", () => {
    const result = createReportSchema.parse({ ...valid, subject: "  Broken  " });
    expect(result).toEqual({ ...valid, subject: "Broken", path: null });
  });

  it("enforces the subject and message limits", () => {
    const { subjectMaxLength, messageMaxLength } = V_FB_CONFIG;
    expect(
      createReportSchema.safeParse({ ...valid, subject: "x".repeat(subjectMaxLength) }).success,
    ).toBe(true);
    expect(
      createReportSchema.safeParse({ ...valid, subject: "x".repeat(subjectMaxLength + 1) }).success,
    ).toBe(false);
    expect(
      createReportSchema.safeParse({ ...valid, message: "x".repeat(messageMaxLength + 1) }).success,
    ).toBe(false);
  });

  it("rejects blank subject, message and unknown types", () => {
    expect(createReportSchema.safeParse({ ...valid, subject: "   " }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...valid, message: "" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...valid, type: "spam" }).success).toBe(false);
  });

  it("accepts in-app paths and treats blank as null", () => {
    expect(createReportSchema.parse({ ...valid, path: "/plan?x=1" }).path).toBe("/plan?x=1");
    expect(createReportSchema.parse({ ...valid, path: "  " }).path).toBeNull();
  });

  it("rejects unsafe and overlong paths", () => {
    for (const path of ["https://evil.example", "//evil.example", "/a\\b", "plan"]) {
      expect(createReportSchema.safeParse({ ...valid, path }).success).toBe(false);
    }
    const tooLong = `/${"a".repeat(V_FB_CONFIG.pathMaxLength)}`;
    const result = createReportSchema.safeParse({ ...valid, path: tooLong });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("validation.tooLong");
  });
});

describe("updateReportSchema", () => {
  it("normalises a blank response to null and caps its length", () => {
    expect(updateReportSchema.parse({ id, status: "done", response: "  " }).response).toBeNull();
    expect(
      updateReportSchema.safeParse({
        id,
        status: "done",
        response: "x".repeat(V_FB_CONFIG.responseMaxLength + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects unknown statuses and bad ids", () => {
    expect(updateReportSchema.safeParse({ id, status: "closed", response: null }).success).toBe(
      false,
    );
    expect(updateReportSchema.safeParse({ id: "x", status: "open", response: null }).success).toBe(
      false,
    );
  });
});

describe("listReportsSchema", () => {
  it("accepts optional filters only from the enums", () => {
    expect(listReportsSchema.parse({})).toEqual({});
    expect(listReportsSchema.safeParse({ status: "nope" }).success).toBe(false);
  });
});
