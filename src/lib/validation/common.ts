import { z } from "zod";
import { APP_CONFIG, LOCALES, PHASES } from "@/config/app";
import type { TiptapDoc } from "@/server/db/schema/custom-types";

/**
 * Zod error map that emits i18n keys of the `validation` namespace instead of English text.
 * Individual schemas can override it with an explicit `error`.
 */
export const validationErrorMap: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined || issue.input === null
        ? "validation.required"
        : "validation.invalid";
    case "too_small":
      return issue.origin === "string" && issue.minimum === 1
        ? "validation.required"
        : "validation.tooShort";
    case "too_big":
      return "validation.tooLong";
    case "invalid_format":
      return issue.format === "email"
        ? "validation.invalidEmail"
        : issue.format === "uuid"
          ? "validation.invalidId"
          : "validation.invalid";
    case "invalid_value":
      return "validation.invalidValue";
    default:
      return "validation.invalid";
  }
};

z.config({ customError: validationErrorMap });

export const idSchema = z.uuid();
export const localeSchema = z.enum(LOCALES);
export const phaseSchema = z.enum(PHASES);

export const passwordSchema = z
  .string()
  .min(APP_CONFIG.auth.passwordMinLength, { error: "validation.passwordTooShort" })
  .max(APP_CONFIG.auth.passwordMaxLength, { error: "validation.passwordTooLong" });

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Optional free text: blank, null and undefined all become null, anything else is trimmed. */
export const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value == null || value.trim() === "" ? null : value.trim()));

/** Shape check only; deep sanitation is the content service's job. */
export const tiptapDocSchema = z
  .looseObject({
    type: z.literal("doc"),
    content: z.array(z.unknown()).optional(),
  })
  .transform((value) => value as TiptapDoc);
