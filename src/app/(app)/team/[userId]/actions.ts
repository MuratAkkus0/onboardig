"use server";

import { revalidatePath } from "next/cache";
import { ROUTES, type PHASES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions/run-action";
import { addPlanStep, assignTemplates, removePlanStep } from "@/server/services/plans";

export async function assignTemplatesAction(
  userId: string,
  templateIds: string[],
): Promise<ActionResult<{ addedSteps: number }>> {
  const result = await runAction((actor) => assignTemplates(actor, { userId, templateIds }));
  if (result.ok) revalidatePath(ROUTES.teamMember(userId));
  return result;
}

export async function addPlanStepAction(
  userId: string,
  pageId: string,
  phase: (typeof PHASES)[number],
): Promise<ActionResult> {
  const result = await runAction((actor) => addPlanStep(actor, { userId, pageId, phase }));
  if (result.ok) revalidatePath(ROUTES.teamMember(userId));
  return result;
}

export async function removePlanStepAction(userId: string, pageId: string): Promise<ActionResult> {
  const result = await runAction((actor) => removePlanStep(actor, { userId, pageId }));
  if (result.ok) revalidatePath(ROUTES.teamMember(userId));
  return result;
}
