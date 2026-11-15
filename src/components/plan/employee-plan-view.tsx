import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/config/app";
import { cn } from "@/lib/utils";
import type { EmployeePlanDto, EmployeeStepDto } from "@/server/services/plans";
import { PhaseTitle } from "./phase-title";
import { RemoveStepButton } from "./remove-step-button";

interface StepItemProps {
  userId: string;
  step: EmployeeStepDto;
  canManage: boolean;
  /** Admins may open any page (draft preview); leads only published ones. */
  canOpen: boolean;
  showPhase: boolean;
}

function StepItem({ userId, step, canManage, canOpen, showPhase }: StepItemProps) {
  const t = useTranslations("plan");
  const common = useTranslations("common");
  const { completedAt } = step;
  const heading = step.title ?? t("member.hiddenTitle");
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-start gap-3">
        {completedAt && step.isActive ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="min-w-0 space-y-1">
          {step.title !== null && canOpen ? (
            <Link
              href={ROUTES.page(step.pageId)}
              className={cn(
                "font-medium break-words hover:underline",
                !step.isActive && "text-muted-foreground",
              )}
            >
              {heading}
            </Link>
          ) : (
            <span className="font-medium break-words text-muted-foreground">{heading}</span>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {showPhase ? (
              <Badge variant="outline">
                <PhaseTitle phase={step.phase} />
              </Badge>
            ) : null}
            {step.isActive ? (
              completedAt ? (
                <span>{t("step.doneOn", { date: completedAt })}</span>
              ) : (
                <span>{t("step.open")}</span>
              )
            ) : (
              <>
                <StatusBadge kind="pageStatus" value={step.pageStatus} />
                <span>{t("member.notPublished")}</span>
              </>
            )}
            {step.isFallback ? <Badge variant="outline">{common("germanOnly")}</Badge> : null}
            {step.updatedSinceCompletion ? (
              <Badge variant="secondary">{t("updatedSinceCompletion")}</Badge>
            ) : null}
          </div>
        </div>
      </div>
      {canManage ? (
        <RemoveStepButton userId={userId} pageId={step.pageId} title={step.title} />
      ) : null}
    </li>
  );
}

interface EmployeePlanViewProps {
  plan: EmployeePlanDto;
  viewerIsAdmin: boolean;
}

/** Lead/admin view of an employee's plan, per module (done/open) or per phase. */
export function EmployeePlanView({ plan, viewerIsAdmin }: EmployeePlanViewProps) {
  const t = useTranslations("plan.member");
  const userId = plan.user.id;
  const canOpen = (step: EmployeeStepDto) => step.isActive || viewerIsAdmin;
  return (
    <Tabs defaultValue="modules">
      <TabsList>
        <TabsTrigger value="modules">{t("viewByModule")}</TabsTrigger>
        <TabsTrigger value="phases">{t("viewByPhase")}</TabsTrigger>
      </TabsList>
      <TabsContent value="modules" className="space-y-6">
        {plan.modules.map((module) => (
          <section
            key={module.moduleId}
            aria-labelledby={`module-${module.moduleId}`}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`module-${module.moduleId}`} className="text-lg font-semibold">
                {module.title}
              </h2>
              <span className="text-sm text-muted-foreground">
                {module.total === 0
                  ? t("moduleNoActive")
                  : t("moduleCount", { completed: module.completed, total: module.total })}
              </span>
            </div>
            <ul className="divide-y rounded-lg border">
              {module.steps.map((step) => (
                <StepItem
                  key={step.pageId}
                  userId={userId}
                  step={step}
                  canManage={plan.canManage}
                  canOpen={canOpen(step)}
                  showPhase
                />
              ))}
            </ul>
          </section>
        ))}
      </TabsContent>
      <TabsContent value="phases" className="space-y-6">
        {plan.phases.map(({ phase, steps }) => (
          <section key={phase} aria-labelledby={`member-phase-${phase}`} className="space-y-3">
            <h2 id={`member-phase-${phase}`} className="text-lg font-semibold">
              <PhaseTitle phase={phase} />
            </h2>
            <ul className="divide-y rounded-lg border">
              {steps.map((step) => (
                <StepItem
                  key={step.pageId}
                  userId={userId}
                  step={step}
                  canManage={plan.canManage}
                  canOpen={canOpen(step)}
                  showPhase={false}
                />
              ))}
            </ul>
          </section>
        ))}
      </TabsContent>
    </Tabs>
  );
}
