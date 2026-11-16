import { TemplateDetailView } from "@/components/templates/template-detail-view";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  return <TemplateDetailView area="admin" templateId={templateId} />;
}
