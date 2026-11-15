import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageActor } from "@/server/auth/guards";

export default async function ProfilePage() {
  const actor = await requirePageActor();
  const t = await getTranslations();
  const account = [
    { label: t("profile.account.name"), value: `${actor.firstName} ${actor.lastName}`.trim() },
    { label: t("profile.account.email"), value: actor.email },
    { label: t("profile.account.role"), value: t(`enums.role.${actor.role}`) },
  ];
  return (
    <>
      <PageHeader title={t("profile.title")} />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.account.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              {account.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="text-sm font-medium break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.preferences.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-8 sm:grid-cols-2">
            <section className="space-y-3">
              <CardDescription>
                <span className="block font-medium text-foreground">
                  {t("profile.preferences.language")}
                </span>
                {t("profile.preferences.languageDescription")}
              </CardDescription>
              <LocaleSwitcher variant="field" />
            </section>
            <section className="space-y-3">
              <CardDescription>
                <span className="block font-medium text-foreground">
                  {t("profile.preferences.theme")}
                </span>
                {t("profile.preferences.themeDescription")}
              </CardDescription>
              <ThemeSwitcher variant="field" />
            </section>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
