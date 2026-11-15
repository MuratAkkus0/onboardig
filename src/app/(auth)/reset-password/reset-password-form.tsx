"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_CONFIG, ROUTES } from "@/config/app";
import { authClient } from "@/lib/auth-client";

type ResetError = "invalidToken" | "rateLimited" | "generic";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [error, setError] = useState<ResetError | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    setError(null);
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setPending(true);
    try {
      const { error: authError } = await authClient.resetPassword({ newPassword: password, token });
      if (!authError) setDone(true);
      else if (authError.status === 429) setError("rateLimited");
      else if (authError.status === 400) setError("invalidToken");
      else setError("generic");
    } catch {
      setError("generic");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert role="status">
          <AlertDescription>{t("reset.done")}</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href={ROUTES.login}>{t("backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      ) : null}
      <FormField
        label={t("passwordLabel")}
        description={t("passwordHint", { min: APP_CONFIG.auth.passwordMinLength })}
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
      <FormField
        label={t("confirmPasswordLabel")}
        error={mismatch ? t("passwordMismatch") : undefined}
      >
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
      <SubmitButton pending={pending} className="w-full">
        {t("reset.submit")}
      </SubmitButton>
    </form>
  );
}
