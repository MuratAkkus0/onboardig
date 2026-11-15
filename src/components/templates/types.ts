import type { ActionResult } from "@/lib/action-result";

/** Form fields: "none" is the select value for "no team / no role", "all" for company-wide. */
export const NONE_VALUE = "none";

/** State of the template form: last result plus the submitted values so inputs survive an error. */
export interface TemplateFormState {
  result: ActionResult;
  values: Record<string, string>;
}
