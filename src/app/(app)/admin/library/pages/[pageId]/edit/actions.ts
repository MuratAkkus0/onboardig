"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions/run-action";
import { acquireLock, takeOverLock, type LockState } from "@/server/services/locks";
import { savePageContent } from "@/server/services/pages";

export interface SavedPage {
  lastEditedAt: Date;
  lastEditedByName: string | null;
}

export async function acquireLockAction(input: {
  pageId: string;
}): Promise<ActionResult<LockState>> {
  return runAction((actor) => acquireLock(actor, input));
}

export async function takeOverLockAction(input: {
  pageId: string;
}): Promise<ActionResult<LockState>> {
  return runAction((actor) => takeOverLock(actor, input));
}

export async function savePageAction(input: {
  id: string;
  titleDe: string;
  titleEn: string | null;
  contentDe: unknown;
  contentEn: unknown;
}): Promise<ActionResult<SavedPage>> {
  return runAction(async (actor) => {
    const page = await savePageContent(actor, input);
    revalidatePath(ROUTES.adminLibrary);
    revalidatePath(ROUTES.library);
    revalidatePath(ROUTES.page(page.id));
    return { lastEditedAt: page.lastEditedAt, lastEditedByName: page.lastEditedByName };
  });
}
