import { TemplateDetailView } from "@/components/templates/template-detail-view";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  return <TemplateDetailView area="lead" templateId={templateId} />;
}
