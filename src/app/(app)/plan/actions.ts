"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import type { OnboardingStatus } from "@/lib/domain/onboarding-status";
import { runAction } from "@/server/actions/run-action";
import { dismissStepUpdate, setStepCompletion } from "@/server/services/plans";

/** "Erledigt" toggle and undo for the signed-in user's own plan (rendered on /plan and /pages/[id]). */
export async function setStepCompletionAction(
  pageId: string,
  completed: boolean,
): Promise<ActionResult<{ status: OnboardingStatus }>> {
  const result = await runAction(async (actor) => {
    const { status } = await setStepCompletion(actor, { pageId, completed });
    return { status };
  });
  if (result.ok) {
    revalidatePath(ROUTES.plan);
    revalidatePath(ROUTES.page(pageId));
  }
  return result;
}

/** Dismisses the "updated since completion" badge of an own completed step. */
export async function dismissStepUpdateAction(pageId: string): Promise<ActionResult<null>> {
  const result = await runAction(async (actor) => {
    await dismissStepUpdate(actor, { pageId });
    return null;
  });
  if (result.ok) {
    revalidatePath(ROUTES.plan);
    revalidatePath(ROUTES.page(pageId));
  }
  return result;
}
