"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { F2B_CONFIG, ROUTES } from "@/config/app";
import { authClient } from "@/lib/auth-client";

interface LoginFormProps {
  next: string | null;
  sessionEnded: boolean;
}

type LoginError = "invalidCredentials" | "deactivated" | "rateLimited" | "generic";

export function LoginForm({ next, sessionEnded }: LoginFormProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<LoginError | null>(null);
  const [pending, setPending] = useState(false);
  const cleared = useRef(false);

  // The session row is gone but the cookie is still in the browser: clear it once.
  useEffect(() => {
    if (!sessionEnded || cleared.current) return;
    cleared.current = true;
    void authClient.signOut();
  }, [sessionEnded]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.email({
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      if (authError) {
        if (authError.code === F2B_CONFIG.signInErrorCodes.banned) setError("deactivated");
        else if (authError.status === F2B_CONFIG.signInErrorCodes.rateLimitedStatus)
          setError("rateLimited");
        else if (authError.status === 401 || authError.status === 400)
          setError("invalidCredentials");
        else setError("generic");
        return;
      }
      router.replace(next ?? ROUTES.home);
      router.refresh();
    } catch {
      setError("generic");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {sessionEnded ? (
        <Alert>
          <AlertDescription>{t("sessionEnded")}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      ) : null}
      <FormField label={t("emailLabel")}>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="username" required />
        )}
      </FormField>
      <FormField label={t("passwordLabel")}>
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </FormField>
      <SubmitButton pending={pending} className="w-full">
        {t("login.submit")}
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href={ROUTES.forgotPassword} className="underline underline-offset-4">
          {t("login.forgot")}
        </Link>
      </p>
    </form>
  );
}
