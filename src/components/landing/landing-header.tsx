import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { Button } from "@/components/ui/button";
import { APP_CONFIG, LANDING_CONFIG, ROUTES } from "@/config/app";
import { BrandMark } from "./brand-mark";

const NAV = [
  { id: LANDING_CONFIG.sectionIds.roles, key: "roles" },
  { id: LANDING_CONFIG.sectionIds.howItWorks, key: "howItWorks" },
  { id: LANDING_CONFIG.sectionIds.privacy, key: "privacy" },
] as const;

/** Sticky header; its bottom rule fades in over the first 64px of scroll (CSS only). */
export function LandingHeader() {
  const t = useTranslations("landing");
  return (
    <header className="sticky top-0 z-50 h-16 landing-header-rule border-b border-border bg-background/75 backdrop-blur-lg">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={ROUTES.home}
          aria-label={t("a11y.homeLink", { appName: APP_CONFIG.appName })}
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-brand"
        >
          <BrandMark />
        </Link>

        <nav aria-label={t("a11y.sectionNav")} className="hidden md:flex md:items-center md:gap-1">
          {NAV.map(({ id, key }) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-brand"
            >
              {t(`header.nav.${key}`)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LocaleSwitcher variant="select" compact />
          <ThemeSwitcher variant="icon" persist={false} />
          <Button asChild size="sm" variant="brand">
            <Link href={ROUTES.login}>
              {t("header.signIn")}
              <ArrowRight aria-hidden className="hidden sm:block" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
