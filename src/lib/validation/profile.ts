import { z } from "zod";
import { THEMES } from "@/config/app";
import { localeSchema } from "./common";

export const themeSchema = z.enum(THEMES);

/** At least one preference must be present. */
export const updatePreferencesSchema = z
  .object({ locale: localeSchema.optional(), theme: themeSchema.optional() })
  .refine((value) => value.locale !== undefined || value.theme !== undefined, {
    error: "validation.required",
  });

export type UpdatePreferencesInput = z.input<typeof updatePreferencesSchema>;
