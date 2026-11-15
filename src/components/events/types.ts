import type { ActionResult } from "@/lib/action-result";

/** State of the event form: last result plus the submitted values so inputs survive an error. */
export interface EventFormState {
  result: ActionResult;
  values: Record<string, string>;
}
