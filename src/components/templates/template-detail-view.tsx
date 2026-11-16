import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { areaRoutes, type Area } from "@/lib/area-routes";
import { idSchema } from "@/lib/validation/common";
import { ALL_DEPARTMENTS } from "@/lib/validation/templates";
import { requirePageRole } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { listOrgOptions } from "@/server/services/org";
import { listPagesForPicker } from "@/server/services/pages";
import {
  getTemplate,
  getTemplateDeletionImpact,
  listTemplateOptions,
} from "@/server/services/templates";
import { updateTemplateAction } from "@/app/(app)/admin/templates/actions";
import { TemplateActions } from "./template-actions";
import { TemplateForm } from "./template-form";
import { TemplateManagedBadge } from "./template-managed-badge";
import { TemplateScope } from "./template-scope";
import { TemplateSteps } from "./template-steps";

const notFoundOnMissing = (error: unknown): never => {
  if (isAppError(error) && error.code === "NOT_FOUND") notFound();
  throw error;
};

/**
 * Template detail shared by admin and team lead. `canManage` (from the service) decides between
 * the editable view and a read-only one; the services re-check every write.
 */
export async function TemplateDetailView({ area, templateId }: { area: Area; templateId: string }) {
  const actor = await requirePageRole(area === "admin" ? ["admin"] : ["team_lead"]);
  if (!idSchema.safeParse(templateId).success) notFound();
  const t = await getTranslations("templates");
  const routes = areaRoutes(area);
  const template = await getTemplate(actor, { id: templateId }).catch(notFoundOnMissing);

  const back = (
    <Link
      href={routes.templates}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t("detail.back")}
    </Link>
  );

  if (!template.canManage) {
    return (
      <>
        {back}
        <PageHeader
          title={template.name}
          description={t("detail.assignedInfo", { count: template.assignmentCount })}
          actions={
            <>
              <TemplateManagedBadge leadManaged={template.leadManaged} />
              <StatusBadge kind="templateStatus" value={template.status} />
            </>
          }
        />
        <div className="space-y-8">
          <Alert>
            <AlertDescription>{t("detail.readOnlyNotice")}</AlertDescription>
          </Alert>
          {template.description ? (
            <p className="max-w-3xl whitespace-pre-line">{template.description}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {t("list.scope")}: <TemplateScope scope={template} />
          </p>
          <TemplateSteps
            templateId={template.id}
            phases={template.phases}
            pages={[]}
            canManage={false}
          />
        </div>
      </>
    );
  }

  const [impact, options, pages] = await Promise.all([
    getTemplateDeletionImpact(actor, { id: templateId }).catch(notFoundOnMissing),
    area === "admin" ? listOrgOptions(actor) : listTemplateOptions(actor),
    listPagesForPicker(actor),
  ]);
  return (
    <>
      {back}
      <PageHeader
        title={template.name}
        description={t("detail.assignedInfo", { count: template.assignmentCount })}
        actions={
          <>
            <TemplateManagedBadge leadManaged={template.leadManaged} />
            <StatusBadge kind="templateStatus" value={template.status} />
            <TemplateActions
              id={template.id}
              status={template.status}
              impact={impact}
              area={area}
            />
          </>
        }
      />
      <div className="space-y-8">
        {template.status === "archived" ? (
          <Alert>
            <AlertDescription>{t("status.archivedNotice")}</AlertDescription>
          </Alert>
        ) : null}
        <TemplateForm
          mode="edit"
          area={area}
          action={updateTemplateAction.bind(null, template.id)}
          options={options}
          initial={{
            name: template.name,
            description: template.description ?? "",
            departmentId: template.departmentId ?? ALL_DEPARTMENTS,
            teamId: template.teamId ?? "",
            jobRoleId: template.jobRoleId ?? "",
          }}
        />
        <TemplateSteps templateId={template.id} phases={template.phases} pages={pages} />
      </div>
    </>
  );
}
