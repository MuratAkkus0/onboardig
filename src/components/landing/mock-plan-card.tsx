import { useFormatter, useTranslations } from "next-intl";
import { APP_CONFIG, LANDING_CONFIG } from "@/config/app";
import { DEMO_PLAN_PHASES, DEMO_PROGRESS, demoDate } from "./demo";
import { MockWindow } from "./mock-window";
import { cssVars, motionStyle } from "./motion";
import { ProgressRing } from "./progress-ring";
import { StepRow } from "./step-row";

/** "Mein Onboarding-Plan" as the app shows it; one step checks itself off after load. */
export function MockPlanCard() {
  const t = useTranslations();
  const format = useFormatter();
  const { demo, motion } = LANDING_CONFIG;
  const { total, before, after, fractionBefore, fractionAfter } = DEMO_PROGRESS;
  const percent = (fraction: number) => format.number(fraction, { style: "percent" });
  const fade = motionStyle(motion.checkDelayMs, motion.checkMs);

  return (
    <MockWindow
      path={t("landing.mock.windowPathPlan", { appSlug: APP_CONFIG.appName.toLowerCase() })}
      surface="solid"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight">{t("plan.title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("landing.mock.planMeta", {
              name: t(`landing.mock.people.${demo.person}`),
              department: t("landing.mock.department"),
              team: t("landing.mock.team"),
            })}
          </p>
        </div>
        <ProgressRing
          from={fractionBefore}
          to={fractionAfter}
          labelFrom={percent(fractionBefore)}
          labelTo={percent(fractionAfter)}
          delayMs={motion.checkDelayMs}
          durationMs={motion.ringMs}
          fadeMs={motion.checkMs}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid shrink-0 text-xs text-muted-foreground tabular-nums">
          <span className="landing-anim-fade-out opacity-0 [grid-area:1/1]" style={fade}>
            {t("plan.progress.summary", { completed: before, total })}
          </span>
          <span className="landing-anim-fade-in [grid-area:1/1]" style={fade}>
            {t("plan.progress.summary", { completed: after, total })}
          </span>
        </span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ring-track">
          <span
            className="block h-full w-full origin-left landing-anim-bar rounded-full bg-brand"
            style={{
              transform: "scaleX(var(--bar-to))",
              ...cssVars({ "--bar-from": fractionBefore, "--bar-to": fractionAfter }),
              ...motionStyle(motion.checkDelayMs, motion.ringMs),
            }}
          />
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {DEMO_PLAN_PHASES.map((phase) => (
          <div key={phase}>
            <p className="mb-2 font-landing-mono text-[0.6875rem] tracking-[0.08em] text-muted-foreground uppercase">
              {t(`enums.phase.${phase}`)}
            </p>
            <ul className="divide-y rounded-lg border bg-background/60">
              {demo.planSteps
                .filter((step) => step.phase === phase)
                .map((step) => (
                  <StepRow
                    key={step.key}
                    title={t(`landing.mock.steps.${step.key}`)}
                    state={step.state}
                    doneOn={"doneOn" in step ? demoDate(step.doneOn) : undefined}
                    updated={"updated" in step && step.updated}
                  />
                ))}
            </ul>
          </div>
        ))}
      </div>
    </MockWindow>
  );
}
