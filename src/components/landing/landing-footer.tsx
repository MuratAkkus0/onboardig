import Link from "next/link";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { APP_CONFIG, ROUTES } from "@/config/app";
import { BrandMark } from "./brand-mark";

const LINK =
  "rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-brand";

export function LandingFooter() {
  const t = useTranslations();
  return (
    <footer className="border-t py-10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BrandMark compactBelow400={false} />
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              {t("landing.footer.tagline")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <nav aria-label={t("landing.a11y.footerNav")}>
              <ul className="flex flex-wrap gap-6 text-sm">
                <li>
                  <Link href={ROUTES.login} className={LINK}>
                    {t("landing.footer.signIn")}
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.forgotPassword} className={LINK}>
                    {t("auth.login.forgot")}
                  </Link>
                </li>
                {/* Impressum and Datenschutzerklärung links go here once the operator provides them. */}
              </ul>
            </nav>
            <LocaleSwitcher variant="select" compact />
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            {t("landing.footer.copyright", {
              year: new Date().getFullYear(),
              appName: APP_CONFIG.appName,
            })}
          </p>
          <p>{t("landing.footer.fictional")}</p>
        </div>
      </div>
    </footer>
  );
}
