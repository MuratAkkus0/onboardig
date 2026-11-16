import { useTranslations } from "next-intl";
import { LANDING_CONFIG } from "@/config/app";
import { MockNotification } from "./mock-notification";
import { MockPlanCard } from "./mock-plan-card";
import { MockTeamTable } from "./mock-team-table";
import { DEMO_PROGRESS } from "./demo";
import { motionStyle } from "./motion";

/**
 * The hero "stage": plan card, team table and a notification, built from the app's own components
 * and strings. One labelled image for assistive tech; everything inside is hidden and inert.
 */
export function ProductStage() {
  const t = useTranslations("landing");
  const { staggerMs, stageDurationMs } = LANDING_CONFIG.motion;
  return (
    <div
      className="relative mx-auto mt-14 max-w-5xl landing-enter md:mt-20"
      style={motionStyle(4 * staggerMs, stageDurationMs)}
    >
      <figure
        role="img"
        aria-label={t("a11y.stageLabel", {
          completed: DEMO_PROGRESS.after,
          total: DEMO_PROGRESS.total,
          people: LANDING_CONFIG.demo.team.length,
        })}
        className="relative"
      >
        {/* The team window only appears from lg, where it has room to the right of the plan card;
            its body starts past the covered part, so no column is cut off behind the plan card. */}
        <div aria-hidden inert className="relative grid grid-cols-1 md:grid-cols-12 lg:mask-fade-b">
          <div className="relative z-20 md:col-start-2 md:col-end-12 md:row-start-1 lg:col-start-1 lg:col-end-8">
            <MockPlanCard />
          </div>
          <div className="relative z-10 hidden lg:col-start-6 lg:col-end-13 lg:row-start-1 lg:mt-24 lg:block">
            <MockTeamTable />
          </div>
        </div>
        <div
          aria-hidden
          inert
          className="absolute right-2 -bottom-12 z-30 w-[85%] max-w-xs md:right-10 lg:top-4 lg:-right-6 lg:bottom-auto"
        >
          <MockNotification />
        </div>
      </figure>
      <p className="mt-20 text-center font-landing-mono text-xs text-muted-foreground lg:mt-8">
        {t("hero.stageCaption")}
      </p>
    </div>
  );
}
