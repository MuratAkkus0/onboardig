import { z } from "zod";
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, V_FB_CONFIG } from "@/config/app";
import { safeNextPath } from "@/lib/navigation";
import { idSchema, optionalText } from "./common";

const { subjectMaxLength, messageMaxLength, pathMaxLength, responseMaxLength } = V_FB_CONFIG;

export const feedbackTypeSchema = z.enum(FEEDBACK_TYPES);
export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES);

/** Optional same-origin in-app path; blank becomes null, anything unsafe or too long is rejected. */
const reportPathSchema = optionalText.superRefine((value, ctx) => {
  if (value === null) return;
  if (value.length > pathMaxLength) {
    ctx.addIssue({ code: "custom", message: "validation.tooLong" });
  } else if (safeNextPath(value) === null) {
    ctx.addIssue({ code: "custom", message: "validation.invalid" });
  }
});

export const createReportSchema = z.object({
  type: feedbackTypeSchema,
  subject: z.string().trim().min(1).max(subjectMaxLength),
  message: z.string().trim().min(1).max(messageMaxLength),
  path: reportPathSchema.default(null),
});

export const listReportsSchema = z.object({
  status: feedbackStatusSchema.optional(),
  type: feedbackTypeSchema.optional(),
});

export const updateReportSchema = z.object({
  id: idSchema,
  status: feedbackStatusSchema,
  response: optionalText.refine((value) => value === null || value.length <= responseMaxLength, {
    error: "validation.tooLong",
  }),
});

export const reportIdSchema = z.object({ id: idSchema });

export type CreateReportInput = z.input<typeof createReportSchema>;
export type ListReportsInput = z.input<typeof listReportsSchema>;
export type UpdateReportInput = z.input<typeof updateReportSchema>;
