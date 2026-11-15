"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import type { CreateJobRoleInput, OrgIdInput, UpdateJobRoleInput } from "@/lib/validation/org";
import { runAction } from "@/server/actions/run-action";
import {
  createJobRole,
  deleteJobRole,
  getJobRoleUsage,
  updateJobRole,
  type JobRoleUsage,
  type OrgEntry,
} from "@/server/services/org";

export async function createJobRoleAction(
  input: CreateJobRoleInput,
): Promise<ActionResult<OrgEntry>> {
  return runAction(async (actor) => {
    const result = await createJobRole(actor, input);
    revalidatePath(ROUTES.adminJobRoles);
    return result;
  });
}

export async function updateJobRoleAction(
  input: UpdateJobRoleInput,
): Promise<ActionResult<OrgEntry>> {
  return runAction(async (actor) => {
    const result = await updateJobRole(actor, input);
    revalidatePath(ROUTES.adminJobRoles);
    return result;
  });
}

export async function getJobRoleUsageAction(
  input: OrgIdInput,
): Promise<ActionResult<JobRoleUsage>> {
  return runAction((actor) => getJobRoleUsage(actor, input));
}

export async function deleteJobRoleAction(input: OrgIdInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await deleteJobRole(actor, input);
    revalidatePath(ROUTES.adminJobRoles);
  });
}
