import { z } from "zod";
import { TEMPLATE_STATUSES, W2_TEMPLATES_CONFIG } from "@/config/app";
import { directionSchema } from "@/lib/validation/content";
import { idSchema, optionalText, phaseSchema } from "./common";

/** Marker for "company-wide": stored as `department_id = null`. */
export const ALL_DEPARTMENTS = "all";

const templateName = z.string().trim().min(1).max(W2_TEMPLATES_CONFIG.nameMaxLength);

const optionalDescription = optionalText
  .pipe(z.string().max(W2_TEMPLATES_CONFIG.descriptionMaxLength).nullable())
  .default(null);

// K§5: the department is required, the admin must choose one or "all". No `.optional()` on purpose.
const departmentChoice = z.union([idSchema, z.literal(ALL_DEPARTMENTS)], {
  error: (issue) =>
    issue.input === undefined || issue.input === null || issue.input === ""
      ? "validation.required"
      : "validation.invalid",
});

const optionalId = idSchema.nullish().default(null);

const templateFields = {
  name: templateName,
  description: optionalDescription,
  departmentId: departmentChoice,
  teamId: optionalId,
  jobRoleId: optionalId,
};

export const createTemplateSchema = z.object(templateFields);
export const updateTemplateSchema = z.object({ id: idSchema, ...templateFields });

export const templateIdSchema = z.object({ id: idSchema });
export const listTemplatesSchema = z.object({ status: z.enum(TEMPLATE_STATUSES).optional() });
export const deleteTemplateSchema = z.object({
  id: idSchema,
  confirmName: z.string().optional(),
});

export const addTemplateStepSchema = z.object({
  templateId: idSchema,
  pageId: idSchema,
  phase: phaseSchema,
});
export const stepIdSchema = z.object({ stepId: idSchema });
export const moveTemplateStepSchema = z.object({ stepId: idSchema, direction: directionSchema });
export const changeTemplateStepPhaseSchema = z.object({ stepId: idSchema, phase: phaseSchema });

export type CreateTemplateInput = z.input<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.input<typeof updateTemplateSchema>;
export type TemplateIdInput = z.input<typeof templateIdSchema>;
export type ListTemplatesInput = z.input<typeof listTemplatesSchema>;
export type DeleteTemplateInput = z.input<typeof deleteTemplateSchema>;
export type AddTemplateStepInput = z.input<typeof addTemplateStepSchema>;
export type StepIdInput = z.input<typeof stepIdSchema>;
export type MoveTemplateStepInput = z.input<typeof moveTemplateStepSchema>;
export type ChangeTemplateStepPhaseInput = z.input<typeof changeTemplateStepPhaseSchema>;
