import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import { LANDING_CONFIG, ROUTES } from "@/config/app";

/** Closing panel: sign in, or reset a forgotten password. No sign-up (accounts come from admins). */
export function FinalCta() {
  const t = useTranslations();
  return (
    <section aria-labelledby={LANDING_CONFIG.headingIds.cta} className="py-20 md:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative isolate overflow-clip rounded-3xl border bg-card px-6 py-16 text-center text-card-foreground shadow-raised md:py-24">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-aurora" />
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid" />
          <span className="mx-auto inline-block landing-reveal rounded-2xl shadow-float dark:ring-1 dark:ring-border">
            <AppLogo className="block size-14" />
          </span>
          <h2
            id={LANDING_CONFIG.headingIds.cta}
            className="mt-8 text-section font-semibold text-balance"
          >
            {t("landing.cta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
            {t("landing.cta.body")}
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" variant="brand" className="group w-full sm:w-auto">
              <Link href={ROUTES.login}>
                {t("landing.cta.primary")}
                <ArrowRight
                  aria-hidden
                  className="transition-transform motion-safe:group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            <Button asChild size="lg" variant="link">
              <Link href={ROUTES.forgotPassword}>{t("auth.login.forgot")}</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{t("landing.cta.noAccount")}</p>
        </div>
      </div>
    </section>
  );
}
