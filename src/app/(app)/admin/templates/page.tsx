import { TEMPLATE_FILTERS, TemplateListView } from "@/components/templates/template-list-view";
import { requirePageRole } from "@/server/auth/guards";
import { listTemplates } from "@/server/services/templates";

export default async function AdminTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await requirePageRole(["admin"]);
  const { status } = await searchParams;
  const filter = TEMPLATE_FILTERS.find((entry) => entry === status) ?? "all";
  const items = await listTemplates(actor, filter === "all" ? {} : { status: filter });
  return <TemplateListView area="admin" items={items} filter={filter} />;
}
