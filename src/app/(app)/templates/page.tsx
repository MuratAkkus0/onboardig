import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TEMPLATE_FILTERS, TemplateListView } from "@/components/templates/template-list-view";
import { ROUTES } from "@/config/app";
import { requirePageRole } from "@/server/auth/guards";
import { listTemplates } from "@/server/services/templates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("templates");
  return { title: t("title") };
}

/** Templates of the lead's department plus company-wide ones (read-only). Admins use /admin/templates. */
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await requirePageRole(["team_lead", "admin"]);
  if (actor.role === "admin") redirect(ROUTES.adminTemplates);
  const { status } = await searchParams;
  const filter = TEMPLATE_FILTERS.find((entry) => entry === status) ?? "all";
  const items = await listTemplates(actor, filter === "all" ? {} : { status: filter });
  return <TemplateListView area="lead" items={items} filter={filter} />;
}
