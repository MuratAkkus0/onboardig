"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/app";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [sent, setSent] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setRateLimited(false);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: String(form.get("email") ?? "").trim(),
        redirectTo: ROUTES.resetPassword,
      });
      // Always neutral (no account enumeration); only a rate limit is reported.
      if (error?.status === 429) setRateLimited(true);
      else setSent(true);
    } catch {
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert role="status">
          <AlertDescription>{t("forgot.sent")}</AlertDescription>
        </Alert>
        <BackToLogin />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {rateLimited ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{t("errors.rateLimited")}</AlertDescription>
        </Alert>
      ) : null}
      <FormField label={t("emailLabel")}>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="email" required />
        )}
      </FormField>
      <SubmitButton pending={pending} className="w-full">
        {t("forgot.submit")}
      </SubmitButton>
      <BackToLogin />
    </form>
  );
}

function BackToLogin() {
  const t = useTranslations("auth");
  return (
    <p className="text-center text-sm">
      <Link href={ROUTES.login} className="underline underline-offset-4">
        {t("backToLogin")}
      </Link>
    </p>
  );
}
