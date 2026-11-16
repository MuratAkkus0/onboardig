"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import type { CreateReportInput, UpdateReportInput } from "@/lib/validation/feedback";
import { createReport, deleteReport, updateReport } from "@/server/services/feedback";
import { runAction } from "./run-action";

/** Badges live in the app layout, so a status change or deletion refreshes the whole layout. */
function revalidateReports() {
  revalidatePath("/", "layout");
}

/** "Problem melden": any signed-in role. Failures (validation, RATE_LIMITED) come back as results. */
export async function createReportAction(input: CreateReportInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await createReport(actor, input);
    revalidateReports();
  });
}

export async function updateReportAction(input: UpdateReportInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await updateReport(actor, input);
    revalidateReports();
  });
}

export async function deleteReportAction(id: string): Promise<ActionResult> {
  return runAction(async (actor) => {
    await deleteReport(actor, { id });
    revalidateReports();
  });
}
