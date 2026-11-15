import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { TemplateActions } from "@/components/templates/template-actions";
import { TemplateForm } from "@/components/templates/template-form";
import { TemplateSteps } from "@/components/templates/template-steps";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROUTES } from "@/config/app";
import { idSchema } from "@/lib/validation/common";
import { ALL_DEPARTMENTS } from "@/lib/validation/templates";
import { requirePageRole } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { listOrgOptions } from "@/server/services/org";
import { listPagesForPicker } from "@/server/services/pages";
import { getTemplate, getTemplateDeletionImpact } from "@/server/services/templates";
import { updateTemplateAction } from "../actions";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const actor = await requirePageRole(["admin"]);
  const { templateId } = await params;
  if (!idSchema.safeParse(templateId).success) notFound();
  const t = await getTranslations("templates");
  const notFoundOnMissing = (error: unknown): never => {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  };
  const [template, impact, options, pages] = await Promise.all([
    getTemplate(actor, { id: templateId }).catch(notFoundOnMissing),
    getTemplateDeletionImpact(actor, { id: templateId }).catch(notFoundOnMissing),
    listOrgOptions(actor),
    listPagesForPicker(actor),
  ]);
  return (
    <>
      <Link
        href={ROUTES.adminTemplates}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("detail.back")}
      </Link>
      <PageHeader
        title={template.name}
        description={t("detail.assignedInfo", { count: template.assignmentCount })}
        actions={
          <>
            <StatusBadge kind="templateStatus" value={template.status} />
            <TemplateActions id={template.id} status={template.status} impact={impact} />
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
