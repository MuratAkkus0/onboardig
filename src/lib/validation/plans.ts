import { z } from "zod";
import { idSchema, phaseSchema } from "./common";

export const userIdInputSchema = z.object({ userId: idSchema });

export const assignTemplatesSchema = z.object({
  userId: idSchema,
  templateIds: z
    .array(idSchema)
    .min(1)
    .transform((ids) => [...new Set(ids)]),
});

export const addPlanStepSchema = z.object({
  userId: idSchema,
  pageId: idSchema,
  phase: phaseSchema,
});

export const removePlanStepSchema = z.object({ userId: idSchema, pageId: idSchema });

export const setStepCompletionSchema = z.object({ pageId: idSchema, completed: z.boolean() });

export const pageIdInputSchema = z.object({ pageId: idSchema });

export type AssignTemplatesInput = z.input<typeof assignTemplatesSchema>;
export type AddPlanStepInput = z.input<typeof addPlanStepSchema>;
export type RemovePlanStepInput = z.input<typeof removePlanStepSchema>;
export type SetStepCompletionInput = z.input<typeof setStepCompletionSchema>;
