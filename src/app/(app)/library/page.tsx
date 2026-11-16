import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { AdminLibrary } from "@/components/content/admin-library";
import { ModuleDialog } from "@/components/content/module-dialog";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { requirePageRole } from "@/server/auth/guards";
import { listLibrary } from "@/server/services/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library.lead");
  return { title: t("title") };
}

/**
 * Library for team leads: modules of their own department are editable, all others read-only.
 * Admins have their own screen (/admin/library) and are sent there.
 */
export default async function Page() {
  const actor = await requirePageRole(["team_lead", "admin"]);
  if (actor.role === "admin") redirect(ROUTES.adminLibrary);
  const t = await getTranslations("library");
  const modules = await listLibrary(actor);
  return (
    <>
      <PageHeader
        title={t("lead.title")}
        description={t("lead.description")}
        actions={
          <ModuleDialog
            trigger={
              <Button>
                <Plus />
                {t("admin.addModule")}
              </Button>
            }
          />
        }
      />
      {modules.length === 0 ? (
        <EmptyState title={t("readonly.emptyTitle")} description={t("lead.emptyDescription")} />
      ) : (
        <AdminLibrary modules={modules} area="lead" />
      )}
    </>
  );
}
