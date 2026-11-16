"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NONE_VALUE, type TemplateFormState } from "@/components/templates/types";
import { ROUTES } from "@/config/app";
import { areaOf, areaRoutes } from "@/lib/area-routes";
import type { ActionResult } from "@/lib/action-result";
import type {
  AddTemplateStepInput,
  ChangeTemplateStepPhaseInput,
  CreateTemplateInput,
  DeleteTemplateInput,
  MoveTemplateStepInput,
  StepIdInput,
  TemplateIdInput,
} from "@/lib/validation/templates";
import { runAction } from "@/server/actions/run-action";
import {
  addTemplateStep,
  archiveTemplate,
  changeTemplateStepPhase,
  createTemplate,
  deleteTemplate,
  getTemplateDeletionImpact,
  moveTemplateStep,
  removeTemplateStep,
  restoreTemplate,
  updateTemplate,
  type TemplateDeletionImpact,
} from "@/server/services/templates";

const FIELDS = ["name", "description", "departmentId", "teamId", "jobRoleId"] as const;

function readForm(formData: FormData): {
  values: Record<string, string>;
  input: CreateTemplateInput;
} {
  const values: Record<string, string> = {};
  for (const field of FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === "string" ? raw : "";
  }
  const optional = (value: string | undefined) =>
    value === undefined || value === "" || value === NONE_VALUE ? null : value;
  return {
    values,
    input: {
      name: values.name ?? "",
      description: values.description,
      // A missing department stays undefined so the service answers VALIDATION (K§5).
      departmentId: (values.departmentId || undefined) as CreateTemplateInput["departmentId"],
      teamId: optional(values.teamId),
      jobRoleId: optional(values.jobRoleId),
    },
  };
}

/** Lists, the detail pages and the plan assignment dialogs all read template data. */
function revalidateTemplates() {
  revalidatePath(ROUTES.adminTemplates, "layout");
  revalidatePath(ROUTES.templates, "layout");
}

export async function createTemplateAction(
  _previous: TemplateFormState | null,
  formData: FormData,
): Promise<TemplateFormState> {
  const { values, input } = readForm(formData);
  // Shared by the admin and the lead form: the service enforces what each role may create.
  const result = await runAction(async (actor) => {
    const created = await createTemplate(actor, input);
    return { id: created.id, area: areaOf(actor.role) };
  });
  if (result.ok) {
    revalidateTemplates();
    redirect(areaRoutes(result.data.area).template(result.data.id));
  }
  return { result: result.ok ? { ok: true, data: undefined } : result, values };
}

export async function updateTemplateAction(
  id: string,
  _previous: TemplateFormState | null,
  formData: FormData,
): Promise<TemplateFormState> {
  const { values, input } = readForm(formData);
  const result = await runAction(async (actor) => {
    await updateTemplate(actor, { id, ...input });
    revalidateTemplates();
  });
  return { result, values };
}

export async function archiveTemplateAction(input: TemplateIdInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await archiveTemplate(actor, input);
    revalidateTemplates();
  });
}

export async function restoreTemplateAction(input: TemplateIdInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await restoreTemplate(actor, input);
    revalidateTemplates();
  });
}

export async function getTemplateDeletionImpactAction(
  input: TemplateIdInput,
): Promise<ActionResult<TemplateDeletionImpact>> {
  return runAction((actor) => getTemplateDeletionImpact(actor, input));
}

export async function deleteTemplateAction(
  input: DeleteTemplateInput,
): Promise<ActionResult<{ result: "deleted" | "archived" }>> {
  return runAction(async (actor) => {
    const outcome = await deleteTemplate(actor, input);
    revalidateTemplates();
    return outcome;
  });
}

export async function addTemplateStepAction(
  input: AddTemplateStepInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (actor) => {
    const step = await addTemplateStep(actor, input);
    revalidateTemplates();
    return step;
  });
}

export async function removeTemplateStepAction(input: StepIdInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await removeTemplateStep(actor, input);
    revalidateTemplates();
  });
}

export async function moveTemplateStepAction(input: MoveTemplateStepInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await moveTemplateStep(actor, input);
    revalidateTemplates();
  });
}

export async function changeTemplateStepPhaseAction(
  input: ChangeTemplateStepPhaseInput,
): Promise<ActionResult> {
  return runAction(async (actor) => {
    await changeTemplateStepPhase(actor, input);
    revalidateTemplates();
  });
}
