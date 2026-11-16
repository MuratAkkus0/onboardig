import { CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { LANDING_CONFIG, PHASES } from "@/config/app";
import { SectionHeading } from "./section-heading";

/** The four plan phases as a timeline (vertical on mobile, horizontal from lg). */
export function PhasesSection({ index }: { index: number }) {
  const t = useTranslations();
  const format = useFormatter();
  const { sectionIds, demo } = LANDING_CONFIG;
  return (
    <section
      id={sectionIds.plan}
      aria-labelledby={LANDING_CONFIG.headingIds.phases}
      className="scroll-mt-20 border-y bg-surface-sunken py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id={LANDING_CONFIG.headingIds.phases}
          index={index}
          eyebrow={t("landing.phases.eyebrow")}
          title={t("landing.phases.title")}
          lead={t("landing.phases.lead")}
        />

        <div className="relative mt-14">
          <span
            aria-hidden
            className="absolute top-2 bottom-2 left-[5px] w-px bg-border md:hidden"
          />
          <span
            aria-hidden
            className="absolute inset-x-0 top-[5px] hidden h-px bg-border lg:block"
          />
          <span
            aria-hidden
            className="absolute inset-x-0 top-[5px] hidden h-px origin-left landing-line bg-brand lg:block"
          />
          <ol className="relative grid gap-8 md:grid-cols-2 md:gap-x-8 md:gap-y-10 lg:grid-cols-4">
            {PHASES.map((phase, position) => (
              <li key={phase} className="relative landing-reveal pl-7 md:pl-0 lg:pt-8">
                <span
                  aria-hidden
                  className="absolute top-1.5 left-0 block size-3 rounded-full border-2 border-brand bg-background md:static md:mb-3 lg:absolute lg:top-0 lg:left-0 lg:mb-0"
                />
                <span className="font-landing-mono text-xs text-muted-foreground tabular-nums">
                  {format.number(position + 1, { minimumIntegerDigits: 2 })}
                </span>
                <h3 className="mt-1 text-lg/7 font-semibold tracking-[-0.01em]">
                  {t(`enums.phase.${phase}`)}
                </h3>
                <p className="mt-2 text-sm/6 text-pretty text-muted-foreground">
                  {t(`landing.phases.items.${phase}`)}
                </p>
                <ul aria-hidden className="mt-4 flex flex-wrap gap-2">
                  {demo.phaseChips[phase].map((chip) => (
                    <li
                      key={chip.key}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      {chip.done ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                      ) : (
                        <Circle className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      {t(`landing.mock.steps.${chip.key}`)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-12 flex max-w-2xl items-start gap-2.5 text-sm/6 text-muted-foreground md:mt-14">
          <RefreshCw aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
          <span className="text-pretty">{t("landing.phases.caption")}</span>
        </p>
      </div>
    </section>
  );
}
