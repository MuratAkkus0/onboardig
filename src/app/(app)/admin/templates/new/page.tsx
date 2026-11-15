import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { TemplateForm } from "@/components/templates/template-form";
import { requirePageRole } from "@/server/auth/guards";
import { listOrgOptions } from "@/server/services/org";
import { createTemplateAction } from "../actions";

export default async function NewTemplatePage() {
  const actor = await requirePageRole(["admin"]);
  const [t, options] = await Promise.all([getTranslations("templates"), listOrgOptions(actor)]);
  return (
    <>
      <PageHeader title={t("form.createTitle")} />
      <TemplateForm action={createTemplateAction} options={options} mode="create" />
    </>
  );
}
