import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { PlanPhaseList } from "@/components/plan/plan-phase-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requirePageActor } from "@/server/auth/guards";
import { getMyPlan } from "@/server/services/plans";

export default async function PlanPage() {
  const actor = await requirePageActor();
  const t = await getTranslations("plan");
  const plan = await getMyPlan(actor);

  if (plan.phases.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState title={t("empty")} description={t("emptyDescription")} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("progress.summary", {
          completed: plan.progress.completed,
          total: plan.progress.total,
        })}
        actions={<StatusBadge kind="onboardingStatus" value={plan.status} />}
      />
      <div className="space-y-8">
        <ProgressBar value={plan.progress.percent} />
        {plan.status === "completed" ? (
          <Alert>
            <AlertDescription>{t("progress.completedNotice")}</AlertDescription>
          </Alert>
        ) : null}
        <PlanPhaseList phases={plan.phases} />
      </div>
    </>
  );
}
