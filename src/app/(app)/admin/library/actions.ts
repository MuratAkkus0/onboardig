"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import type { PageAction } from "@/lib/domain/page-status";
import type { CreateModuleInput, Direction, UpdateModuleInput } from "@/lib/validation/content";
import { runAction } from "@/server/actions/run-action";
import { createModule, deleteModule, moveModule, updateModule } from "@/server/services/modules";
import {
  changePageStatus,
  createPage,
  deletePage,
  getPageDeletionImpact,
  movePage,
  movePageToModule,
  type PageDeletionImpact,
} from "@/server/services/pages";

function refreshLibrary(): void {
  revalidatePath(ROUTES.adminLibrary);
  revalidatePath(ROUTES.library);
}

export async function createModuleAction(input: CreateModuleInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await createModule(actor, input);
    refreshLibrary();
  });
}

export async function updateModuleAction(input: UpdateModuleInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await updateModule(actor, input);
    refreshLibrary();
  });
}

export async function moveModuleAction(input: {
  id: string;
  direction: Direction;
}): Promise<ActionResult> {
  return runAction(async (actor) => {
    await moveModule(actor, input);
    refreshLibrary();
  });
}

export async function deleteModuleAction(input: { id: string }): Promise<ActionResult> {
  return runAction(async (actor) => {
    await deleteModule(actor, input);
    refreshLibrary();
  });
}

export async function createPageAction(input: {
  moduleId: string;
  titleDe: string;
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async (actor) => {
    const page = await createPage(actor, input);
    refreshLibrary();
    return page;
  });
}

export async function changePageStatusAction(input: {
  id: string;
  action: PageAction;
}): Promise<ActionResult> {
  return runAction(async (actor) => {
    await changePageStatus(actor, input);
    refreshLibrary();
    revalidatePath(ROUTES.page(input.id));
  });
}

export async function movePageAction(input: {
  id: string;
  direction: Direction;
}): Promise<ActionResult> {
  return runAction(async (actor) => {
    await movePage(actor, input);
    refreshLibrary();
  });
}

export async function movePageToModuleAction(input: {
  id: string;
  moduleId: string;
}): Promise<ActionResult> {
  return runAction(async (actor) => {
    await movePageToModule(actor, input);
    refreshLibrary();
  });
}

export async function getPageDeletionImpactAction(input: {
  id: string;
}): Promise<ActionResult<PageDeletionImpact>> {
  return runAction((actor) => getPageDeletionImpact(actor, input));
}

export async function deletePageAction(input: {
  id: string;
  confirmName?: string;
}): Promise<ActionResult<{ result: "deleted" | "archived" }>> {
  return runAction(async (actor) => {
    const outcome = await deletePage(actor, input);
    refreshLibrary();
    revalidatePath(ROUTES.page(input.id));
    return outcome;
  });
}
