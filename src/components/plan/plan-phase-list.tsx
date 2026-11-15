import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/config/app";
import type { PlanDto, StepDto } from "@/server/services/plans";
import { PhaseTitle } from "./phase-title";
import { StepToggle } from "./step-toggle";

function StepRow({ step }: { step: StepDto }) {
  const t = useTranslations("plan");
  const common = useTranslations("common");
  const { completedAt } = step;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-start gap-3">
        {completedAt ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="min-w-0 space-y-1">
          <Link href={ROUTES.page(step.pageId)} className="font-medium break-words hover:underline">
            {step.title}
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {completedAt ? (
              <span>{t("step.doneOn", { date: completedAt })}</span>
            ) : (
              <span>{t("step.open")}</span>
            )}
            {step.isFallback ? <Badge variant="outline">{common("germanOnly")}</Badge> : null}
            {step.updatedSinceCompletion ? (
              <Badge variant="secondary">{t("updatedSinceCompletion")}</Badge>
            ) : null}
          </div>
        </div>
      </div>
      <StepToggle pageId={step.pageId} completed={completedAt !== null} />
    </li>
  );
}

/** The employee's own plan: steps grouped by phase, each with the "Erledigt" toggle. */
export function PlanPhaseList({ phases }: { phases: PlanDto["phases"] }) {
  return (
    <div className="space-y-8">
      {phases.map(({ phase, steps }) => (
        <section key={phase} aria-labelledby={`phase-${phase}`} className="space-y-3">
          <h2 id={`phase-${phase}`} className="text-lg font-semibold">
            <PhaseTitle phase={phase} />
          </h2>
          <ul className="divide-y rounded-lg border">
            {steps.map((step) => (
              <StepRow key={step.pageId} step={step} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
