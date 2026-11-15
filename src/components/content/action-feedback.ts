"use client";

import { toast } from "sonner";
import { useMessage } from "@/components/common/use-message";
import type { ActionResult } from "@/lib/action-result";

type Failure = Extract<ActionResult<never>, { ok: false }>["error"];

/** The message key to show: the unit-specific reason when the service gave one, else the code's key. */
export function failureKey(error: Failure): string {
  const reason = error.details?.reasonKey;
  return typeof reason === "string" ? reason : error.messageKey;
}

/**
 * Runs a server action, shows a toast for the outcome and returns the result so the caller can
 * react (close a dialog, navigate, read field errors).
 */
export function useActionFeedback() {
  const message = useMessage();
  return async function run<T>(
    action: () => Promise<ActionResult<T>>,
    successMessage?: string,
  ): Promise<ActionResult<T>> {
    const result = await action();
    if (!result.ok) toast.error(message(failureKey(result.error)));
    else if (successMessage) toast.success(successMessage);
    return result;
  };
}
