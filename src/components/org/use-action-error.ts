"use client";

import type { ActionResult } from "@/lib/action-result";
import { useMessage } from "@/components/common/use-message";

export type ActionError = Extract<ActionResult<unknown>, { ok: false }>["error"];

export interface DescribedError {
  /** Translated reason, falling back to the generic error text. */
  text: string;
  /** Names of the entities that block the action (users, templates, led employees). */
  items: string[];
}

const LIST_KEYS = ["users", "templates", "jobRoles", "ledEmployees"] as const;

function namesOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    typeof entry === "object" &&
    entry !== null &&
    typeof (entry as { name?: unknown }).name === "string"
      ? [(entry as { name: string }).name]
      : [],
  );
}

/** Turns a failed action into display text plus the list of blocking entities, if any. */
export function useActionErrorDescriber(): (error: ActionError) => DescribedError {
  const message = useMessage();
  return (error) => {
    const reasonKey = error.details?.reasonKey;
    return {
      text: message(typeof reasonKey === "string" ? reasonKey : error.messageKey),
      items: LIST_KEYS.flatMap((key) => namesOf(error.details?.[key])),
    };
  };
}
