import { ZodError } from "zod";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { AddStepDialog } from "@/components/plan/add-step-dialog";
import { AssignTemplatesDialog } from "@/components/plan/assign-templates-dialog";
import { EmployeePlanView } from "@/components/plan/employee-plan-view";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requirePageRole } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getPlanForUser, listAddablePages, listAssignableTemplates } from "@/server/services/plans";

export default async function TeamMemberPage({ params }: PageProps<"/team/[userId]">) {
  const { userId } = await params;
  const actor = await requirePageRole(["team_lead", "admin"]);
  const t = await getTranslations("plan");
  const format = await getFormatter();
  const plan = await getPlanForUser(actor, { userId }).catch((e: unknown) => {
    // A malformed id fails validation: to the visitor it is simply a person that does not exist.
    if ((isAppError(e) && e.code === "NOT_FOUND") || e instanceof ZodError) notFound();
    throw e;
  });
  const [templates, addablePages] = plan.canManage
    ? await Promise.all([
        listAssignableTemplates(actor, { userId }),
        listAddablePages(actor, { userId }),
      ])
    : [[], []];

  const { lastActivityAt } = plan.progress;
  const lastActivity = lastActivityAt
    ? t("member.lastActivity", { date: lastActivityAt })
    : t("member.noActivity");

  return (
    <>
      <PageHeader
        title={t("member.title", { name: plan.user.name })}
        description={
          plan.user.startDate
            ? t("member.startsOn", {
                date: format.dateTime(new Date(`${plan.user.startDate}T00:00:00Z`), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
              })
            : t("member.noStartDate")
        }
        actions={
          <>
            <StatusBadge kind="onboardingStatus" value={plan.user.status} />
            {plan.canManage ? (
              <>
                <AssignTemplatesDialog userId={userId} templates={templates} />
                <AddStepDialog userId={userId} pages={addablePages} />
              </>
            ) : null}
          </>
        }
      />
      <div className="space-y-8">
        <section className="space-y-3">
          <ProgressBar value={plan.progress.percent} />
          <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            <span>
              {t("progress.summary", {
                completed: plan.progress.completed,
                total: plan.progress.total,
              })}
            </span>
            <span>{lastActivity}</span>
          </p>
        </section>
        <section aria-labelledby="assigned-templates" className="space-y-2">
          <h2 id="assigned-templates" className="text-lg font-semibold">
            {t("member.templates")}
          </h2>
          {plan.assignedTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("member.noTemplates")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {plan.assignedTemplates.map((template) => (
                <li key={template.templateId}>
                  <span className="font-medium">{template.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {t("member.assignedOn", { date: template.assignedAt })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {plan.user.status === "archived" ? (
          <Alert>
            <AlertDescription>{t("member.archivedUser")}</AlertDescription>
          </Alert>
        ) : !plan.canManage ? (
          <Alert>
            <AlertDescription>{t("member.readOnly")}</AlertDescription>
          </Alert>
        ) : null}
        {plan.modules.length === 0 ? (
          <EmptyState
            title={t("member.emptyPlan")}
            description={plan.canManage ? t("member.emptyPlanHint") : t("member.emptyPlanReadOnly")}
          />
        ) : (
          <EmployeePlanView plan={plan} viewerIsAdmin={actor.role === "admin"} />
        )}
      </div>
    </>
  );
}
