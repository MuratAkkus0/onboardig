"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import type {
  CreateDepartmentInput,
  CreateTeamInput,
  OrgIdInput,
  UpdateDepartmentInput,
  UpdateTeamInput,
} from "@/lib/validation/org";
import { runAction } from "@/server/actions/run-action";
import {
  createDepartment,
  createTeam,
  deleteDepartment,
  deleteTeam,
  getDepartmentUsage,
  getTeamUsage,
  updateDepartment,
  updateTeam,
  type DepartmentUsage,
  type OrgEntry,
  type TeamUsage,
} from "@/server/services/org";

export async function createDepartmentAction(
  input: CreateDepartmentInput,
): Promise<ActionResult<OrgEntry>> {
  return runAction(async (actor) => {
    const result = await createDepartment(actor, input);
    revalidatePath(ROUTES.adminOrg);
    return result;
  });
}

export async function updateDepartmentAction(
  input: UpdateDepartmentInput,
): Promise<ActionResult<OrgEntry>> {
  return runAction(async (actor) => {
    const result = await updateDepartment(actor, input);
    revalidatePath(ROUTES.adminOrg);
    return result;
  });
}

export async function getDepartmentUsageAction(
  input: OrgIdInput,
): Promise<ActionResult<DepartmentUsage>> {
  return runAction((actor) => getDepartmentUsage(actor, input));
}

export async function deleteDepartmentAction(input: OrgIdInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await deleteDepartment(actor, input);
    revalidatePath(ROUTES.adminOrg);
  });
}

export async function createTeamAction(input: CreateTeamInput): Promise<ActionResult<OrgEntry>> {
  return runAction(async (actor) => {
    const result = await createTeam(actor, input);
    revalidatePath(ROUTES.adminOrg);
    return result;
  });
}

export async function updateTeamAction(input: UpdateTeamInput): Promise<ActionResult<OrgEntry>> {
  return runAction(async (actor) => {
    const result = await updateTeam(actor, input);
    revalidatePath(ROUTES.adminOrg);
    return result;
  });
}

export async function getTeamUsageAction(input: OrgIdInput): Promise<ActionResult<TeamUsage>> {
  return runAction((actor) => getTeamUsage(actor, input));
}

export async function deleteTeamAction(input: OrgIdInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await deleteTeam(actor, input);
    revalidatePath(ROUTES.adminOrg);
  });
}
