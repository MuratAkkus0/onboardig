import { Languages, Milestone, ShieldCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { APP_CONFIG, LANDING_CONFIG, LOCALES, PHASES, ROLES } from "@/config/app";

const FACTS = [
  { key: "phases", icon: Milestone, count: PHASES.length },
  { key: "roles", icon: Users, count: ROLES.length },
  { key: "languages", icon: Languages, count: LOCALES.length },
  { key: "tracking", icon: ShieldCheck, count: LANDING_CONFIG.trackingServiceCount },
] as const;

/** Four facts, every number derived from config (the tracking count must stay a true 0). */
export function FactsStrip() {
  const t = useTranslations("landing.facts");
  return (
    <section
      aria-labelledby={LANDING_CONFIG.headingIds.facts}
      className="mx-auto mt-14 w-full max-w-6xl px-4 sm:px-6 md:mt-16 lg:px-8"
    >
      <h2 id={LANDING_CONFIG.headingIds.facts} className="sr-only">
        {t("label", { appName: APP_CONFIG.appName })}
      </h2>
      {/* Reveal the grid as a whole: the gap-px dividers are the container background, so revealing
          single cells would show grey placeholder slabs while scrolling. */}
      <dl className="grid landing-reveal grid-cols-2 gap-px overflow-clip rounded-2xl border bg-border md:grid-cols-4">
        {FACTS.map(({ key, icon: Icon, count }) => (
          <div key={key} className="flex flex-col gap-1 bg-surface-sunken p-5 md:p-6">
            <dt className="order-2 text-sm text-muted-foreground">{t(`${key}.caption`)}</dt>
            {/* The icon lives inside dd: a dl group may only contain dt/dd. */}
            <dd className="order-1 flex flex-col">
              <Icon aria-hidden className="mb-2 size-5 text-brand" />
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-landing-mono text-3xl font-semibold tracking-tight tabular-nums">
                  {count}
                </span>
                <span className="text-base font-medium">{t(`${key}.unit`, { count })}</span>
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
