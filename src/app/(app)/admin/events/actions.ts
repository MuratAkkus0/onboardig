"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import { parseBerlinLocal } from "@/lib/datetime";
import { runAction } from "@/server/actions/run-action";
import { AppError } from "@/server/errors";
import { announceEvent, createEvent, deleteEvent, updateEvent } from "@/server/services/events";
import type { EventInput } from "@/lib/validation/events";
import type { EventFormState } from "@/components/events/types";

const FIELDS = [
  "titleDe",
  "descriptionDe",
  "titleEn",
  "descriptionEn",
  "startsAt",
  "endsAt",
  "location",
] as const;

function readForm(formData: FormData) {
  const values: Record<string, string> = {};
  for (const field of FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === "string" ? raw : "";
  }
  const startsAt = parseBerlinLocal(values.startsAt ?? "");
  const endsAt = parseBerlinLocal(values.endsAt ?? "");
  const fieldErrors: Record<string, string[]> = {};
  if (!startsAt) fieldErrors.startsAt = ["events.errors.invalidDateTime"];
  if (!endsAt) fieldErrors.endsAt = ["events.errors.invalidDateTime"];
  return { values, startsAt, endsAt, fieldErrors };
}

function toInput(
  form: { values: Record<string, string> },
  startsAt: Date,
  endsAt: Date,
): EventInput {
  const { values } = form;
  return {
    titleDe: values.titleDe ?? "",
    descriptionDe: values.descriptionDe ?? "",
    titleEn: values.titleEn,
    descriptionEn: values.descriptionEn,
    location: values.location,
    startsAt,
    endsAt,
  };
}

function revalidateEvents() {
  revalidatePath(ROUTES.events);
  revalidatePath(ROUTES.adminEvents);
}

export async function createEventAction(
  _previous: EventFormState | null,
  formData: FormData,
): Promise<EventFormState> {
  const form = readForm(formData);
  const result = await runAction(async (actor) => {
    if (!form.startsAt || !form.endsAt) {
      throw new AppError("VALIDATION", { fieldErrors: form.fieldErrors });
    }
    await createEvent(actor, toInput(form, form.startsAt, form.endsAt));
  });
  if (result.ok) {
    revalidateEvents();
    redirect(ROUTES.adminEvents);
  }
  return { result, values: form.values };
}

export async function updateEventAction(
  id: string,
  _previous: EventFormState | null,
  formData: FormData,
): Promise<EventFormState> {
  const form = readForm(formData);
  const result = await runAction(async (actor) => {
    if (!form.startsAt || !form.endsAt) {
      throw new AppError("VALIDATION", { fieldErrors: form.fieldErrors });
    }
    await updateEvent(actor, { ...toInput(form, form.startsAt, form.endsAt), id });
  });
  if (result.ok) revalidateEvents();
  return { result, values: form.values };
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  const result = await runAction((actor) => deleteEvent(actor, { id }));
  if (result.ok) revalidateEvents();
  return result;
}

export async function announceEventAction(
  id: string,
): Promise<ActionResult<{ recipients: number }>> {
  const result = await runAction((actor) => announceEvent(actor, { id }));
  if (result.ok) revalidatePath(ROUTES.adminEvents);
  return result;
}
