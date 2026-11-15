import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { F2B_CONFIG, ROUTES } from "@/config/app";
import { verifyInvitationToken } from "@/server/services/invitations";
import { SetPasswordForm } from "./set-password-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams)[F2B_CONFIG.queryParams.token];
  const token = Array.isArray(raw) ? raw[0] : raw;
  const t = await getTranslations("auth");
  const check = token ? await verifyInvitationToken(token) : null;

  if (!token || !check || !check.valid) {
    const reason = check && !check.valid ? check.reason : "invalid";
    const toLogin = reason === "used";
    return (
      <AuthCard title={t(`setPassword.${reason}Title`)} description={t(`setPassword.${reason}`)}>
        {toLogin ? (
          <Button asChild className="w-full">
            <Link href={ROUTES.login}>{t("backToLogin")}</Link>
          </Button>
        ) : null}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("setPassword.title")}
      description={t("setPassword.greeting", { firstName: check.firstName, email: check.email })}
    >
      <SetPasswordForm token={token} />
    </AuthCard>
  );
}
