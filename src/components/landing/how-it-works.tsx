import { LineChart, ListChecks, UserPlus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { APP_CONFIG, LANDING_CONFIG } from "@/config/app";
import { SectionHeading } from "./section-heading";

const STEPS = [
  { key: "account", icon: UserPlus },
  { key: "plan", icon: ListChecks },
  { key: "start", icon: LineChart },
] as const;

/** Three steps from account to finished onboarding. */
export function HowItWorks({ index }: { index: number }) {
  const t = useTranslations("landing.howItWorks");
  const format = useFormatter();
  return (
    <section
      id={LANDING_CONFIG.sectionIds.howItWorks}
      aria-labelledby={LANDING_CONFIG.headingIds.howItWorks}
      className="scroll-mt-20 border-t py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id={LANDING_CONFIG.headingIds.howItWorks}
          index={index}
          eyebrow={t("eyebrow")}
          title={t("title")}
          align="center"
        />
        <div className="relative mt-14">
          <span
            aria-hidden
            className="absolute top-6 right-[16.67%] left-[16.67%] hidden border-t border-dashed border-border md:block"
          />
          <span
            aria-hidden
            className="absolute top-12 bottom-0 left-6 border-l border-dashed border-border md:hidden"
          />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map(({ key, icon: Icon }, position) => (
              <li
                key={key}
                className="relative flex landing-reveal gap-4 md:flex-col md:items-center md:text-center"
              >
                <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-foreground ring-8 ring-background">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                  <span className="font-landing-mono text-xs text-muted-foreground tabular-nums">
                    {format.number(position + 1, { minimumIntegerDigits: 2 })}
                  </span>
                  <h3 className="mt-1 text-lg/7 font-semibold tracking-[-0.01em]">
                    {t(`steps.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm/6 text-pretty text-muted-foreground md:mx-auto md:max-w-[30ch]">
                    {t(`steps.${key}.body`, { hours: APP_CONFIG.auth.inviteTokenTtlHours })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
