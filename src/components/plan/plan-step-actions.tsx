import { CheckCircle2, Circle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { requirePageActor } from "@/server/auth/guards";
import { getMyStepState } from "@/server/services/plans";
import { StepToggle } from "./step-toggle";

/**
 * Slot on the page view: "Erledigt" toggle plus the "Seit deinem Abschluss aktualisiert" badge for
 * the viewer's own step. Renders nothing when the page is not an active step of their plan.
 */
export async function PlanStepActions({ pageId }: { pageId: string }) {
  const actor = await requirePageActor();
  const state = await getMyStepState(actor, { pageId });
  if (!state) return null;
  const t = await getTranslations("plan.step");
  const tPlan = await getTranslations("plan");
  const { completedAt } = state;
  const completed = completedAt !== null;
  return (
    <section
      aria-label={t("actionsLabel")}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {completed ? (
          <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
        ) : (
          <Circle className="size-5 text-muted-foreground" aria-hidden="true" />
        )}
        {completedAt ? (
          <span>{t("doneOn", { date: completedAt })}</span>
        ) : (
          <span className="text-muted-foreground">{t("open")}</span>
        )}
        {state.updatedSinceCompletion ? (
          <Badge variant="secondary">{tPlan("updatedSinceCompletion")}</Badge>
        ) : null}
      </div>
      <StepToggle pageId={pageId} completed={completed} />
    </section>
  );
}
