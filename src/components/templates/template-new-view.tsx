import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Area } from "@/lib/area-routes";
import { requirePageRole } from "@/server/auth/guards";
import { listOrgOptions } from "@/server/services/org";
import { listTemplateOptions } from "@/server/services/templates";
import { createTemplateAction } from "@/app/(app)/admin/templates/actions";
import { TemplateForm } from "./template-form";

/** "New template" screen shared by admin and team lead; the options are scoped by the service. */
export async function TemplateNewView({ area }: { area: Area }) {
  const actor = await requirePageRole(area === "admin" ? ["admin"] : ["team_lead"]);
  const [t, options] = await Promise.all([
    getTranslations("templates"),
    area === "admin" ? listOrgOptions(actor) : listTemplateOptions(actor),
  ]);
  // A lead without a team has no department to create templates for.
  const blocked = area === "lead" && options.departments.length === 0;
  return (
    <>
      <PageHeader title={t("form.createTitle")} />
      {blocked ? (
        <Alert>
          <AlertDescription>{t("lead.noTeam")}</AlertDescription>
        </Alert>
      ) : (
        <TemplateForm action={createTemplateAction} options={options} mode="create" area={area} />
      )}
    </>
  );
}
