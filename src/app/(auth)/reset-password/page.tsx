import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { F2B_CONFIG, ROUTES } from "@/config/app";
import { ResetPasswordForm } from "./reset-password-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = first(params[F2B_CONFIG.queryParams.token]);
  const t = await getTranslations("auth.reset");
  // Better Auth's callback redirects here with ?error=INVALID_TOKEN for unusable tokens.
  if (!token || first(params[F2B_CONFIG.queryParams.error])) {
    return (
      <AuthCard title={t("invalidTitle")} description={t("invalid")}>
        <Button asChild className="w-full">
          <Link href={ROUTES.forgotPassword}>{t("requestNew")}</Link>
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("title")} description={t("description")}>
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
