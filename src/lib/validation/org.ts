import { z } from "zod";
import { W1_ORG_CONFIG } from "@/config/app";
import { idSchema } from "./common";

export const orgNameSchema = z.string().trim().min(1).max(W1_ORG_CONFIG.nameMaxLength);

export const orgIdInputSchema = z.object({ id: idSchema });

export const createDepartmentSchema = z.object({ name: orgNameSchema });
export const updateDepartmentSchema = z.object({ id: idSchema, name: orgNameSchema });

export const createTeamSchema = z.object({ departmentId: idSchema, name: orgNameSchema });
export const updateTeamSchema = z.object({
  id: idSchema,
  name: orgNameSchema,
  departmentId: idSchema,
});

export const createJobRoleSchema = z.object({ name: orgNameSchema });
export const updateJobRoleSchema = z.object({ id: idSchema, name: orgNameSchema });

export type OrgIdInput = z.input<typeof orgIdInputSchema>;
export type CreateDepartmentInput = z.input<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.input<typeof updateDepartmentSchema>;
export type CreateTeamInput = z.input<typeof createTeamSchema>;
export type UpdateTeamInput = z.input<typeof updateTeamSchema>;
export type CreateJobRoleInput = z.input<typeof createJobRoleSchema>;
export type UpdateJobRoleInput = z.input<typeof updateJobRoleSchema>;
