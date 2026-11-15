"use server";

import type { ActionResult } from "@/lib/action-result";
import { passwordSchema } from "@/lib/validation/common";
import { runPublicAction } from "@/server/actions/run-action";
import { AppError } from "@/server/errors";
import { acceptInvitation } from "@/server/services/invitations";

export type SetPasswordResult = ActionResult<{ email: string }> | null;

/** Public: accepts an invitation by setting the first password (see invitations service). */
export async function setPasswordAction(
  _previous: SetPasswordResult,
  formData: FormData,
): Promise<SetPasswordResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  return runPublicAction(async () => {
    if (password !== confirm) {
      throw new AppError("VALIDATION", {
        fieldErrors: { confirmPassword: ["auth.passwordMismatch"] },
      });
    }
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      throw new AppError("VALIDATION", {
        fieldErrors: { password: parsed.error.issues.map((issue) => issue.message) },
      });
    }
    return acceptInvitation({ token, password });
  });
}
