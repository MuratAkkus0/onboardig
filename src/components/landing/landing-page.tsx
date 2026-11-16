import { useTranslations } from "next-intl";
import { LANDING_CONFIG } from "@/config/app";
import { FinalCta } from "./final-cta";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { PhasesSection } from "./phases-section";
import { PrivacySection } from "./privacy-section";
import { RolesSection } from "./roles-section";

/** Numbered sections, in page order; the eyebrow index ("01") is derived from the position. */
const SECTIONS = [PhasesSection, RolesSection, HowItWorks, PrivacySection] as const;

/**
 * Public landing page. Presentation only: no services, no data, no tracking, no observers; all
 * motion is CSS. The only client pieces are the shared locale and theme switchers.
 */
export function LandingPage() {
  const t = useTranslations("landing.a11y");
  const { main } = LANDING_CONFIG.sectionIds;
  return (
    <div
      data-landing
      className="relative isolate min-h-screen overflow-x-clip bg-background text-foreground"
    >
      <a
        href={`#${main}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-brand"
      >
        {t("skipLink")}
      </a>
      <LandingHeader />
      <main id={main} tabIndex={-1} className="outline-none">
        <Hero />
        {SECTIONS.map((Section, position) => (
          <Section key={position} index={position + 1} />
        ))}
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
