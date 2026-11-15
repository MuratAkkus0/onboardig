import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { F2B_CONFIG, ROUTES } from "@/config/app";
import { safeNextPath } from "@/lib/navigation";
import { getActor } from "@/server/auth/actor";
import { LoginForm } from "./login-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(first(params[F2B_CONFIG.queryParams.next]));
  // Only a REAL session redirects away (never the cookie alone), so a stale cookie cannot loop.
  const actor = await getActor();
  if (actor) redirect(next ?? ROUTES.home);

  const t = await getTranslations("auth.login");
  const sessionEnded =
    first(params[F2B_CONFIG.queryParams.reason]) === F2B_CONFIG.sessionEndedReason;
  return (
    <AuthCard title={t("title")} description={t("description")}>
      <LoginForm next={next} sessionEnded={sessionEnded} />
    </AuthCard>
  );
}
