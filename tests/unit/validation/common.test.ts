import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "@/config/app";
import {
  emailSchema,
  idSchema,
  optionalText,
  passwordSchema,
  tiptapDocSchema,
} from "@/lib/validation/common";

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("common validation", () => {
  it("emits i18n keys", () => {
    expect(firstMessage(idSchema.safeParse("nope"))).toBe("validation.invalidId");
    expect(firstMessage(idSchema.safeParse(undefined))).toBe("validation.required");
    expect(firstMessage(emailSchema.safeParse("nope"))).toBe("validation.invalidEmail");
    expect(firstMessage(passwordSchema.safeParse("short"))).toBe("validation.passwordTooShort");
    expect(
      firstMessage(passwordSchema.safeParse("x".repeat(APP_CONFIG.auth.passwordMaxLength + 1))),
    ).toBe("validation.passwordTooLong");
  });

  it("normalizes email and optional text", () => {
    expect(emailSchema.parse("  Ada@Example.TEST ")).toBe("ada@example.test");
    expect(optionalText.parse("  ")).toBeNull();
    expect(optionalText.parse(undefined)).toBeNull();
    expect(optionalText.parse(" hi ")).toBe("hi");
  });

  it("checks the Tiptap document shape", () => {
    expect(tiptapDocSchema.safeParse({ type: "doc", content: [] }).success).toBe(true);
    expect(tiptapDocSchema.safeParse({ type: "paragraph" }).success).toBe(false);
  });
});
