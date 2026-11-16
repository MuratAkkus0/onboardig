import Link from "next/link";
import { ArrowDown, ArrowRight, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LANDING_CONFIG, ROUTES } from "@/config/app";
import { FactsStrip } from "./facts-strip";
import { motionStyle } from "./motion";
import { ProductStage } from "./product-stage";

/** Headline, calls to action, the product stage and the facts strip. */
export function Hero() {
  const t = useTranslations("landing");
  const { staggerMs, underlineDelayMs, underlineMs } = LANDING_CONFIG.motion;
  const { sectionIds } = LANDING_CONFIG;
  return (
    <section
      aria-labelledby={LANDING_CONFIG.headingIds.hero}
      className="relative isolate overflow-clip pt-14 pb-16 md:pt-24 md:pb-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] bg-aurora"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid" />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="inline-flex landing-enter items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 font-landing-mono text-xs tracking-[0.08em] text-brand-soft-foreground uppercase"
            style={motionStyle(0)}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
            {t("hero.eyebrow")}
          </p>

          <h1
            id={LANDING_CONFIG.headingIds.hero}
            className="mt-6 landing-enter text-display font-semibold text-balance"
            style={motionStyle(staggerMs)}
          >
            <span className="block headline-fade">{t("hero.titleLine1")}</span>{" "}
            <span className="relative inline-block text-brand">
              {t("hero.titleLine2")}
              <svg
                aria-hidden
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                className="absolute -bottom-2 left-0 h-3 w-full"
              >
                <path
                  d="M2 9 C 50 3, 150 3, 198 8"
                  pathLength={1}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  className="landing-anim-draw"
                  style={{ strokeDasharray: 1, ...motionStyle(underlineDelayMs, underlineMs) }}
                />
              </svg>
            </span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-[40rem] landing-enter text-lg leading-relaxed text-pretty text-muted-foreground md:text-xl"
            style={motionStyle(2 * staggerMs)}
          >
            {t("hero.lead")}
          </p>

          <div
            className="mt-10 flex landing-enter flex-col gap-3 sm:flex-row sm:justify-center"
            style={motionStyle(3 * staggerMs)}
          >
            <Button asChild size="lg" variant="brand" className="group w-full sm:w-auto">
              <Link href={ROUTES.login}>
                {t("hero.primaryCta")}
                <ArrowRight
                  aria-hidden
                  className="transition-transform motion-safe:group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
              <a href={`#${sectionIds.howItWorks}`}>
                {t("hero.secondaryCta")}
                <ArrowDown aria-hidden />
              </a>
            </Button>
          </div>

          <p className="mx-auto mt-5 max-w-sm text-center text-sm text-balance text-muted-foreground sm:max-w-none">
            <KeyRound aria-hidden className="mr-1.5 inline-block size-4 align-[-3px]" />
            {t("hero.accessNote")}
          </p>
        </div>

        <ProductStage />
      </div>

      <FactsStrip />
    </section>
  );
}
