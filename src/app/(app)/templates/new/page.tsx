import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TemplateNewView } from "@/components/templates/template-new-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("templates.form");
  return { title: t("createTitle") };
}

export default function NewTemplatePage() {
  return <TemplateNewView area="lead" />;
}
