"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { useMessage } from "@/components/common/use-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { APP_CONFIG, ROUTES } from "@/config/app";
import { authClient } from "@/lib/auth-client";
import { setPasswordAction, type SetPasswordResult } from "./actions";

export function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const message = useMessage();
  const router = useRouter();
  const submittedPassword = useRef("");
  const [state, formAction] = useActionState<SetPasswordResult, FormData>(setPasswordAction, null);

  // Success: sign in with the password just set; fall back to the login page if that fails.
  useEffect(() => {
    if (!state?.ok) return;
    const password = submittedPassword.current;
    void (async () => {
      const { error } = await authClient.signIn.email({ email: state.data.email, password });
      router.replace(error ? ROUTES.login : ROUTES.home);
      router.refresh();
    })();
  }, [state, router]);

  const failure = state && !state.ok ? state.error : null;
  const fieldError = (name: string): string | undefined => {
    const key = failure?.fieldErrors?.[name]?.[0];
    return key
      ? message(key, {
          min: APP_CONFIG.auth.passwordMinLength,
          max: APP_CONFIG.auth.passwordMaxLength,
        })
      : undefined;
  };
  const reasonKey = failure?.details?.reasonKey;
  const formError =
    failure && !failure.fieldErrors
      ? message(typeof reasonKey === "string" ? reasonKey : failure.messageKey)
      : undefined;

  return (
    <form
      action={(formData) => {
        // React resets the form after the action, so keep the password for the follow-up sign-in.
        submittedPassword.current = String(formData.get("password") ?? "");
        formAction(formData);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="token" value={token} />
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <FormField
        label={t("passwordLabel")}
        description={t("passwordHint", { min: APP_CONFIG.auth.passwordMinLength })}
        error={fieldError("password")}
      >
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={APP_CONFIG.auth.passwordMinLength}
            maxLength={APP_CONFIG.auth.passwordMaxLength}
            required
          />
        )}
      </FormField>
      <FormField label={t("confirmPasswordLabel")} error={fieldError("confirmPassword")}>
        {(control) => (
          <Input
            {...control}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </FormField>
      <SubmitButton className="w-full">{t("setPassword.submit")}</SubmitButton>
    </form>
  );
}
