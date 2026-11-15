import { z } from "zod";
import { ONBOARDING_STATUSES, ROLES, W1_ORG_CONFIG } from "@/config/app";
import { idSchema, localeSchema } from "./common";

type Role = (typeof ROLES)[number];

export type RoleBoundField = "teamId" | "jobRoleId" | "leadId" | "startDate";

/** Which optional-in-the-database fields a role must have (blueprint section 2.3). */
const REQUIRED_BY_ROLE: Record<Role, readonly RoleBoundField[]> = {
  employee: ["teamId", "jobRoleId", "leadId", "startDate"],
  team_lead: ["teamId", "jobRoleId", "startDate"],
  admin: [],
};

export function requiredFieldsFor(role: Role): readonly RoleBoundField[] {
  return REQUIRED_BY_ROLE[role];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Forms send "" for an empty select; the service works with null. */
const optionalId = z
  .union([idSchema, z.literal("")])
  .nullish()
  .transform((value) => value || null);

const optionalDate = z
  .string()
  .nullish()
  .transform((value) => (value == null || value.trim() === "" ? null : value.trim()))
  .refine((value) => value === null || isRealDate(value), { error: "validation.invalid" });

const personName = z.string().trim().min(1).max(W1_ORG_CONFIG.personNameMaxLength);

const userFields = z.object({
  firstName: personName,
  lastName: personName,
  email: z.string().trim().toLowerCase().max(W1_ORG_CONFIG.emailMaxLength).pipe(z.email()),
  role: z.enum(ROLES),
  teamId: optionalId,
  jobRoleId: optionalId,
  leadId: optionalId,
  startDate: optionalDate,
  locale: localeSchema,
});

type RoleBoundValues = Record<RoleBoundField, string | null> & { role: Role };

function requireRoleFields(data: RoleBoundValues, ctx: z.RefinementCtx): void {
  for (const field of REQUIRED_BY_ROLE[data.role]) {
    if (data[field] === null) {
      ctx.addIssue({ code: "custom", path: [field], message: "validation.required" });
    }
  }
}

export const createUserSchema = userFields.superRefine(requireRoleFields);
export const updateUserSchema = userFields.extend({ id: idSchema }).superRefine(requireRoleFields);

export const userIdInputSchema = z.object({ id: idSchema });

export const deleteUserPermanentlySchema = z.object({
  id: idSchema,
  confirmName: z.string(),
});

export const listUsersSchema = z.object({
  status: z.enum(ONBOARDING_STATUSES).optional(),
  role: z.enum(ROLES).optional(),
  departmentId: idSchema.optional(),
  teamId: idSchema.optional(),
  q: z
    .string()
    .trim()
    .max(W1_ORG_CONFIG.searchMaxLength)
    .optional()
    .transform((value) => value || undefined),
});

export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type UserIdInput = z.input<typeof userIdInputSchema>;
export type DeleteUserPermanentlyInput = z.input<typeof deleteUserPermanentlySchema>;
export type ListUsersInput = z.input<typeof listUsersSchema>;
